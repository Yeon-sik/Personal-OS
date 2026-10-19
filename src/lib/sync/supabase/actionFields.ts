import type { TaskActionFields } from "../../../types/action";
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
