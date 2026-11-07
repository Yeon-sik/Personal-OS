import type { Task } from "../../types";
import { actionRolesOnDate, type ActionRole } from "../actions/actionCalendar";
import { addDays, calendarDate, exactInstant, validDate } from "../actions/actionTime";

export interface TimelineEntry {
  task: Task;
  roles: ActionRole[];
  startMinute: number | null;
  endMinute: number | null;
  conflictIds: string[];
}
export interface TimelineDay { date: string; entries: TimelineEntry[] }

export function weekStart(date: string): string {
  const weekday = new Date(date + "T00:00:00Z").getUTCDay();
  return addDays(date, -((weekday + 6) % 7));
}

export function timelineDays(tasks: Task[], selectedDate: string, view: "week" | "day"): TimelineDay[] {
  if (!validDate(selectedDate)) return [];
  const startDate = view === "week" ? weekStart(selectedDate) : selectedDate;
  return Array.from({ length: view === "week" ? 7 : 1 }, (_, index) => {
    const date = addDays(startDate, index);
    const dayStart = exactInstant(date, "00:00", "Asia/Seoul")!;
    const dayEnd = dayStart + 86_400_000;
    const entries: TimelineEntry[] = [];
    for (const task of tasks) {
      if (task.deletedAt || task.skippedAt) continue;
      const roles = actionRolesOnDate(task, date);
      if (!roles.length) continue;
      const zone = task.timeZone ?? "Asia/Seoul";
      let startMinute: number | null = null;
      let endMinute: number | null = null;
      if (roles.includes("EVENT") && task.eventStartDate && task.eventStartTime) {
        const start = exactInstant(task.eventStartDate, task.eventStartTime, zone);
        const end = task.eventEndDate && task.eventEndTime ? exactInstant(task.eventEndDate, task.eventEndTime, zone) : null;
        if (start !== null && end !== null && end > start) {
          startMinute = Math.max(0, (start - dayStart) / 60_000);
          endMinute = Math.min(1440, (end - dayStart) / 60_000);
        } else if (start !== null && start >= dayStart && start < dayEnd) {
          startMinute = (start - dayStart) / 60_000;
        }
      } else if (roles.includes("DEADLINE") && task.dueDate && task.dueTime) {
        const due = exactInstant(task.dueDate, task.dueTime, zone);
        if (due !== null && calendarDate(due) === date) startMinute = (due - dayStart) / 60_000;
      }
      entries.push({ task, roles, startMinute, endMinute, conflictIds: [] });
    }
    // Only confirmed, unfinished intervals have enough information to assert an overlap.
    for (let left = 0; left < entries.length; left++) {
      const a = entries[left];
      if (a.task.isDone || a.task.registrationState === "CANDIDATE" || a.startMinute === null || a.endMinute === null) continue;
      for (let right = left + 1; right < entries.length; right++) {
        const b = entries[right];
        if (b.task.isDone || b.task.registrationState === "CANDIDATE" || b.startMinute === null || b.endMinute === null) continue;
        if (a.startMinute < b.endMinute && b.startMinute < a.endMinute) {
          a.conflictIds.push(b.task.id);
          b.conflictIds.push(a.task.id);
        }
      }
    }
    entries.sort((a, b) => (a.startMinute ?? -1) - (b.startMinute ?? -1) || a.task.orderIndex - b.task.orderIndex);
    return { date, entries };
  });
}

export function minuteLabel(minute: number): string {
  return `${String(Math.floor(minute / 60)).padStart(2, "0")}:${String(Math.floor(minute % 60)).padStart(2, "0")}`;
}


export interface TimelinePlacement { entry: TimelineEntry; lane: number; lanes: number; visualEnd: number }

// Layout includes point markers and minimum touch-target height. Semantic conflicts remain separate.
export function timelineLayout(entries: TimelineEntry[]): TimelinePlacement[] {
  const timed = entries.filter(entry => entry.startMinute !== null)
    .sort((a, b) => a.startMinute! - b.startMinute! || a.task.id.localeCompare(b.task.id));
  const result: TimelinePlacement[] = [];
  let group: TimelinePlacement[] = [];
  let laneEnds: number[] = [];
  let groupEnd = -1;
  const flush = () => {
    for (const item of group) result.push({ ...item, lanes: laneEnds.length });
    group = [];
    laneEnds = [];
  };
  for (const entry of timed) {
    const start = entry.startMinute!;
    const visualEnd = Math.max(entry.endMinute ?? start, start + 55);
    if (start >= groupEnd) { flush(); groupEnd = -1; }
    let lane = laneEnds.findIndex(end => end <= start);
    if (lane < 0) lane = laneEnds.length;
    laneEnds[lane] = visualEnd;
    groupEnd = Math.max(groupEnd, visualEnd);
    group.push({ entry, lane, lanes: 0, visualEnd });
  }
  flush();
  return result;
}
