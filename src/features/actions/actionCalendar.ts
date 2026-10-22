import type { Task } from "../../types";
import { normalizeActionFields } from "./actionModel";
import { calendarDate, exactInstant, addDays } from "./actionTime";

export type ActionRole = "PLAN" | "WINDOW" | "DEADLINE" | "EVENT";
export const ROLE_LABELS: Record<ActionRole, string> = { PLAN: "계획", WINDOW: "접수기간", DEADLINE: "마감", EVENT: "시험·행사" };
function pointDate(date: string | null, time: string | null, zone: string): string | null {
  if (!date || !time) return date;
  const instant = exactInstant(date, time, zone);
  return instant === null ? date : calendarDate(instant);
}
function period(start: string, startTime: string | null, end: string | null, endTime: string | null, zone: string): [string, string] {
  if (!end) { const day = pointDate(start, startTime, zone)!; return [day, day]; }
  if (!startTime || !endTime) return [start, end];
  const first = exactInstant(start, startTime, zone);
  const last = exactInstant(end, endTime, zone);
  return first === null || last === null ? [start, end] : [calendarDate(first), calendarDate(last > first ? last - 1 : last)];
}
export function actionRolesOnDate(task: Task, date: string): ActionRole[] {
  if (task.deletedAt) return [];
  const a = normalizeActionFields(task);
  const roles: ActionRole[] = [];
  if (task.plannedDate === date) roles.push("PLAN");
  if (a.windowStartDate) {
    const [start, end] = period(a.windowStartDate, a.windowStartTime, task.dueDate, task.dueTime, a.timeZone);
    if (date >= start && date <= end) roles.push("WINDOW");
  }
  const mixed = Boolean(a.windowStartDate && task.dueDate && (!a.windowStartTime || !task.dueTime));
  if ((mixed ? task.dueDate : pointDate(task.dueDate, task.dueTime, a.timeZone)) === date) roles.push("DEADLINE");
  if (a.eventStartDate) {
    const [start, end] = period(a.eventStartDate, a.eventStartTime, a.eventEndDate, a.eventEndTime, a.timeZone);
    if (date >= start && date <= end) roles.push("EVENT");
  }
  return roles;
}
export function isUndatedAction(task: Task): boolean {
  return !task.deletedAt && !task.plannedDate && !task.dueDate && !task.windowStartDate && !task.eventStartDate;
}
export function firstActionDate(task: Task): string | null {
  const first = [task.plannedDate, task.dueDate, task.windowStartDate, task.eventStartDate].filter((date): date is string => Boolean(date)).sort()[0];
  if (!first) return null;
  return actionDatesInRange(task, addDays(first, -2), addDays(first, 2))[0]?.date ?? first;
}
export function actionDatesInRange(task: Task, start: string, end: string): Array<{ date: string; roles: ActionRole[] }> {
  const days: Array<{ date: string; roles: ActionRole[] }> = [];
  for (let date = start; date <= end; date = addDays(date, 1)) {
    const roles = actionRolesOnDate(task, date);
    if (roles.length) days.push({ date, roles });
  }
  return days;
}
export function actionStateLabel(task: Task, now = Date.now()): string {
  const a = normalizeActionFields(task);
  if (a.registrationState === "CANDIDATE") return "후보";
  if (task.isDone) return "완료";
  const today = calendarDate(now, a.timeZone);
  if (task.dueDate) {
    const due = task.dueTime ? exactInstant(task.dueDate, task.dueTime, a.timeZone) : null;
    if (due !== null ? now >= due : today > task.dueDate) return "마감 지남";
    if (task.dueDate === today && !task.dueTime) return "오늘 마감 · 시간 미확인";
    if (a.windowStartDate) {
      const start = a.windowStartTime ? exactInstant(a.windowStartDate, a.windowStartTime, a.timeZone) : null;
      if (start !== null && due !== null && now >= start && now < due) return "접수 중";
      if (today >= a.windowStartDate && today <= task.dueDate) return "접수기간 · 시간 확인 필요";
    }
    if (task.dueDate >= today && task.dueDate <= addDays(today, 3)) return "마감 임박";
  }
  if (a.eventStartDate) {
    const start = a.eventStartTime ? exactInstant(a.eventStartDate, a.eventStartTime, a.timeZone) : null;
    const end = a.eventEndDate && a.eventEndTime ? exactInstant(a.eventEndDate, a.eventEndTime, a.timeZone) : null;
    if (end !== null && now >= end) return "종료 · 완료 확인 필요";
    if (start !== null && now >= start) return end !== null ? "진행 중" : "시작 시점 지남 · 완료 확인 필요";
    if (!a.eventStartTime && today > (a.eventEndDate ?? a.eventStartDate)) return "행사일 지남 · 완료 확인 필요";
  }
  return "예정";
}
