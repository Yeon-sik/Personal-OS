import type { LocalDataSnapshot, Task } from "../../types";
import { ACTION_KINDS, type TaskActionFields, type RegistrationState } from "../../types/action";
import { createTask, getNextOrderIndex } from "../tasks/taskService";
import { ACTION_DEFAULTS, normalizeActionFields, sameActionContent, nextTaskTimestamp } from "./actionModel";
import { validDate, validTime, validTimeZone, exactInstant } from "./actionTime";
import { actionId } from "./actionIdentity";

export const ACTION_IMPORT_VERSION = "personal-os.action-import.v1";
export interface ImportIssue { code: string; fieldPath: string; message: string }
export interface ActionImportItem { itemKey: string; task: Task | null; issues: ImportIssue[] }
export interface ActionImportPreview { requestId: string; items: ActionImportItem[] }
export interface ImportSelection { task: Task; state: RegistrationState; independent: boolean }
export interface ImportOutcome { taskId: string | null; outcome: "CREATED" | "MATCHED" | "REVIEW_REQUIRED" | "DELETED_MATCH"; text: string }
class InputError extends Error {
  constructor(public fieldPath: string, message: string, public code = "INVALID_INPUT") { super(message); }
}
function object(value: unknown, field: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new InputError(field, "객체 형식이 필요합니다.");
  return value as Record<string, unknown>;
}
function keys(value: Record<string, unknown>, allowed: string[], field: string) {
  const extra = Object.keys(value).find(key => !allowed.includes(key));
  if (extra) throw new InputError(field + "." + extra, "지원하지 않는 필드입니다.", "UNSUPPORTED_FIELD");
}
function string(value: unknown, field: string, max: number, required = false): string | null {
  if (value === undefined || value === null) {
    if (required) throw new InputError(field, "필수 값입니다.");
    return null;
  }
  if (typeof value !== "string") throw new InputError(field, "문자열이 필요합니다.");
  const trimmed = value.trim();
  if (Array.from(trimmed).length > max || (required && !trimmed)) throw new InputError(field, "값이 비어 있거나 길이 제한을 초과했습니다.");
  return trimmed || null;
}
const dates = ["plannedDate", "dueDate", "windowStartDate", "eventStartDate", "eventEndDate"] as const;
const times = ["dueTime", "windowStartTime", "eventStartTime", "eventEndTime"] as const;
export function validateAction(task: Task): void {
  const a = { ...normalizeActionFields(task), ...task };
  string(a.text, "text", 500, true);
  string(a.sourceLabel, "source.label", 200);
  string(a.sourceExcerpt, "source.excerpt", 2000);
  const url = string(a.sourceUrl, "source.url", 2048);
  if (url) {
    let valid = false;
    try { valid = ["http:", "https:"].includes(new URL(url).protocol); } catch { /* rejected below */ }
    if (!valid) throw new InputError("source.url", "http 또는 https 주소가 필요합니다.");
  }
  if (!validTimeZone(a.timeZone!)) throw new InputError("schedule.timeZone", "유효한 IANA 시간대가 필요합니다.");
  for (const key of dates) if (a[key] && !validDate(a[key]!)) throw new InputError("schedule." + key, "존재하지 않는 날짜입니다.", "INVALID_DATE");
  for (const key of times) if (a[key]) {
    const dateKey = key.replace("Time", "Date") as (typeof dates)[number];
    if (!validTime(a[key]!) || !a[dateKey]) throw new InputError("schedule." + key, "날짜와 유효한 24시간제 시각이 필요합니다.", "INVALID_DATE");
    if (exactInstant(a[dateKey]!, a[key]!, a.timeZone!) === null) throw new InputError("schedule." + key, "시간대 변경으로 존재하지 않거나 중복되는 시각입니다. 시각을 확인하거나 비워 주세요.", "TIME_AMBIGUOUS");
  }
  if (a.eventEndDate && !a.eventStartDate) throw new InputError("schedule.eventEndDate", "행사 시작일이 필요합니다.", "INVALID_RANGE");
  for (const [start, startTime, end, endTime] of [
    [a.windowStartDate, a.windowStartTime, a.dueDate, a.dueTime],
    [a.eventStartDate, a.eventStartTime, a.eventEndDate, a.eventEndTime],
  ]) if (start && end && (start > end || (start === end && startTime && endTime && startTime > endTime))) {
    throw new InputError("schedule", "종료가 시작보다 빠릅니다.", "INVALID_RANGE");
  }
  const isEvent = a.kind === "EXAM" || a.kind === "EVENT";
  const isWindow = a.kind === "APPLICATION" || a.kind === "REGISTRATION";
  if ((isEvent && (a.dueDate || a.windowStartDate)) || (!isEvent && (a.eventStartDate || a.eventEndDate)) || (!isWindow && a.windowStartDate)) {
    throw new InputError("schedule", "일정 종류와 날짜 조합이 맞지 않습니다. 접수와 시험은 별도 항목으로 나눠 주세요.", "INVALID_COMBINATION");
  }
}
export function parseActionImport(input: string): ActionImportPreview {
  if (new TextEncoder().encode(input).length > 256 * 1024) throw new Error("입력은 256 KiB 이하로 나눠 주세요.");
  let decoded: unknown;
  try { decoded = JSON.parse(input); } catch { throw new Error("JSON 형식을 확인해 주세요. 설명 문장과 코드 울타리는 제외합니다."); }
  const batch = object(decoded, "root");
  keys(batch, ["schemaVersion", "requestId", "items"], "root");
  if (batch.schemaVersion !== ACTION_IMPORT_VERSION) throw new Error("지원하는 형식은 " + ACTION_IMPORT_VERSION + "입니다.");
  const requestId = string(batch.requestId, "requestId", 128, true)!;
  if (!Array.isArray(batch.items) || batch.items.length < 1 || batch.items.length > 100) throw new Error("한 번에 1~100개 일정을 입력해 주세요.");
  const itemKeys = new Set<string>();
  for (const raw of batch.items) {
    const item = object(raw, "items");
    const key = string(item.itemKey, "itemKey", 128, true)!;
    if (itemKeys.has(key)) throw new Error("itemKey가 중복됩니다: " + key);
    itemKeys.add(key);
  }
  const items: ActionImportItem[] = batch.items.map(raw => {
    const item = object(raw, "items");
    const itemKey = item.itemKey as string;
    try {
      keys(item, ["itemKey", "sourceNamespace", "externalKey", "text", "kind", "schedule", "source"], itemKey);
      const text = string(item.text, "text", 500, true)!;
      if (!ACTION_KINDS.includes(item.kind as TaskActionFields["kind"])) throw new InputError("kind", "지원하지 않는 일정 종류입니다.");
      const schedule = object(item.schedule, "schedule");
      keys(schedule, [...dates, ...times, "timeZone"], "schedule");
      const source = object(item.source, "source");
      keys(source, ["type", "url", "label", "excerpt", "reportedCheckedAt", "dateReference"], "source");
      if (source.type !== "USER_STATEMENT" && source.type !== "EXTERNAL_NOTICE") throw new InputError("source.type", "근거 종류를 확인해 주세요.");
      const namespace = string(item.sourceNamespace, "sourceNamespace", 80);
      const externalKey = string(item.externalKey, "externalKey", 256)?.normalize("NFC") ?? null;
      if (Boolean(namespace) !== Boolean(externalKey) || (namespace && !/^[a-z0-9][a-z0-9._-]{0,79}$/.test(namespace))) {
        throw new InputError("sourceNamespace", "namespace와 externalKey를 함께 지정하고 namespace에는 소문자 영문·숫자·점·밑줄·하이픈만 사용해 주세요.");
      }
      const url = string(source.url, "source.url", 2048);
      if (url) {
        let valid = false;
        try { valid = ["https:", "http:"].includes(new URL(url).protocol); } catch { /* invalid URL */ }
        if (!valid) throw new InputError("source.url", "http 또는 https 주소가 필요합니다.");
      }
      const reported = string(source.reportedCheckedAt, "source.reportedCheckedAt", 64);
      if (reported && (!/T.*(?:Z|[+-]\d{2}:\d{2})$/.test(reported) || !Number.isFinite(Date.parse(reported)))) throw new InputError("source.reportedCheckedAt", "시간대가 포함된 시각이 필요합니다.");
      let referenceDate: string | null = null;
      let referenceZone: string | null = null;
      if (source.dateReference != null) {
        const reference = object(source.dateReference, "source.dateReference");
        keys(reference, ["baseDate", "timeZone"], "source.dateReference");
        referenceDate = string(reference.baseDate, "source.dateReference.baseDate", 10, true);
        referenceZone = string(reference.timeZone, "source.dateReference.timeZone", 100, true);
        if (!validDate(referenceDate!) || !validTimeZone(referenceZone!)) throw new InputError("source.dateReference", "상대 날짜의 기준일과 시간대를 확인해 주세요.");
      }
      const task: Task = {
        ...createTask(text, 0, ""), ...ACTION_DEFAULTS, kind: item.kind as TaskActionFields["kind"],
        registrationState: "CANDIDATE", origin: "IMPORT", sourceType: source.type,
        verificationStatus: source.type === "USER_STATEMENT" ? "USER_PROVIDED" : "UNVERIFIED",
        sourceNamespace: namespace, externalKey, sourceUrl: url,
        sourceLabel: string(source.label, "source.label", 200), sourceExcerpt: string(source.excerpt, "source.excerpt", 2000),
        sourceReferenceDate: referenceDate, sourceReferenceTimeZone: referenceZone,
        sourceReportedCheckedAt: reported, timeZone: string(schedule.timeZone, "schedule.timeZone", 100, true)!,
      };
      for (const key of [...dates, ...times]) task[key] = string(schedule[key], "schedule." + key, 10);
      validateAction(task);
      return { itemKey, task, issues: [] };
    } catch (error) {
      return { itemKey, task: null, issues: [{ code: error instanceof InputError ? error.code : "INVALID_INPUT", fieldPath: error instanceof InputError ? error.fieldPath : itemKey, message: error instanceof Error ? error.message : "입력을 확인해 주세요." }] };
    }
  });
  const identities = new Map<string, ActionImportItem[]>();
  for (const item of items) if (item.task?.externalKey) {
    const key = JSON.stringify([item.task.sourceNamespace, item.task.externalKey]);
    identities.set(key, [...(identities.get(key) ?? []), item]);
  }
  for (const duplicates of identities.values()) if (duplicates.length > 1) for (const item of duplicates) {
    item.issues.push({ code: "DUPLICATE_IDENTITY", fieldPath: item.itemKey, message: "같은 식별자가 중복됩니다. 입력에서 하나를 남겨 주세요." });
  }
  return { requestId, items };
}
export async function prepareImport(selections: ImportSelection[], ownerScope: string, deviceId: string): Promise<Task[]> {
  return Promise.all(selections.map(async ({ task, state, independent }) => {
    if (!task.externalKey && !independent) throw new Error("식별자가 없는 항목은 독립 일정 생성을 선택해 주세요.");
    const id = task.externalKey ? await actionId(ownerScope, task.sourceNamespace!, task.externalKey) : task.id;
    return { ...task, id, registrationState: state, actionOwnerScope: ownerScope, deviceId };
  }));
}
export function applyImportedTasks(snapshot: LocalDataSnapshot, proposed: Task[], outcomes: ImportOutcome[]): LocalDataSnapshot {
  const tasks = [...snapshot.tasks];
  outcomes.length = 0;
  let order = getNextOrderIndex(tasks);
  for (const task of proposed) {
    const existing = tasks.find(row => row.id === task.id || (task.externalKey && row.actionOwnerScope === task.actionOwnerScope && row.sourceNamespace === task.sourceNamespace && row.externalKey === task.externalKey));
    if (existing) {
      outcomes.push({ taskId: existing.id, text: task.text, outcome: existing.deletedAt ? "DELETED_MATCH" : sameActionContent({ ...task, registrationState: existing.registrationState }, existing) ? "MATCHED" : "REVIEW_REQUIRED" });
    } else {
      validateAction(task);
      tasks.push({ ...task, orderIndex: order++ });
      outcomes.push({ taskId: task.id, text: task.text, outcome: "CREATED" });
    }
  }
  return tasks.length === snapshot.tasks.length ? snapshot : { ...snapshot, tasks };
}
export type ActionEdit = Pick<Task, "text" | "plannedDate" | "dueDate" | "dueTime"> & TaskActionFields;
export function editAction(task: Task, changes: Partial<ActionEdit>, deviceId: string, checkedBy: string, sourceChecked = false): Task {
  const previous = normalizeActionFields(task);
  const protectedKeys = ["origin", "sourceType", "sourceNamespace", "externalKey", "verificationStatus", "sourceCheckedAt", "sourceCheckedBy"] as const;
  for (const key of protectedKeys) if (changes[key] !== undefined && changes[key] !== previous[key]) throw new Error("출처 식별자와 검증 기록은 직접 수정할 수 없습니다.");
  const next: Task = { ...task, ...changes, text: changes.text?.trim() ?? task.text, updatedAt: nextTaskTimestamp(task.updatedAt), deviceId };
  const evidenceKeys: (keyof ActionEdit)[] = ["text", "kind", "dueDate", "dueTime", "windowStartDate", "windowStartTime", "eventStartDate", "eventStartTime", "eventEndDate", "eventEndTime", "timeZone", "sourceType", "sourceUrl", "sourceLabel", "sourceExcerpt", "sourceReferenceDate", "sourceReferenceTimeZone"];
  if (next.sourceType === "EXTERNAL_NOTICE" && evidenceKeys.some(key => changes[key] !== undefined && changes[key] !== task[key])) {
    next.verificationStatus = "UNVERIFIED"; next.sourceCheckedAt = null; next.sourceCheckedBy = null;
  }
  if (sourceChecked) {
    if (next.sourceType !== "EXTERNAL_NOTICE" || !next.sourceUrl || !/^https?:\/\//.test(next.sourceUrl)) throw new Error("출처 주소를 먼저 확인해 주세요.");
    next.verificationStatus = "SOURCE_CHECKED"; next.sourceCheckedAt = next.updatedAt; next.sourceCheckedBy = checkedBy;
  }
  if (next.registrationState === "CANDIDATE") next.isDone = false;
  validateAction(next);
  return next;
}
