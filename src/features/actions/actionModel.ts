import type { Task } from "../../types";
import { ACTION_KINDS, type TaskActionFields } from "../../types/action";

export const ACTION_DEFAULTS: TaskActionFields = {
  kind: "TASK", windowStartDate: null, windowStartTime: null,
  eventStartDate: null, eventStartTime: null, eventEndDate: null, eventEndTime: null,
  timeZone: "Asia/Seoul", registrationState: "CONFIRMED", origin: "MANUAL",
  sourceType: "USER_STATEMENT", verificationStatus: "USER_PROVIDED",
  sourceUrl: null, sourceLabel: null, sourceExcerpt: null,
  sourceReferenceDate: null, sourceReferenceTimeZone: null,
  sourceReportedCheckedAt: null, sourceCheckedAt: null, sourceCheckedBy: null,
  sourceNamespace: null, externalKey: null,
};
export const ACTION_LABELS: Record<TaskActionFields["kind"], string> = {
  TASK: "할 일", APPLICATION: "신청", REGISTRATION: "접수", DEADLINE: "마감",
  EXAM: "시험", EVENT: "행사", RENEWAL: "갱신",
};
export function normalizeActionFields(value: Partial<TaskActionFields>): TaskActionFields {
  const fields = { ...ACTION_DEFAULTS };
  for (const key of Object.keys(fields) as (keyof TaskActionFields)[]) {
    const input = value[key];
    if (input !== undefined) (fields as unknown as Record<string, unknown>)[key] = input;
  }
  if (!ACTION_KINDS.includes(fields.kind) ||
      !["CANDIDATE", "CONFIRMED"].includes(fields.registrationState) ||
      !["MANUAL", "CHATGPT", "IMPORT"].includes(fields.origin) ||
      !["USER_STATEMENT", "EXTERNAL_NOTICE"].includes(fields.sourceType) ||
      !["UNVERIFIED", "USER_PROVIDED", "SOURCE_CHECKED"].includes(fields.verificationStatus)) {
    throw new Error("저장된 일정 상태를 읽을 수 없습니다.");
  }
  return fields;
}
export function isCandidate(task: Task): boolean { return task.registrationState === "CANDIDATE"; }
export function isImportedAction(task: Task): boolean { return Boolean(task.externalKey && task.sourceNamespace); }
export function sameActionContent(a: Task, b: Task): boolean {
  const timestamp = (value: string | null | undefined) => value && Number.isFinite(Date.parse(value)) ? new Date(value).toISOString() : value ?? null;
  const content = (task: Task) => ({
    ...normalizeActionFields(task), text: task.text, isDone: task.isDone,
    dueDate: task.dueDate, dueTime: task.dueTime, plannedDate: task.plannedDate,
    deletedAt: timestamp(task.deletedAt),
    sourceCheckedAt: timestamp(task.sourceCheckedAt),
    sourceReportedCheckedAt: timestamp(task.sourceReportedCheckedAt),
  });
  return JSON.stringify(content(a)) === JSON.stringify(content(b));
}
export function nextTaskTimestamp(previous: string): string {
  return new Date(Math.max(Date.now(), Date.parse(previous) + 1)).toISOString();
}
