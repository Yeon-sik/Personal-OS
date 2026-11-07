import type { Task } from "../../types";
import { calendarDate } from "../actions/actionTime";

export type TaskListStatus = "all" | "open" | "completed" | "undated" | "skipped";
export const TASK_CATEGORIES = ["학교", "개인", "개발"] as const;

export function filterChecklistTasks(tasks: Task[], query: string, status: TaskListStatus, category: string): Task[] {
  const needle = query.trim().toLocaleLowerCase();
  return tasks.filter(task => {
    if (task.deletedAt || task.registrationState === "CANDIDATE") return false;
    if (needle && !task.text.toLocaleLowerCase().includes(needle)) return false;
    if (category === "uncategorized" ? Boolean(task.category) : category !== "all" && task.category !== category) return false;
    if (status === "open" && (task.isDone || task.skippedAt)) return false;
    if (status === "completed" && !task.isDone) return false;
    if (status === "skipped" && !task.skippedAt) return false;
    if (status === "undated" && (task.isDone || task.skippedAt || task.plannedDate || task.dueDate || task.eventStartDate || task.windowStartDate)) return false;
    return true;
  });
}

export function completionDay(task: Task): string | null {
  const instant = task.completedAt ? Date.parse(task.completedAt) : NaN;
  return Number.isFinite(instant) ? calendarDate(instant) : null;
}

export function groupCompletedTasks(tasks: Task[]): { date: string | null; tasks: Task[] }[] {
  const groups = new Map<string | null, Task[]>();
  for (const task of tasks) {
    if (!task.isDone || task.deletedAt) continue;
    const date = completionDay(task);
    groups.set(date, [...(groups.get(date) ?? []), task]);
  }
  return [...groups.entries()]
    .sort(([a], [b]) => a === null ? 1 : b === null ? -1 : b.localeCompare(a))
    .map(([date, grouped]) => ({ date, tasks: grouped.sort((a, b) => (b.completedAt ?? "").localeCompare(a.completedAt ?? "") || a.orderIndex - b.orderIndex) }));
}
