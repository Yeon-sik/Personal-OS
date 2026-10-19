import type { LocalDataSnapshot } from "../../../types";
import { createEmptySnapshot } from "../../storage/storageAdapter";
import type { SyncContext } from "../syncTypes";
import { revisionKey, type PendingRevision } from "../syncState";
import { createPushPayload, mapTableRows, pushBatches, type SnapshotTransport } from "./snapshotIo";
import { taskFromRow, taskToRow } from "./mappers";
import { sameActionContent } from "../../../features/actions/actionModel";

// Keep the matching confirmation GET below common URL limits for UUID keys.
export const WRITE_BATCH_SIZE = 200;

// A partial snapshot must not replace the source-owned collections.
export function emptyIncomingSnapshot(): LocalDataSnapshot {
  return {
    ...createEmptySnapshot(),
    fitnessSharedWorkoutRecords: undefined,
    fitnessWeightRecords: undefined,
    fitnessNutritionSummaries: undefined,
  };
}

export async function pushSnapshotChanges(
  transport: SnapshotTransport,
  snapshot: LocalDataSnapshot,
  context: SyncContext,
  now: string,
) {
  const payload = createPushPayload(snapshot, context, now);
  const batches = pushBatches(payload);
  const pending = new Map(snapshot.syncState!.pending.map((item) => [revisionKey(item), item]));
  // Device-only actions wait for explicit account adoption. They must not
  // prevent unrelated account data from syncing in the meantime.
  const localOnly = new Set(snapshot.tasks.filter(task => task.actionOwnerScope?.startsWith("local:")).map(task => task.id));
  const acknowledged: PendingRevision[] = [];
  let confirmed = { ...emptyIncomingSnapshot(), syncState: snapshot.syncState };
  let changedRows = 0;
  let error: unknown = null;
  try {
    const available = new Set(batches.flatMap((batch) => batch.rows.map((row) => `${batch.collection}:${row.id}`)));
    if (snapshot.syncState!.pending.some((item) => !available.has(revisionKey(item)))) {
      throw new Error("동기화 대기 행이 없거나 현재 기기 소유가 아닙니다. 로컬 데이터 확인이 필요합니다.");
    }
    if (!batches.some((batch) => batch.rows.length)) {
      return { changedRows, snapshot: confirmed, acknowledged, error };
    }
    const deviceResult = await transport.upsertRows("devices", payload.device, "user_id,id");
    if (deviceResult.error) throw deviceResult.error;
    changedRows++;
    confirmed.devices = [payload.currentDevice];
    for (const item of pending.values()) {
      if (item.collection !== "tasks") continue;
      const task = snapshot.tasks.find(row => row.id === item.id);
      if (localOnly.has(item.id)) continue;
      if (task?.actionOwnerScope && task.actionOwnerScope !== context.userId) {
        throw new Error("로컬 일정을 현재 계정으로 가져온 뒤 동기화해 주세요.");
      }
      if (item.conflictTask) throw new Error("기존 일정과 다른 제안이 있습니다. 달력에서 검토해 주세요.");
      if (item.operation !== "ENSURE_ACTION") continue;
      if (!item.initialTask || !transport.ensureAction) throw new Error("일정 생성 API를 사용할 수 없습니다. DB 마이그레이션을 확인해 주세요.");
      const result = await transport.ensureAction(taskToRow(item.initialTask, context.userId));
      if (result.error) throw result.error;
      const row = result.data?.[0];
      if (!row || row.id !== item.id || row.user_id !== context.userId ||
          row.source_namespace !== item.initialTask.sourceNamespace || row.external_key !== item.initialTask.externalKey) {
        throw new Error("일정의 서버 식별자를 확인하지 못했습니다.");
      }
      const remote = taskFromRow(row);
      acknowledged.push({ ...item, confirmedTask: remote });
      confirmed.tasks.push(remote);
      changedRows++;
      if (!sameActionContent(item.initialTask, remote) && (!task || !sameActionContent(task, remote))) {
        throw new Error("기존 일정과 다른 제안을 보존했습니다. 달력에서 검토해 주세요.");
      }
    }
    for (const batch of batches) {
      const rows = batch.rows.filter(row => pending.get(batch.collection + ":" + row.id)?.operation !== "ENSURE_ACTION" &&
        !(batch.collection === "tasks" && localOnly.has(row.id)))
        .sort((a, b) => a.id.localeCompare(b.id));
      for (let offset = 0; offset < rows.length; offset += WRITE_BATCH_SIZE) {
        const chunk = rows.slice(offset, offset + WRITE_BATCH_SIZE);
        const written = await transport.upsertRows(batch.tableName, chunk, "id");
        if (written.error) throw written.error;
        // LWW can silently reject an old UPDATE. Confirmation must read the
        // actual rows even when upsert returned HTTP success or no rows.
        const read = await transport.selectRows<{ id: string; user_id: string; updated_at: string }>(
          batch.tableName, context.userId, { ids: chunk.map((row) => row.id) },
        );
        if (read.error) throw read.error;
        const byId = new Map((read.data ?? []).map((row) => [row.id, row]));
        if (chunk.some((row) => {
          const server = byId.get(row.id);
          const sentTime = Date.parse(row.updated_at);
          const serverTime = server && Date.parse(server.updated_at);
          return !server || server.user_id !== context.userId || !Number.isFinite(sentTime) ||
            !Number.isFinite(serverTime) || serverTime! < sentTime;
        })) throw new Error(`${batch.tableName}: 전송한 행의 서버 확정값을 확인하지 못했습니다.`);
        const mapped = mapTableRows(batch.tableName, chunk.map((row) => byId.get(row.id)!));
        confirmed = { ...confirmed, [batch.collection]: [...confirmed[batch.collection], ...mapped[batch.collection]!] };
        // A newer Task timestamp can be ownership-migration metadata rather
        // than a newer user edit. Preserve both versions for existing review
        // instead of acknowledging away a different offline Task silently.
        const remoteTasks = new Map((mapped.tasks ?? []).map(task => [task.id, task]));
        acknowledged.push(...chunk.map((row) => ({
          ...pending.get(`${batch.collection}:${row.id}`)!,
          ...(batch.collection === "tasks" ? { confirmedTask: remoteTasks.get(row.id)! } : {}),
        })));
        changedRows += chunk.length;
        if (batch.collection === "tasks" && chunk.some(row => {
          const local = snapshot.tasks.find(task => task.id === row.id)!;
          return !sameActionContent(local, remoteTasks.get(row.id)!);
        })) throw new Error("기존 일정과 다른 제안을 보존했습니다. 달력에서 검토해 주세요.");
      }
    }
  } catch (caught) {
    // Earlier confirmed chunks remain acknowledgeable. Unconfirmed writes
    // stay dirty and retry idempotently after a timeout, failure or restart.
    error = caught;
  }
  return { changedRows, snapshot: confirmed, acknowledged, error };
}
