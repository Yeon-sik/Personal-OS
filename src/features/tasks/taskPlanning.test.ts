import { afterEach, describe, expect, it, vi } from "vitest";
import { createEmptySnapshot } from "../../lib/storage/storageAdapter";
import { initializeSyncState, trackLocalChanges } from "../../lib/sync/syncState";
import type { Task } from "../../types";
import { sameActionContent } from "../actions/actionModel";
import { createTask, updateTask } from "./taskService";
import { editTaskDetails, normalizeTaskPlanningFields, validateTaskPlanning } from "./taskPlanning";
import { applyPreparedTaskTransition, prepareTaskTransition, recurrenceDate } from "./taskRecurrence";

afterEach(() => vi.useRealTimers());
function task(changes: Partial<Task> = {}): Task {
  return { ...createTask("분리수거", 0, "device-a", "2026-01-31", null, "2026-01-31"),
    id: "00000000-0000-4000-8000-000000000001", updatedAt: "2026-01-01T00:00:00.000Z", actionOwnerScope: "owner",
    ...changes };
}
const monthly = { frequency: "MONTHLY" as const, interval: 1, anchorDate: "2026-01-31" };

describe("task planning and occurrence history", () => {
  it("never derives a legacy completion time from an edit timestamp", () => {
    const legacy = task({ isDone: true, completedAt: undefined });
    expect(normalizeTaskPlanningFields(legacy).completedAt).toBeNull();
    expect(updateTask(legacy, { text: "제목 수정" }, "device-b").completedAt).toBeUndefined();
    expect(updateTask(legacy, { isDone: true }, "device-b").completedAt).toBeNull();
  });
  it("records completion, keeps it on ordinary edits, and clears it only when reopened", () => {
    vi.useFakeTimers(); vi.setSystemTime(new Date("2026-02-01T03:00:00Z"));
    const done = updateTask(task(), { isDone: true }, "device-a");
    expect(done.completedAt).toBe("2026-02-01T03:00:00.000Z");
    expect(updateTask(done, { text: "이름 변경" }, "device-a").completedAt).toBe(done.completedAt);
    expect(updateTask(done, { isDone: false }, "device-a").completedAt).toBeNull();
  });
  it("uses the actual action time even when the conflict clock is ahead", async () => {
    vi.useFakeTimers(); vi.setSystemTime(new Date("2026-02-01T03:00:00Z"));
    const original = task({ updatedAt: "2026-03-01T00:00:00.000Z", recurrence: monthly });
    const done = updateTask(original, { isDone: true }, "a");
    expect(done.completedAt).toBe("2026-02-01T03:00:00.000Z");
    expect(done.updatedAt).toBe("2026-03-01T00:00:00.001Z");
    const skipped = await prepareTaskTransition(original, "SKIP", "a", "owner");
    expect(skipped.task.skippedAt).toBe("2026-02-01T03:00:00.000Z");
    expect(skipped.nextTask!.createdAt).toBe("2026-02-01T03:00:00.000Z");
  });
  it("uses the original month-end anchor and keeps a biweekly weekday", () => {
    expect([0, 1, 2, 3].map(n => recurrenceDate(monthly, n))).toEqual(["2026-01-31", "2026-02-28", "2026-03-31", "2026-04-30"]);
    expect(recurrenceDate({ frequency: "WEEKLY", interval: 2, anchorDate: "2026-11-02" }, 2)).toBe("2026-11-30");
  });
  it("creates one stable next occurrence across devices and queues a guarded insert", async () => {
    const original = task({ recurrence: monthly, description: "준비물", category: "집", checklist: [{ id: "one", text: "상자 접기", isDone: true }], projectActionId: "project-action" });
    const first = await prepareTaskTransition(original, "COMPLETE", "device-a", "owner");
    const second = await prepareTaskTransition(original, "COMPLETE", "device-b", "owner");
    expect(first.nextTask!.id).toBe(second.nextTask!.id);
    expect(first.task.completedAt).not.toBeNull();
    expect(first.nextTask).toMatchObject({ plannedDate: "2026-02-28", dueDate: "2026-02-28", isDone: false,
      completedAt: null, skippedAt: null, description: "준비물", category: "집", recurrenceSeriesId: original.id,
      recurrenceOccurrence: 1, projectActionId: null, checklist: [{ id: "one", text: "상자 접기", isDone: false }] });
    const initial = initializeSyncState({ ...createEmptySnapshot(), tasks: [original] }, { backend: "test", userId: "owner" }, "device-a");
    const next = trackLocalChanges(initial, applyPreparedTaskTransition(initial, first), "device-a");
    expect(next.syncState!.pending.find(row => row.id === first.nextTask!.id)).toMatchObject({ operation: "ENSURE_ACTION", initialTask: expect.objectContaining({ id: first.nextTask!.id, externalKey: first.nextTask!.externalKey }) });
    expect(applyPreparedTaskTransition(next, second).tasks).toHaveLength(2);
  });
  it("preserves an edited or deleted next occurrence and never resurrects its ID", async () => {
    const original = task({ recurrence: monthly });
    const prepared = await prepareTaskTransition(original, "COMPLETE", "device-a", "owner");
    for (const existing of [{ ...prepared.nextTask!, text: "수정한 다음 회차" }, { ...prepared.nextTask!, deletedAt: "2026-02-01T00:00:00Z" }]) {
      const next = applyPreparedTaskTransition({ ...createEmptySnapshot(), tasks: [original, existing] }, prepared);
      expect(next.tasks).toHaveLength(2);
      expect(next.tasks.find(row => row.id === existing.id)).toBe(existing);
    }
  });
  it("preserves skip history and existing future work when reopening", async () => {
    const original = task({ recurrence: monthly });
    const skipped = await prepareTaskTransition(original, "SKIP", "device-a", "owner");
    expect(skipped.task.isDone).toBe(false);
    expect(skipped.task.skippedAt).not.toBeNull();
    expect(skipped.task.completedAt).toBeNull();
    const snapshot = applyPreparedTaskTransition({ ...createEmptySnapshot(), tasks: [original] }, skipped);
    const reopened = await prepareTaskTransition(skipped.task, "REOPEN", "device-a", "owner");
    const result = applyPreparedTaskTransition(snapshot, reopened);
    expect(result.tasks).toHaveLength(2);
    expect(result.tasks[0]).toMatchObject({ isDone: false, completedAt: null, skippedAt: null });
    expect(result.tasks[1]).toBe(snapshot.tasks[1]);
  });
  it("never carries external verification to generated dates", async () => {
    const prepared = await prepareTaskTransition(task({ recurrence: monthly, sourceType: "EXTERNAL_NOTICE",
      verificationStatus: "SOURCE_CHECKED", sourceCheckedAt: "2026-01-01T00:00:00Z", sourceCheckedBy: "owner" }), "COMPLETE", "device-a", "owner");
    expect(prepared.nextTask).toMatchObject({ verificationStatus: "UNVERIFIED", sourceCheckedAt: null, sourceCheckedBy: null });
  });
  it("rejects undated repeats and malformed checklist identifiers", () => {
    expect(() => editTaskDetails(task({ plannedDate: null, dueDate: null }), { recurrence: monthly }, [], "a")).toThrow("먼저 지정");
    expect(() => editTaskDetails(task(), { checklist: [{ id: "x", text: "첫째", isDone: false }, { id: "x", text: "둘째", isDone: false }] }, [], "a")).toThrow("식별자");
    expect(() => validateTaskPlanning(task({ recurrence: { ...monthly, interval: 0 } }))).toThrow("반복 주기");
  });
  it("blocks completion of candidates or tombstones", async () => {
    await expect(prepareTaskTransition(task({ registrationState: "CANDIDATE" }), "COMPLETE", "a", "owner")).rejects.toThrow("후보");
    await expect(prepareTaskTransition(task({ deletedAt: "2026-01-01T00:00:00Z" }), "COMPLETE", "a", "owner")).rejects.toThrow("삭제");
  });
  it("keeps previously generated work when recurrence rules are edited", async () => {
    const original = task({ recurrence: monthly });
    const prepared = await prepareTaskTransition(original, "COMPLETE", "a", "owner");
    expect(() => editTaskDetails(prepared.task, { recurrence: null }, [prepared.task, prepared.nextTask!], "a")).toThrow("다음 회차");
    const edited = editTaskDetails(prepared.nextTask!, { recurrence: { ...monthly, anchorDate: "2026-02-28", frequency: "DAILY" } }, [prepared.task, prepared.nextTask!], "a");
    expect(edited.recurrenceSeriesId).toBe(prepared.nextTask!.id);
    expect(edited.recurrenceOccurrence).toBe(0);
  });
  it("compares absent planning fields to defaults while detecting real differences", () => {
    const original = task();
    expect(sameActionContent(original, { ...original, ...normalizeTaskPlanningFields({}) })).toBe(true);
    expect(sameActionContent(original, { ...original, description: "추가 메모" })).toBe(false);
  });
});
