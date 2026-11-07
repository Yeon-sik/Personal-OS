import { Temporal } from "@js-temporal/polyfill";
import type { LocalDataSnapshot, Task, TaskRecurrence } from "../../types";
import { actionId } from "../actions/actionIdentity";
import { taskCompletionFields, validateTaskPlanning } from "./taskPlanning";

export type TaskTransition = "COMPLETE" | "REOPEN" | "SKIP";
export interface PreparedTaskTransition { task: Task; nextTask?: Task; }

export function recurrenceDate(rule: TaskRecurrence, occurrence: number): string {
  if (!Number.isSafeInteger(occurrence) || occurrence < 0) throw new Error("반복 회차가 올바르지 않습니다.");
  const anchor = Temporal.PlainDate.from(rule.anchorDate);
  const count = rule.interval * occurrence;
  return (rule.frequency === "MONTHLY" ? anchor.add({ months: count }, { overflow: "constrain" })
    : anchor.add({ days: count * (rule.frequency === "WEEKLY" ? 7 : 1) })).toString();
}

async function nextRecurringTask(task: Task, deviceId: string, ownerScope: string, at: string, occurredAt: string): Promise<Task> {
  const rule = task.recurrence!;
  const occurrence = (task.recurrenceOccurrence ?? 0) + 1;
  const series = task.recurrenceSeriesId ?? task.id;
  const date = Temporal.PlainDate.from(recurrenceDate(rule, occurrence));
  const primaryDate = Temporal.PlainDate.from(task.plannedDate ?? task.dueDate ?? task.eventStartDate!);
  const shift = (value: string | null | undefined) => value ? date.add({ days: primaryDate.until(Temporal.PlainDate.from(value)).days }).toString() : null;
  const namespace = "personal-os.recurrence";
  const key = `${series}/${occurrence}`;
  return {
    ...task,
    id: await actionId(ownerScope, namespace, key), actionOwnerScope: ownerScope,
    createdAt: occurredAt, updatedAt: at, deletedAt: null, deviceId,
    isDone: false, completedAt: null, skippedAt: null,
    plannedDate: shift(task.plannedDate), dueDate: shift(task.dueDate),
    windowStartDate: shift(task.windowStartDate), eventStartDate: shift(task.eventStartDate), eventEndDate: shift(task.eventEndDate),
    recurrenceSeriesId: series, recurrenceOccurrence: occurrence,
    checklist: (task.checklist ?? []).map(item => ({ ...item, isDone: false })),
    projectActionId: null,
    isBackfilled: false, backfilledAt: null, backfillReason: null,
    origin: "MANUAL", sourceNamespace: namespace, externalKey: key,
    // A repeated date is a new proposal, never a freshly verified external notice.
    verificationStatus: task.sourceType === "EXTERNAL_NOTICE" ? "UNVERIFIED" : "USER_PROVIDED",
    sourceCheckedAt: null, sourceCheckedBy: null, sourceReportedCheckedAt: null,
    sourceReferenceDate: null, sourceReferenceTimeZone: null,
  };
}

export async function prepareTaskTransition(task: Task, transition: TaskTransition, deviceId: string, ownerScope: string): Promise<PreparedTaskTransition> {
  if (task.deletedAt || task.registrationState === "CANDIDATE") throw new Error("삭제되었거나 후보 상태인 일정은 완료·건너뛰기 할 수 없습니다.");
  if (transition === "SKIP" && !task.recurrence) throw new Error("반복 할 일만 이번 회차를 건너뛸 수 있습니다.");
  validateTaskPlanning(task);
  if ((transition === "COMPLETE" && task.isDone) || (transition === "SKIP" && task.skippedAt) ||
      (transition === "REOPEN" && !task.isDone && !task.skippedAt)) return { task };
  const occurredAt = new Date().toISOString();
  const at = new Date(Math.max(Date.now(), Date.parse(task.updatedAt) + 1)).toISOString();
  const updated: Task = {
    ...task, updatedAt: at, deviceId,
    isDone: transition === "COMPLETE",
    ...(transition === "SKIP" ? { completedAt: null, skippedAt: occurredAt } : taskCompletionFields(task, transition === "COMPLETE", occurredAt)),
    ...(task.recurrence ? { recurrenceSeriesId: task.recurrenceSeriesId ?? task.id, recurrenceOccurrence: task.recurrenceOccurrence ?? 0 } : {}),
  };
  if (transition !== "REOPEN" && task.recurrence) {
    return { task: updated, nextTask: await nextRecurringTask(updated, deviceId, ownerScope, at, occurredAt) };
  }
  return { task: updated };
}

/** Retains both edited and deleted next occurrences; never replaces an existing ID. */
export function applyPreparedTaskTransition(snapshot: LocalDataSnapshot, prepared: PreparedTaskTransition): LocalDataSnapshot {
  const tasks = snapshot.tasks.map(row => row.id === prepared.task.id ? prepared.task : row);
  if (prepared.nextTask && !tasks.some(row => row.id === prepared.nextTask!.id)) {
    const maxOrder = tasks.reduce((value, row) => Math.max(value, row.orderIndex), -1);
    tasks.push({ ...prepared.nextTask, orderIndex: maxOrder + 1 });
  }
  return { ...snapshot, tasks };
}
