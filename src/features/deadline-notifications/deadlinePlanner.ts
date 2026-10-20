import { Temporal } from "@js-temporal/polyfill";
import type { Task } from "../../types";

export interface DeadlineSettings {
  enabled: boolean;
  time: string | null;
  /** Used only for legacy Actions without a timeZone. */
  timeZone: string;
}
export interface OwnedDeadlineNotification {
  key: string;
  id: number;
  taskId: string;
  fireDate: string;
  at: string;
  title: string;
  body: string;
  /** False is a durable reservation written before calling the OS. */
  applied: boolean;
}
export interface DeadlinePlan {
  add: OwnedDeadlineNotification[];
  cancel: OwnedDeadlineNotification[];
  unchanged: OwnedDeadlineNotification[];
  issues: string[];
}
export const DEADLINE_LEAD_DAYS = 3;
export function stableNotificationId(key: string): number {
  let hash = 2166136261;
  for (let i = 0; i < key.length; i++) hash = Math.imul(hash ^ key.charCodeAt(i), 16777619);
  return (hash >>> 0) % 2147483646 + 1;
}
function wallTime(date: Temporal.PlainDate, clock: string, timeZone: string): Temporal.ZonedDateTime {
  if (!/^\d{2}:\d{2}(:\d{2}(\.\d{1,9})?)?$/.test(clock)) throw new Error("Invalid clock");
  const time = Temporal.PlainTime.from(clock, { overflow: "reject" });
  // Spring gap moves forward; autumn fold uses the earlier occurrence once.
  return Temporal.ZonedDateTime.from({ year: date.year, month: date.month, day: date.day,
    hour: time.hour, minute: time.minute, second: time.second, millisecond: time.millisecond,
    microsecond: time.microsecond, nanosecond: time.nanosecond, timeZone }, { disambiguation: "compatible", overflow: "reject" });
}
export function effectiveDeadline(task: Task, fallbackZone: string) {
  const date = task.dueDate || ((task.kind === "EXAM" || task.kind === "EVENT") ? task.eventStartDate : null);
  const clock = task.dueDate ? task.dueTime : task.eventStartTime;
  if (!date) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error("Invalid date");
  const day = Temporal.PlainDate.from(date, { overflow: "reject" });
  const timeZone = task.timeZone || fallbackZone;
  return { day, timeZone, instant: wallTime(day, clock || "23:59:59.999", timeZone).toInstant() };
}
function sameSchedule(a: OwnedDeadlineNotification, b: OwnedDeadlineNotification) {
  return a.key === b.key && a.at === b.at && a.title === b.title && a.body === b.body;
}

/** Pure planner. D-4 has no delivery today, but may reserve future D-3..D-day. */
export function reconcileDeadlineNotifications(
  tasks: readonly Task[], settings: DeadlineSettings, now: string, scope: string,
  previouslyOwned: readonly OwnedDeadlineNotification[], unavailableIds: readonly number[] = [],
  hash: (key: string) => number = stableNotificationId,
): DeadlinePlan {
  const desired = new Map<string, Omit<OwnedDeadlineNotification, "id" | "applied">>();
  const issues: string[] = [];
  const instant = Temporal.Instant.from(now);
  if (settings.enabled && settings.time) {
    for (const task of tasks) {
      if (task.registrationState !== "CONFIRMED" || task.deletedAt != null || task.isDone) continue;
      try {
        const deadline = effectiveDeadline(task, settings.timeZone);
        if (!deadline || Temporal.Instant.compare(deadline.instant, instant) < 0) continue;
        for (let days = DEADLINE_LEAD_DAYS; days >= 0; days--) {
          const date = deadline.day.subtract({ days });
          const fire = wallTime(date, settings.time, deadline.timeZone).toInstant();
          if (Temporal.Instant.compare(fire, instant) <= 0 || Temporal.Instant.compare(fire, deadline.instant) > 0) continue;
          const key = JSON.stringify(["personal-os.deadline.v1", scope, task.id, date.toString()]);
          const start = !task.dueDate && (task.kind === "EXAM" || task.kind === "EVENT");
          const suffix = start ? "시작" : "마감";
          desired.set(key, { key, taskId: task.id, fireDate: date.toString(), at: fire.toString(),
            title: `Personal OS · ${days === 0 ? "D-day" : `D-${days}`}`,
            body: days === 0 ? `${task.text} ${suffix}일입니다.` : `${task.text} ${suffix}이 ${days}일 남았습니다.` });
        }
      } catch { issues.push(`${task.id}: 일정 날짜·시간대를 확인하세요.`); }
    }
  }
  const prior = new Map(previouslyOwned.map(row => [row.key, row]));
  const occupied = new Set([...unavailableIds, ...previouslyOwned.map(row => row.id)]);
  const cancel: OwnedDeadlineNotification[] = [], add: OwnedDeadlineNotification[] = [], unchanged: OwnedDeadlineNotification[] = [];
  for (const row of previouslyOwned) if (!desired.has(row.key)) cancel.push(row);
  for (const draft of [...desired.values()].sort((a, b) => a.key.localeCompare(b.key))) {
    const old = prior.get(draft.key);
    let id = old?.id;
    if (id === undefined) {
      id = hash(draft.key);
      if (!Number.isInteger(id) || id < 1 || id > 2147483647) throw new Error("Invalid notification ID");
      while (occupied.has(id)) id = id === 2147483647 ? 1 : id + 1;
    }
    occupied.add(id);
    const next = { ...draft, id, applied: false };
    if (old?.applied && sameSchedule(old, next)) unchanged.push(old);
    else { if (old) cancel.push(old); add.push(next); }
  }
  return { add, cancel, unchanged, issues };
}
