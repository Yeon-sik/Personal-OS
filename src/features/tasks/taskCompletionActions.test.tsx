import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createEmptySnapshot } from "../../lib/storage/storageAdapter";
import { initializeSyncState, trackLocalChanges } from "../../lib/sync/syncState";
import type { LocalDataSnapshot } from "../../types";
import { useActionActions, type ActionActions } from "../actions/useActionActions";
import { useTaskActions, type TaskActions } from "./useTaskActions";
import { createTask } from "./taskService";

let renderer: ReactTestRenderer | undefined;
afterEach(() => { if (renderer) act(() => renderer!.unmount()); });
const device = { id: "device-a", name: "Test", lastSeenAt: "2026-11-07T00:00:00Z", appVersion: "1" };
function harness() {
  const task = { ...createTask("복습", 0, device.id, "2026-11-07", null, "2026-11-07"),
    recurrence: { frequency: "DAILY" as const, interval: 1, anchorDate: "2026-11-07" } };
  let snapshot = initializeSyncState({ ...createEmptySnapshot(), tasks: [task] }, { backend: "test", userId: "owner" }, device.id);
  let action!: ActionActions; let actions!: TaskActions;
  const transform = vi.fn((next: LocalDataSnapshot) => next);
  function Harness() {
    const commit = (update: (s: LocalDataSnapshot) => LocalDataSnapshot) => { snapshot = trackLocalChanges(snapshot, update(snapshot), device.id); };
    actions = useTaskActions({ snapshot, device, commitSnapshot: commit, transformTaskSnapshot: transform });
    action = useActionActions({ snapshot, device, userId: "owner", isAuthenticated: true, commitDurably: async update => commit(update), transformTaskSnapshot: transform });
    return null;
  }
  act(() => { renderer = create(<Harness />); });
  return { task, action, actions, current: () => snapshot, transform };
}

describe("completion paths share history and recurrence", () => {
  it("saves action form, planning details and completion in one mutation", async () => {
    const h = harness();
    await h.action.updateAction(h.task.id, h.task.updatedAt, { text: "수정한 복습", description: "노트 읽기", isDone: true });
    expect(h.current().tasks).toHaveLength(2);
    expect(h.current().tasks[0]).toMatchObject({ text: "수정한 복습", description: "노트 읽기", isDone: true });
    expect(h.current().tasks[0].completedAt).toBeTruthy();
    expect(h.current().tasks[1]).toMatchObject({ text: "수정한 복습", description: "노트 읽기", plannedDate: "2026-11-08", isDone: false });
    expect(h.transform).toHaveBeenCalledOnce();
  });
  it("uses the same guarded creation for checkbox completion and rejects a stale retry", async () => {
    const h = harness();
    await h.actions.toggleTask(h.task.id);
    expect(h.current().tasks).toHaveLength(2);
    expect(h.current().tasks[0].completedAt).toBeTruthy();
    await expect(h.actions.toggleTask(h.task.id)).rejects.toThrow("변경되었습니다");
    expect(h.current().tasks).toHaveLength(2);
  });
});
