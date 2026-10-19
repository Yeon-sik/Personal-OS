import { describe, expect, it } from "vitest";
import { createEmptySnapshot } from "../../lib/storage/storageAdapter";
import { initializeSyncState, trackLocalChanges } from "../../lib/sync/syncState";
import { pushSnapshotChanges } from "../../lib/sync/supabase/deltaPush";
import { reconcilePush } from "../../lib/sync/syncReconciliation";
import { taskToRow } from "../../lib/sync/supabase/mappers";
import type { SnapshotTransport } from "../../lib/sync/supabase/snapshotIo";
import type { TaskRow } from "../../lib/sync/supabase/rows";
import { makeTask } from "../../lib/sync/supabase/testFixtures";
import { ACTION_DEFAULTS } from "./actionModel";

const device = { id: "device-a", name: "Test", lastSeenAt: "2026-10-18T00:00:00Z", appVersion: "1" };
const task = makeTask({ ...ACTION_DEFAULTS, sourceNamespace: "test", externalKey: "exam", actionOwnerScope: "owner", kind: "EXAM", eventStartDate: "2027-03-01", origin: "IMPORT", sourceType: "EXTERNAL_NOTICE", verificationStatus: "UNVERIFIED" });
function pending() {
  const base = initializeSyncState(createEmptySnapshot(), { backend: "test", userId: "owner" }, device.id);
  return trackLocalChanges(base, { ...base, tasks: [task] }, device.id);
}
function transport(existing?: TaskRow) {
  const rows = new Map<string, TaskRow>();
  if (existing) rows.set(existing.id, existing);
  let upserts = 0;
  const api: SnapshotTransport = {
    selectRows: async () => ({ data: [], error: null }),
    upsertRows: async table => { if (table === "tasks") upserts++; return { error: null }; },
    ensureAction: async row => { if (!rows.has(row.id)) rows.set(row.id, row); return { data: [rows.get(row.id)!], error: null }; },
  };
  return { api, rows, upserts: () => upserts };
}
describe("action creation reconciliation", () => {
  it("treats equivalent source timestamps returned by PostgreSQL as the same content", async () => {
    const base = initializeSyncState(createEmptySnapshot(), { backend: "test", userId: "owner" }, device.id);
    const local = { ...task, sourceReportedCheckedAt: "2026-10-18T10:00:00+09:00" };
    const state = trackLocalChanges(base, { ...base, tasks: [local] }, device.id);
    const remote = transport(taskToRow({ ...local, sourceReportedCheckedAt: "2026-10-18T01:00:00+00:00" }, "owner"));
    const result = await pushSnapshotChanges(remote.api, state, { device, userId: "owner" }, device.lastSeenAt);
    expect(result.error).toBeNull();
    expect(reconcilePush(state, result.snapshot, result.acknowledged).syncState!.pending).toHaveLength(0);
  });
  it("uses insert-or-find, never the ordinary task upsert, and clears a confirmed revision", async () => {
    const state = pending(), remote = transport();
    const result = await pushSnapshotChanges(remote.api, state, { device, userId: "owner" }, device.lastSeenAt);
    expect(result.error).toBeNull();
    expect(remote.upserts()).toBe(0);
    expect(remote.rows.size).toBe(1);
    expect(reconcilePush(state, result.snapshot, result.acknowledged).syncState?.pending).toHaveLength(0);
  });
  it("keeps post-create edits dirty after receiving the frozen initial payload", async () => {
    const state = pending();
    const edited = trackLocalChanges(state, { ...state, tasks: [{ ...task, text: "내 수정", updatedAt: "2026-10-19T00:00:00Z" }] }, device.id);
    const remote = transport();
    const result = await pushSnapshotChanges(remote.api, edited, { device, userId: "owner" }, device.lastSeenAt);
    const next = reconcilePush(edited, result.snapshot, result.acknowledged);
    expect(next.tasks[0].text).toBe("내 수정");
    expect(next.syncState?.pending).toHaveLength(1);
    expect(next.syncState?.pending[0].operation).toBeUndefined();
  });
  it("preserves conflicting server content and local proposal, including a remote tombstone", async () => {
    const state = pending(), remote = transport(taskToRow({ ...task, text: "서버에서 수정", deletedAt: "2026-10-17T00:00:00Z" }, "owner"));
    const result = await pushSnapshotChanges(remote.api, state, { device, userId: "owner" }, device.lastSeenAt);
    expect(result.error).toBeTruthy();
    const next = reconcilePush(state, result.snapshot, result.acknowledged);
    expect(next.tasks[0].text).toBe(task.text);
    expect(next.tasks[0].deletedAt).toBeNull();
    expect(next.syncState?.pending[0].conflictTask?.text).toBe("서버에서 수정");
    expect(next.syncState?.pending[0].conflictTask?.deletedAt).toBeTruthy();
    expect(remote.upserts()).toBe(0);
  });
  it("retries a lost ensure response without replacing a row", async () => {
    const state = pending(), remote = transport();
    const actual = remote.api.ensureAction!;
    remote.api.ensureAction = async row => { await actual(row); return { data: null, error: new Error("response lost") }; };
    const failed = await pushSnapshotChanges(remote.api, state, { device, userId: "owner" }, device.lastSeenAt);
    expect(failed.acknowledged).toHaveLength(0);
    remote.api.ensureAction = actual;
    const retry = await pushSnapshotChanges(remote.api, state, { device, userId: "owner" }, device.lastSeenAt);
    expect(retry.error).toBeNull(); expect(remote.rows.size).toBe(1);
  });
  it("keeps local-only identity on device without blocking account actions", async () => {
    const state = pending(); state.tasks[0] = { ...task, actionOwnerScope: "local:device-a" };
    const account = { ...task, id: "account-action", externalKey: "another-exam" };
    const withAccount = trackLocalChanges(state, { ...state, tasks: [...state.tasks, account] }, device.id);
    const remote = transport();
    const result = await pushSnapshotChanges(remote.api, withAccount, { device, userId: "owner" }, device.lastSeenAt);
    expect(result.error).toBeNull(); expect(remote.rows.size).toBe(1);
    expect(remote.rows.has(account.id)).toBe(true);
    expect(reconcilePush(withAccount, result.snapshot, result.acknowledged).syncState!.pending.map(item => item.id)).toEqual([task.id]);
  });
  it("rejects an action that belongs to another account", async () => {
    const state = pending(); state.tasks[0] = { ...task, actionOwnerScope: "other-account" };
    const remote = transport();
    const result = await pushSnapshotChanges(remote.api, state, { device, userId: "owner" }, device.lastSeenAt);
    expect(result.error).toBeTruthy(); expect(remote.rows.size).toBe(0);
  });
});
