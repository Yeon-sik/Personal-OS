import type { TaskPlanningFields } from "../../types/taskPlanning";

export const TASK_PLANNING_KEYS = [
  "completedAt", "skippedAt", "description", "category", "checklist", "recurrence",
  "recurrenceSeriesId", "recurrenceOccurrence", "projectActionId",
] as const satisfies readonly (keyof TaskPlanningFields)[];

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Preserve absent legacy fields and reject corrupt new data without erasing it. */
export function parseTaskPlanningFields(value: Record<string, unknown>): Partial<TaskPlanningFields> {
  const result: Record<string, unknown> = {};
  const invalid = (key: string): never => { throw new Error(`일정 세부 정보가 손상되었습니다: ${key}`); };
  for (const key of TASK_PLANNING_KEYS) {
    const field = value[key];
    if (field === undefined) continue;
    if (key === "completedAt" || key === "skippedAt") {
      if (field !== null && (typeof field !== "string" || !Number.isFinite(Date.parse(field)))) invalid(key);
    } else if (key === "description") {
      if (typeof field !== "string") invalid(key);
    } else if (key === "category" || key === "recurrenceSeriesId" || key === "projectActionId") {
      if (field !== null && typeof field !== "string") invalid(key);
    } else if (key === "recurrenceOccurrence") {
      if (field !== null && (!Number.isSafeInteger(field) || Number(field) < 0)) invalid(key);
    } else if (key === "checklist") {
      if (!Array.isArray(field) || field.some(item => !record(item) || typeof item.id !== "string" ||
          !item.id.trim() || typeof item.text !== "string" || !item.text.trim() || typeof item.isDone !== "boolean") ||
          new Set(field.map(item => item.id)).size !== field.length) invalid(key);
    } else if (key === "recurrence" && field !== null) {
      if (!record(field) || !["DAILY", "WEEKLY", "MONTHLY"].includes(String(field.frequency)) ||
          !Number.isSafeInteger(field.interval) || Number(field.interval) < 1 || Number(field.interval) > 365 ||
          typeof field.anchorDate !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(field.anchorDate) ||
          !Number.isFinite(Date.parse(field.anchorDate)) || new Date(field.anchorDate).toISOString().slice(0, 10) !== field.anchorDate) invalid(key);
    }
    result[key] = field;
  }
  return result as Partial<TaskPlanningFields>;
}
