import { describe, expect, it } from "vitest";
import { makeNote, makeSnapshot, makeWorkoutRecord } from "./supabase/testFixtures";
import { acknowledgeRevisions, initializeSyncState, parseSyncState, trackLocalChanges } from "./syncState";

const scope = { backend: "https://example.supabase.co", userId: "user-1" };

describe("local sync revisions", () => {
  it("bootstraps legacy current-device rows once and excludes source/foreign-device rows", () => {
    const legacy = makeSnapshot({ notes: [makeNote(), makeNote({ id: "foreign", deviceId: "device-b" })], workoutRecords: [makeWorkoutRecord()] });
    const initialized = initializeSyncState(legacy, null, "device-a");
    expect(initialized.syncState?.pending).toEqual([{ collection: "notes", id: "note-1", revision: 1 }]);
    const bound = initializeSyncState(initialized, scope, "device-a");
    expect(bound.syncState?.nextRevision).toBe(1);
    expect(initializeSyncState(bound, scope, "device-a")).toBe(bound);
    expect(() => initializeSyncState(bound, { ...scope, backend: "https://another.supabase.co" }, "device-a")).toThrow("다른 서버/계정");
  });

  it("does not enqueue a recreated equal row or a source-only cache change", () => {
    const initialized = initializeSyncState(makeSnapshot({ notes: [makeNote()] }), scope, "device-a");
    const clean = { ...initialized, syncState: { ...initialized.syncState!, pending: [] } };
    const next = trackLocalChanges(clean, { ...clean, notes: [{ ...clean.notes[0] }], workoutRecords: [makeWorkoutRecord()] }, "device-a");
    expect(next.syncState?.pending).toEqual([]);
    expect(next.syncState?.nextRevision).toBe(1);
    expect(trackLocalChanges(next, next, "device-a")).toBe(next);
  });

  it("coalesces row revisions, keeps exact-revision acknowledgments and marks ownership-taking edits", () => {
    const original = initializeSyncState(makeSnapshot({ notes: [makeNote({ deviceId: "device-b" })] }), scope, "device-a");
    const edited = trackLocalChanges(original, { ...original, notes: [makeNote({ content: "edited", deviceId: "device-a" })] }, "device-a");
    const second = trackLocalChanges(edited, { ...edited, notes: [{ ...edited.notes[0], content: "edited again" }] }, "device-a");
    expect(second.syncState?.pending).toEqual([{ collection: "notes", id: "note-1", revision: 2 }]);
    expect(acknowledgeRevisions(second.syncState!, edited.syncState!.pending).pending).toHaveLength(1);
    expect(acknowledgeRevisions(second.syncState!, second.syncState!.pending).pending).toEqual([]);
  });

  it("fails closed on corrupt metadata instead of silently dropping retry state", () => {
    const state = initializeSyncState(makeSnapshot({ notes: [makeNote()] }), scope, "device-a").syncState!;
    expect(parseSyncState(state)).toEqual(state);
    expect(parseSyncState(undefined)).toBeUndefined();
    for (const invalid of [null, { ...state, version: 2 }, { ...state, nextRevision: 0 },
      { ...state, pending: [...state.pending, ...state.pending] },
      { ...state, pending: [{ collection: "weightRecords", id: "weight", revision: 1 }] },
      { ...state, scope: null, cursor: { epoch: "epoch", revision: "1" } },
      { ...state, cursor: { epoch: "epoch", revision: 1 } }]) {
      expect(() => parseSyncState(invalid)).toThrow("대기열");
    }
  });
});
