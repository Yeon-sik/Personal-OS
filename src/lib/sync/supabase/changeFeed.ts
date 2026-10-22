import type { LocalDataSnapshot } from "../../../types";
import type { SyncCursor } from "../syncState";
import { WRITE_COLLECTIONS } from "../syncState";
import { mergeSnapshot } from "./snapshotMerge";
import { emptyIncomingSnapshot } from "./deltaPush";
import { fitnessReadModelStatus, mapTableRows, pullSnapshot, type SnapshotQueryResult, type SnapshotTransport } from "./snapshotIo";
import type { SnapshotTableName, SupabaseClient } from "./rows";

export const CHANGE_PAGE_SIZE = 500;
const ROW_KEY_BATCH_SIZE = 200;
const SOURCES = new Set<SnapshotTableName>([
  ...WRITE_COLLECTIONS.map(([, table]) => table),
  "fitness_summary_projections_v2", "workout_records", "weight_records", "fitness_nutrition_summary_v1",
]);

export interface SyncChange {
  revision: string;
  table_name: SnapshotTableName;
  id: string;
}

export interface ChangePage {
  epoch: string;
  until_revision: string;
  next_revision: string;
  has_more: boolean;
  changes: SyncChange[];
}

export interface ChangeFeedTransport {
  getCursor(): Promise<SyncCursor>;
  readChanges(after: SyncCursor, until?: string): Promise<ChangePage>;
}

interface RpcClient {
  rpc(name: string, args?: Record<string, unknown>): Promise<{ data: unknown; error: unknown }>;
}

function isRevision(value: unknown): value is string {
  return typeof value === "string" && /^\d+$/.test(value);
}

export function validateChangePage(value: unknown, after: SyncCursor, until?: string): ChangePage {
  const page = value as ChangePage;
  if (!page || page.epoch !== after.epoch || !isRevision(page.until_revision) || !isRevision(page.next_revision) ||
      (until !== undefined && page.until_revision !== until) || typeof page.has_more !== "boolean" ||
      !Array.isArray(page.changes) || page.changes.length > CHANGE_PAGE_SIZE ||
      BigInt(page.next_revision) < BigInt(after.revision) || BigInt(page.next_revision) > BigInt(page.until_revision)) {
    throw new Error("증분 동기화 커서 응답이 올바르지 않습니다.");
  }
  let previous = BigInt(after.revision);
  for (const item of page.changes) {
    if (!item || !SOURCES.has(item.table_name) || typeof item.id !== "string" || !item.id ||
        !isRevision(item.revision) || BigInt(item.revision) <= previous || BigInt(item.revision) > BigInt(page.until_revision)) {
      throw new Error("증분 동기화 페이지 순서/소스가 올바르지 않습니다.");
    }
    if (item.table_name === "fitness_nutrition_summary_v1" && !/^\d{4}-\d{2}-\d{2}$/.test(item.id)) {
      throw new Error("영양 요약 변경 날짜가 올바르지 않습니다.");
    }
    previous = BigInt(item.revision);
  }
  if ((page.has_more && (!page.changes.length || page.next_revision !== previous.toString())) ||
      (!page.has_more && page.next_revision !== page.until_revision)) {
    throw new Error("증분 동기화 페이지 경계가 올바르지 않습니다.");
  }
  return page;
}

export function createChangeFeedTransport(client: SupabaseClient): ChangeFeedTransport | undefined {
  const rpcClient = client as unknown as RpcClient;
  if (typeof rpcClient.rpc !== "function") return undefined;
  return {
    async getCursor() {
      const result = await rpcClient.rpc("get_personal_os_sync_cursor_v1");
      if (result.error) throw result.error;
      const cursor = result.data as SyncCursor;
      if (!cursor || typeof cursor.epoch !== "string" || !cursor.epoch || !isRevision(cursor.revision)) {
        throw new Error("동기화 시작 커서를 확인하지 못했습니다.");
      }
      return cursor;
    },
    async readChanges(after, until) {
      const result = await rpcClient.rpc("read_personal_os_sync_changes_v1", {
        p_epoch: after.epoch, p_after_revision: after.revision,
        p_until_revision: until ?? null, p_limit: CHANGE_PAGE_SIZE,
      });
      if (result.error) throw result.error;
      return validateChangePage(result.data, after, until);
    },
  };
}

function requiresFullRecovery(error: unknown): boolean {
  const fields = error as { code?: string; message?: string } | null;
  return fields?.code === "PGRST202" || fields?.code === "42883" ||
    fields?.message?.includes("PERSONAL_OS_SYNC_CURSOR_RESET_REQUIRED") === true;
}

function diagnostics(snapshot: LocalDataSnapshot) {
  const projections = snapshot.fitnessSummaryProjections;
  return {
    workout: fitnessReadModelStatus("workout", projections.length ? "fitness_summary_projections_v2" : "workout_records (Fitness 공유 v1)",
      projections.length ? projections : snapshot.fitnessSharedWorkoutRecords ?? [], null),
    nutrition: fitnessReadModelStatus("nutrition", "fitness_nutrition_summary_v1", snapshot.fitnessNutritionSummaries ?? [], null),
    weight: fitnessReadModelStatus("weight", "weight_records (Fitness-owned)", snapshot.fitnessWeightRecords ?? [], null),
  };
}

async function fullPull(
  transport: SnapshotTransport, feed: ChangeFeedTransport | undefined,
  local: LocalDataSnapshot, userId: string,
) {
  let cursor: SyncCursor | null = null;
  let fallback = !feed;
  if (feed) {
    try { cursor = await feed.getCursor(); }
    catch (error) { if (!requiresFullRecovery(error)) throw error; fallback = true; }
  }
  // Capture the committed watermark BEFORE the full read. Writes during the
  // read remain after this cursor and will be replayed by the next delta pull.
  const next = await pullSnapshot(transport, local, userId);
  const partialFailure = transport.fullPullSourceFailed ||
    Object.values(transport.fitnessReadModels ?? {}).some((status) => status.state === "error");
  return {
    snapshot: { ...next, syncState: local.syncState && { ...local.syncState, cursor: partialFailure ? null : cursor } },
    fallback,
  };
}

export async function pullSnapshotChanges(
  transport: SnapshotTransport, feed: ChangeFeedTransport | undefined,
  local: LocalDataSnapshot, userId: string, full = false,
): Promise<{ snapshot: LocalDataSnapshot; fallback: boolean }> {
  if (full || !feed || !local.syncState?.cursor) return fullPull(transport, feed, local, userId);
  let cursor = local.syncState.cursor;
  let until: string | undefined;
  const keys = new Map<SnapshotTableName, Set<string>>();
  try {
    for (;;) {
      const page = validateChangePage(await feed.readChanges(cursor, until), cursor, until);
      until = page.until_revision;
      for (const change of page.changes) {
        const ids = keys.get(change.table_name) ?? new Set<string>();
        ids.add(change.id);
        keys.set(change.table_name, ids);
      }
      cursor = { epoch: page.epoch, revision: page.next_revision };
      if (!page.has_more) break;
    }
  } catch (error) {
    if (!requiresFullRecovery(error)) throw error;
    return fullPull(transport, feed, local, userId);
  }
  let incoming = emptyIncomingSnapshot();
  const nextDiagnostics = diagnostics(local);
  let partialFailure = false;
  // Core errors still fail the pull. Source failures preserve that source and
  // the OLD cursor, so the same source keys retry after restart/reconnect.
  for (const [table, ids] of keys) {
    const selected: unknown[] = [];
    let readError: unknown = null;
    const values = [...ids];
    for (let offset = 0; offset < values.length; offset += ROW_KEY_BATCH_SIZE) {
      let result: SnapshotQueryResult<{ id: string; user_id: string }>;
      try {
        result = await transport.selectRows(table, userId, table === "fitness_nutrition_summary_v1"
          ? { dates: values.slice(offset, offset + ROW_KEY_BATCH_SIZE) }
          : { ids: values.slice(offset, offset + ROW_KEY_BATCH_SIZE) });
      } catch (error) { result = { data: null, error }; }
      if (result.error) { readError = result.error; break; }
      if ((result.data ?? []).some((row) => row.user_id !== userId || !ids.has(row.id))) {
        throw new Error(`${table}: 다른 계정/범위의 행을 수신했습니다.`);
      }
      selected.push(...result.data ?? []);
    }
    const source = table === "fitness_nutrition_summary_v1" ? "nutrition" :
      table === "weight_records" ? "weight" :
        (table === "fitness_summary_projections_v2" || table === "workout_records") ? "workout" : null;
    if (readError) {
      if (!source) throw readError;
      nextDiagnostics[source] = fitnessReadModelStatus(source, table, null, readError);
      partialFailure = true;
      continue;
    }
    // A missing core/source row is not an acknowledged hard delete. The app's
    // established contract requires soft-delete tombstones to remain readable.
    if (table !== "fitness_nutrition_summary_v1" && selected.length !== ids.size) {
      throw new Error(`${table}: 변경 행 또는 삭제 tombstone이 누락됐습니다. 전체 복구 조회가 필요합니다.`);
    }
    const mapped = mapTableRows(table, selected);
    if (table === "fitness_nutrition_summary_v1") {
      incoming.fitnessNutritionSummaries = [
        ...(local.fitnessNutritionSummaries ?? []).filter((row) => !ids.has(row.date)), ...mapped.fitnessNutritionSummaries!,
      ];
    } else if (table === "weight_records") {
      incoming.fitnessWeightRecords = [
        ...(local.fitnessWeightRecords ?? []).filter((row) => !ids.has(row.id)),
        ...mapped.fitnessWeightRecords!.filter((row) => row.sourceApp === "fitness" && (row.scope === "fitness" || row.scope === "both")),
      ];
    } else if (table === "workout_records") {
      incoming.fitnessSharedWorkoutRecords = [
        ...(local.fitnessSharedWorkoutRecords ?? []).filter((row) => !ids.has(row.id)),
        ...mapped.fitnessSharedWorkoutRecords!.filter((row) => row.sourceApp === "fitness" && row.scope === "both" &&
          row.deletedAt === null && row.metadata?.status === "completed" && row.category.trim().length > 0),
      ];
    } else {
      incoming = { ...incoming, ...mapped };
    }
  }
  const next = mergeSnapshot(local, incoming);
  const finalDiagnostics = diagnostics(next);
  for (const source of ["workout", "nutrition", "weight"] as const) {
    if (nextDiagnostics[source].state === "error") finalDiagnostics[source] = nextDiagnostics[source];
  }
  transport.fitnessReadModels = finalDiagnostics;
  return {
    snapshot: { ...next, syncState: { ...local.syncState, cursor: partialFailure ? local.syncState.cursor : cursor } },
    fallback: false,
  };
}
