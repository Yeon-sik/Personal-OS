import type { Task } from "../../types";
import { actionRolesOnDate, actionStateLabel, type ActionRole } from "../actions/actionCalendar";
import { normalizeActionFields } from "../actions/actionModel";
import { addDays, calendarDate, exactInstant } from "../actions/actionTime";

export interface AgendaEntry {
  task: Task;
  date: string;
  roles: ActionRole[];
  state: string;
}

export interface Agenda {
  overdue: AgendaEntry[];
  today: AgendaEntry[];
  upcoming: AgendaEntry[];
  review: AgendaEntry[];
  candidates: Task[];
  undated: Task[];
}

/** One next occurrence per task; calendar roles retain the calendar's Seoul/date-only semantics. */
export function getAgenda(tasks: Task[], now: number): Agenda {
  const today = calendarDate(now);
  const agenda: Agenda = { overdue: [], today: [], upcoming: [], review: [], candidates: [], undated: [] };
  for (const task of tasks) {
    if (task.deletedAt || task.isDone || task.skippedAt) continue;
    const action = normalizeActionFields(task);
    if (action.registrationState === "CANDIDATE") {
      agenda.candidates.push(task);
      continue;
    }
    const state = actionStateLabel(task, now);
    if (state === "마감 지남" && task.dueDate) {
      const instant = task.dueTime ? exactInstant(task.dueDate, task.dueTime, action.timeZone) : null;
      const mixedWindow = action.windowStartDate && (!action.windowStartTime || !task.dueTime);
      const date = instant === null || mixedWindow ? task.dueDate : calendarDate(instant);
      agenda.overdue.push({ task, date, roles: ["DEADLINE"], state });
      continue;
    }
    if (!task.plannedDate && !task.dueDate && !action.windowStartDate && !action.eventStartDate) {
      agenda.undated.push(task);
      continue;
    }
    let scheduled = false;
    for (let offset = 0; offset < 7; offset++) {
      const date = addDays(today, offset);
      const roles = actionRolesOnDate(task, date);
      if (!roles.length) continue;
      const entry = { task, date, roles, state };
      (offset === 0 ? agenda.today : agenda.upcoming).push(entry);
      scheduled = true;
      break;
    }
    if (!scheduled && state.includes("완료 확인 필요") && action.eventStartDate) {
      agenda.review.push({ task, date: action.eventEndDate ?? action.eventStartDate, roles: ["EVENT"], state });
    } else if (!scheduled && task.plannedDate && task.plannedDate < today) {
      agenda.review.push({ task, date: task.plannedDate, roles: ["PLAN"], state: "계획일 지남 · 일정 확인 필요" });
    }
  }
  function orderTime(entry: AgendaEntry): number {
    const action = normalizeActionFields(entry.task);
    const points = [
      entry.roles.includes("DEADLINE") ? [entry.task.dueDate, entry.task.dueTime] : [],
      entry.roles.includes("EVENT") ? [action.eventStartDate, action.eventStartTime] : [],
    ];
    const times = points.flatMap(([date, time]) => date && time ? [exactInstant(date, time, action.timeZone)].filter((instant): instant is number => instant !== null) : []);
    return times.length ? Math.min(...times) : Number.MAX_SAFE_INTEGER;
  }
  const compare = (a: AgendaEntry, b: AgendaEntry) => a.date.localeCompare(b.date)
    || orderTime(a) - orderTime(b)
    || Number(b.roles.includes("DEADLINE")) - Number(a.roles.includes("DEADLINE"))
    || a.task.orderIndex - b.task.orderIndex || a.task.id.localeCompare(b.task.id);
  agenda.overdue.sort(compare);
  agenda.today.sort(compare);
  agenda.upcoming.sort(compare);
  agenda.review.sort(compare);
  return agenda;
}
