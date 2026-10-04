import type { LocalDataSnapshot } from "../../types";
import { mergeAuthoritativeSnapshot, mergeSnapshot } from "./supabase/snapshotMerge";
import { mergeEntities } from "./merge";
import type { SyncResult } from "./syncTypes";
import { acknowledgeRevisions, revisionKey, sameScope, WRITE_COLLECTIONS, type PendingRevision } from "./syncState";

function preservePending(
  current: LocalDataSnapshot,
  incoming: LocalDataSnapshot,
  acknowledged: PendingRevision[] = [],
): LocalDataSnapshot {
  const completed = new Map(acknowledged.map((item) => [revisionKey(item), item.revision]));
  const protectedKeys = new Set((current.syncState?.pending ?? [])
    .filter((item) => completed.get(revisionKey(item)) !== item.revision).map(revisionKey));
  return {
    ...incoming,
    ...Object.fromEntries(WRITE_COLLECTIONS.map(([collection]) => [collection,
      incoming[collection].filter((row) => !protectedKeys.has(`${collection}:${row.id}`)),
    ])),
  };
}

function assertSameScope(current: LocalDataSnapshot, incoming: LocalDataSnapshot): void {
  if (incoming.syncState?.scope && current.syncState?.scope && !sameScope(incoming.syncState.scope, current.syncState.scope)) {
    throw new Error("다른 서버/계정의 동기화 커서는 반영할 수 없습니다.");
  }
}

function rebaseSource<T extends { id: string; updatedAt: string }>(
  current: T[] | undefined,
  base: T[] | undefined,
  incoming: T[] | undefined,
): T[] | undefined {
  if (incoming === undefined) return current;
  const before = new Map((base ?? []).map((row) => [row.id, row]));
  const received = new Map(incoming.map((row) => [row.id, row]));
  const latest = new Map((current ?? []).map((row) => [row.id, row]));
  const equal = (a: T | undefined, b: T | undefined) => a === b || JSON.stringify(a) === JSON.stringify(b);
  for (const old of before.values()) {
    if (!received.has(old.id) && equal(latest.get(old.id), old)) latest.delete(old.id);
  }
  for (const row of incoming) {
    const old = before.get(row.id);
    if (equal(row, old)) continue;
    const live = latest.get(row.id);
    // A source may legitimately backdate its clock. Accept its fetched value
    // unless a newer Realtime version arrived after this request started.
    if (live && !equal(live, old) && Date.parse(live.updatedAt) > Date.parse(row.updatedAt)) continue;
    latest.set(row.id, row);
  }
  return [...latest.values()];
}

export function reconcilePull(current: LocalDataSnapshot, pulled: LocalDataSnapshot, base?: LocalDataSnapshot): LocalDataSnapshot {
  assertSameScope(current, pulled);
  if (current.syncState?.cursor && pulled.syncState?.cursor &&
      current.syncState.cursor.epoch === pulled.syncState.cursor.epoch &&
      BigInt(current.syncState.cursor.revision) > BigInt(pulled.syncState.cursor.revision)) return current;
  const next = mergeSnapshot(current, preservePending(current, pulled));
  return {
    ...next,
    ...(base ? {
      fitnessWeightRecords: rebaseSource(current.fitnessWeightRecords, base.fitnessWeightRecords, pulled.fitnessWeightRecords),
      fitnessSharedWorkoutRecords: rebaseSource(current.fitnessSharedWorkoutRecords, base.fitnessSharedWorkoutRecords, pulled.fitnessSharedWorkoutRecords),
      fitnessNutritionSummaries: rebaseSource(current.fitnessNutritionSummaries, base.fitnessNutritionSummaries, pulled.fitnessNutritionSummaries),
    } : {}),
    syncState: current.syncState && {
      ...current.syncState,
      scope: current.syncState.scope ?? pulled.syncState?.scope ?? null,
      cursor: pulled.syncState ? pulled.syncState.cursor : current.syncState.cursor,
    },
  };
}

// Realtime returns a cache plus one changed row, not a completed cursor scan.
// Do not replace unrelated source views or install an older cache checkpoint.
export function reconcileRealtime(current: LocalDataSnapshot, incoming: LocalDataSnapshot): LocalDataSnapshot {
  assertSameScope(current, incoming);
  const next = reconcilePull(current, {
    ...incoming, syncState: current.syncState,
    fitnessWeightRecords: undefined, fitnessNutritionSummaries: undefined, fitnessSharedWorkoutRecords: undefined,
  });
  return { ...next, fitnessWeightRecords: mergeEntities(current.fitnessWeightRecords ?? [], incoming.fitnessWeightRecords ?? []) };
}

export function reconcilePush(
  current: LocalDataSnapshot,
  incoming: LocalDataSnapshot | undefined,
  acknowledged: PendingRevision[] | undefined,
): LocalDataSnapshot {
  if (incoming) assertSameScope(current, incoming);
  // Legacy/injected clients retain the previous authoritative merge contract.
  if (!acknowledged) return incoming ? mergeAuthoritativeSnapshot(current, incoming) : current;
  const next = incoming ? mergeAuthoritativeSnapshot(current, preservePending(current, incoming, acknowledged)) : current;
  return { ...next, syncState: current.syncState && acknowledgeRevisions(current.syncState, acknowledged) };
}

export function reconcileResult(current: LocalDataSnapshot, result: SyncResult): LocalDataSnapshot {
  const next = reconcilePush(current, result.snapshot, result.acknowledged);
  return result.received ? reconcilePull(next, result.received.snapshot, result.received.base) : next;
}
