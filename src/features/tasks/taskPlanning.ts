import { Temporal } from "@js-temporal/polyfill";
import type { Task, TaskDetailsChanges, TaskPlanningFields } from "../../types";

/** Defaults never infer a completion date from a legacy row's updatedAt. */
export function normalizeTaskPlanningFields(value: Partial<TaskPlanningFields>): TaskPlanningFields {
  return {
    completedAt: value.completedAt ?? null,
    skippedAt: value.skippedAt ?? null,
    description: value.description ?? "",
    category: value.category ?? null,
    checklist: Array.isArray(value.checklist) ? value.checklist.map(item => item && ({ id: item.id, text: item.text, isDone: item.isDone })) : value.checklist ?? [],
    recurrence: value.recurrence ? { frequency: value.recurrence.frequency, interval: value.recurrence.interval, anchorDate: value.recurrence.anchorDate } : null,
    recurrenceSeriesId: value.recurrenceSeriesId ?? null,
    recurrenceOccurrence: value.recurrenceOccurrence ?? null,
    projectActionId: value.projectActionId ?? null,
  };
}

export function validateTaskPlanning(task: Task): void {
  const fields = normalizeTaskPlanningFields(task);
  for (const value of [fields.completedAt, fields.skippedAt]) {
    if (value !== null && (typeof value !== "string" || !Number.isFinite(Date.parse(value)))) {
      throw new Error("완료·건너뛰기 시각이 올바르지 않습니다.");
    }
  }
  if ((fields.completedAt !== null && !task.isDone) || (fields.skippedAt !== null && task.isDone) ||
      (fields.completedAt !== null && fields.skippedAt !== null)) {
    throw new Error("완료 상태와 건너뛰기 기록이 일치하지 않습니다.");
  }
  if ((fields.recurrenceSeriesId === null) !== (fields.recurrenceOccurrence === null)) {
    throw new Error("반복 일정과 회차 식별자가 일치하지 않습니다.");
  }
  if (typeof fields.description !== "string" ||
      (fields.category !== null && typeof fields.category !== "string") ||
      (fields.projectActionId !== null && (typeof fields.projectActionId !== "string" || !fields.projectActionId))) {
    throw new Error("할 일의 설명·분류·프로젝트 연결을 확인해 주세요.");
  }
  if (!Array.isArray(fields.checklist) || fields.checklist.some(item =>
    !item || typeof item.id !== "string" || !item.id || typeof item.text !== "string" ||
    !item.text.trim() || typeof item.isDone !== "boolean") ||
    new Set(fields.checklist.map(item => item.id)).size !== fields.checklist.length) {
    throw new Error("하위 할 일의 내용과 식별자를 확인해 주세요.");
  }
  if (fields.recurrenceOccurrence !== null &&
      (!Number.isSafeInteger(fields.recurrenceOccurrence) || fields.recurrenceOccurrence < 0)) {
    throw new Error("반복 회차가 올바르지 않습니다.");
  }
  if (fields.recurrenceSeriesId !== null && (typeof fields.recurrenceSeriesId !== "string" || !fields.recurrenceSeriesId)) {
    throw new Error("반복 일정 식별자가 올바르지 않습니다.");
  }
  if (fields.recurrence) {
    const rule = fields.recurrence;
    if (!["DAILY", "WEEKLY", "MONTHLY"].includes(rule.frequency) ||
        !Number.isSafeInteger(rule.interval) || rule.interval < 1 || rule.interval > 365 ||
        typeof rule.anchorDate !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(rule.anchorDate)) {
      throw new Error("반복 주기와 기준 날짜를 확인해 주세요.");
    }
    try { Temporal.PlainDate.from(rule.anchorDate); }
    catch { throw new Error("반복 기준 날짜가 올바르지 않습니다."); }
    if (!task.plannedDate && !task.dueDate && !task.eventStartDate) {
      throw new Error("반복하려면 계획일이나 마감일·시작일을 먼저 지정해 주세요.");
    }
  }
}

export function taskCompletionFields(task: Task, isDone: boolean, at: string): Pick<TaskPlanningFields, "completedAt" | "skippedAt"> {
  if (isDone && (task.deletedAt || task.registrationState === "CANDIDATE")) {
    throw new Error("삭제되었거나 후보 상태인 일정은 완료할 수 없습니다.");
  }
  return {
    completedAt: isDone ? task.isDone ? task.completedAt ?? null : at : null,
    skippedAt: null,
  };
}

export function editTaskDetails(task: Task, changes: TaskDetailsChanges, tasks: Task[], deviceId: string): Task {
  if (task.deletedAt) throw new Error("삭제된 할 일은 먼저 복원해 주세요.");
  const ruleChanged = changes.recurrence !== undefined && JSON.stringify(changes.recurrence) !== JSON.stringify(task.recurrence ?? null);
  const series = task.recurrenceSeriesId ?? task.id;
  if (ruleChanged && tasks.some(row => row.id !== task.id && row.recurrenceSeriesId === series &&
      (row.recurrenceOccurrence ?? 0) > (task.recurrenceOccurrence ?? 0))) {
    throw new Error("이미 다음 회차가 있습니다. 다음 회차에서 반복 규칙을 수정해 주세요. 기존 기록은 유지됩니다.");
  }
  const updated: Task = {
    ...task, ...changes,
    ...(changes.category !== undefined ? { category: changes.category?.trim() || null } : {}),
    ...(changes.checklist ? { checklist: changes.checklist.map(item => ({ ...item, text: item.text.trim() })) } : {}),
    ...(ruleChanged ? { recurrenceSeriesId: changes.recurrence ? task.id : null, recurrenceOccurrence: changes.recurrence ? 0 : null } : {}),
    deviceId, updatedAt: new Date(Math.max(Date.now(), Date.parse(task.updatedAt) + 1)).toISOString(),
  };
  validateTaskPlanning(updated);
  return updated;
}
