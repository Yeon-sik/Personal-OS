import type { TaskActionFields } from "../../../types/action";
import type { TaskPlanningFields } from "../../../types/taskPlanning";
import { parseTaskPlanningFields, TASK_PLANNING_KEYS } from "../../storage/taskPlanningFields";
import { normalizeActionFields } from "../../../features/actions/actionModel";

export const ACTION_ROW_FIELDS = {
  kind: "kind",
  windowStartDate: "window_start_date",
  windowStartTime: "window_start_time",
  eventStartDate: "event_start_date",
  eventStartTime: "event_start_time",
  eventEndDate: "event_end_date",
  eventEndTime: "event_end_time",
  timeZone: "time_zone",
  registrationState: "registration_state",
  origin: "origin",
  sourceType: "source_type",
  verificationStatus: "verification_status",
  sourceUrl: "source_url",
  sourceLabel: "source_label",
  sourceExcerpt: "source_excerpt",
  sourceReferenceDate: "source_reference_date",
  sourceReferenceTimeZone: "source_reference_time_zone",
  sourceReportedCheckedAt: "source_reported_checked_at",
  sourceCheckedAt: "source_checked_at",
  sourceCheckedBy: "source_checked_by",
  sourceNamespace: "source_namespace",
  externalKey: "external_key",
} as const satisfies Record<keyof TaskActionFields, string>;
export type TaskActionRow = { [K in keyof TaskActionFields as (typeof ACTION_ROW_FIELDS)[K]]?: TaskActionFields[K] };
export function actionFieldsFromRow(row: TaskActionRow): TaskActionFields {
  const fields: Partial<TaskActionFields> = {};
  for (const key of Object.keys(ACTION_ROW_FIELDS) as (keyof TaskActionFields)[]) {
    let value = row[ACTION_ROW_FIELDS[key]];
    if (key.endsWith("Time") && typeof value === "string") value = value.slice(0, 5);
    if (value !== undefined) (fields as Record<string, unknown>)[key] = value;
  }
  return normalizeActionFields(fields);
}
export function actionFieldsToRow(task: Partial<TaskActionFields>): TaskActionRow {
  const fields = normalizeActionFields(task);
  return Object.fromEntries((Object.keys(ACTION_ROW_FIELDS) as (keyof TaskActionFields)[]).map(key => [ACTION_ROW_FIELDS[key], fields[key]]));
}

export const TASK_PLANNING_ROW_FIELDS = {
  completedAt: "completed_at", skippedAt: "skipped_at", description: "description",
  category: "category", checklist: "checklist", recurrence: "recurrence",
  recurrenceSeriesId: "recurrence_series_id", recurrenceOccurrence: "recurrence_occurrence",
  projectActionId: "project_action_id",
} as const satisfies Record<keyof TaskPlanningFields, string>;
export type TaskPlanningRow = {
  [K in keyof TaskPlanningFields as (typeof TASK_PLANNING_ROW_FIELDS)[K]]?: TaskPlanningFields[K];
};

export function taskPlanningFieldsFromRow(row: TaskPlanningRow): Partial<TaskPlanningFields> {
  const fields: Record<string, unknown> = {};
  for (const key of TASK_PLANNING_KEYS) {
    const value = row[TASK_PLANNING_ROW_FIELDS[key]];
    if (value !== undefined) fields[key] = value;
  }
  return parseTaskPlanningFields(fields);
}

export function taskPlanningFieldsToRow(task: Partial<TaskPlanningFields>): TaskPlanningRow {
  const fields = parseTaskPlanningFields(task as Record<string, unknown>);
  // Omission is intentional: an older local snapshot must not null fields it
  // has never read. Explicit null/empty values still support clearing a field.
  return Object.fromEntries(TASK_PLANNING_KEYS.filter(key => fields[key] !== undefined)
    .map(key => [TASK_PLANNING_ROW_FIELDS[key], fields[key]]));
}
