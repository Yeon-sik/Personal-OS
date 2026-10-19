import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { afterEach, describe, expect, it } from "vitest";
import { createEmptySnapshot } from "../../lib/storage/storageAdapter";
import { initializeSyncState, trackLocalChanges } from "../../lib/sync/syncState";
import type { LocalDataSnapshot } from "../../types";
import { useActionActions, type ActionActions } from "./useActionActions";
import { parseActionImport, prepareImport } from "./actionImport";
import { ACTION_IMPORT_EXAMPLE } from "./actionExample";

const device = { id: "device-a", name: "Test", lastSeenAt: "2026-10-18T00:00:00Z", appVersion: "1" };
const scope = { backend: "test", userId: "owner" };
let renderer: ReactTestRenderer | undefined;
afterEach(() => { if (renderer) act(() => renderer!.unmount()); });
function harness(initial: LocalDataSnapshot, failSave = false) {
  let snapshot = initial;
  let actions!: ActionActions;
  function Harness() {
    actions = useActionActions({ snapshot, device, userId: "owner", isAuthenticated: true,
      commitDurably: async (update, track = true) => {
        const next = track ? trackLocalChanges(snapshot, update(snapshot), device.id) : update(snapshot);
        if (failSave) throw new Error("disk full");
        snapshot = next;
      },
    });
    return null;
  }
  act(() => { renderer = create(<Harness />); });
  return { actions, current: () => snapshot };
}
describe("durable action commands", () => {
  it("does not install imported tasks when persistence fails", async () => {
    const base = initializeSyncState(createEmptySnapshot(), scope, device.id);
    const h = harness(base, true);
    await expect(h.actions.importActions([{ task: parseActionImport(ACTION_IMPORT_EXAMPLE).items[0].task!, state: "CONFIRMED", independent: false }])).rejects.toThrow("disk full");
    expect(h.current()).toBe(base);
  });
  it("accepts the server row without requeueing edits from the same device", async () => {
    const [task] = await prepareImport([{ task: parseActionImport(ACTION_IMPORT_EXAMPLE).items[0].task!, state: "CONFIRMED", independent: false }], "owner", device.id);
    const base = initializeSyncState(createEmptySnapshot(), scope, device.id);
    const state = trackLocalChanges(base, { ...base, tasks: [task] }, device.id);
    const remote = { ...task, text: "서버 수정" };
    state.syncState!.pending[0].conflictTask = remote;
    const h = harness(state);
    await h.actions.resolveActionConflict(task.id, false);
    expect(h.current().tasks[0]).toEqual(remote);
    expect(h.current().syncState!.pending).toHaveLength(0);
  });
  it("adopts local-only external IDs and their pending intent together", async () => {
    const [task] = await prepareImport([{ task: parseActionImport(ACTION_IMPORT_EXAMPLE).items[0].task!, state: "CONFIRMED", independent: false }], "local:device-a", device.id);
    const base = initializeSyncState(createEmptySnapshot(), scope, device.id);
    const h = harness(trackLocalChanges(base, { ...base, tasks: [task] }, device.id));
    await h.actions.adoptLocalActions();
    const adopted = h.current().tasks[0];
    expect(adopted.id).not.toBe(task.id);
    expect(adopted.actionOwnerScope).toBe("owner");
    expect(h.current().syncState!.pending).toEqual([expect.objectContaining({ id: adopted.id, operation: "ENSURE_ACTION", initialTask: adopted })]);
  });
  it("preserves both local proposals and unsynced account edits on adoption collision", async () => {
    const selection = [{ task: parseActionImport(ACTION_IMPORT_EXAMPLE).items[0].task!, state: "CONFIRMED" as const, independent: false }];
    const [local] = await prepareImport(selection, "local:device-a", device.id);
    const [account] = await prepareImport(selection, "owner", device.id);
    const base = initializeSyncState(createEmptySnapshot(), scope, device.id);
    const state = trackLocalChanges(base, { ...base, tasks: [local, { ...account, text: "계정의 미저장 수정" }] }, device.id);
    const h = harness(state);
    await expect(h.actions.adoptLocalActions()).rejects.toThrow("같은 일정");
    expect(h.current()).toBe(state);
  });
  it("keeps a synchronized account version in the conflict review when adopting", async () => {
    const selection = [{ task: parseActionImport(ACTION_IMPORT_EXAMPLE).items[0].task!, state: "CONFIRMED" as const, independent: false }];
    const [local] = await prepareImport(selection, "local:device-a", device.id);
    const [account] = await prepareImport(selection, "owner", device.id);
    const base = initializeSyncState(createEmptySnapshot(), scope, device.id);
    const remote = { ...account, text: "계정에서 수정한 내용" };
    const state = trackLocalChanges(base, { ...base, tasks: [local] }, device.id);
    state.tasks.push(remote);
    const h = harness(state);
    await h.actions.adoptLocalActions();
    expect(h.current().tasks).toHaveLength(1);
    expect(h.current().tasks[0].text).toBe(local.text);
    expect(h.current().syncState!.pending[0].conflictTask).toEqual(remote);
  });
});
