import type { LocalDataSnapshot, SyncableEntity } from "../../types";

// This order also preserves the existing parent -> child write contract.
export const WRITE_COLLECTIONS = [
  ["projects", "projects"],
  ["workstreams", "workstreams"],
  ["notes", "notes"],
  ["tasks", "tasks"],
  ["projectMilestones", "project_milestones"],
  ["projectActions", "project_actions"],
  ["projectIdeas", "project_ideas"],
  ["projectHistory", "project_history"],
  ["workstreamProjects", "workstream_projects"],
  ["workstreamMilestones", "workstream_milestones"],
  ["workstreamActions", "workstream_actions"],
  ["workstreamActionProjects", "workstream_action_projects"],
  ["workstreamActionDependencies", "workstream_action_dependencies"],
  ["knowledgeDocuments", "knowledge_documents"],
] as const;

export type WritableCollection = (typeof WRITE_COLLECTIONS)[number][0];
export type WritableTable = (typeof WRITE_COLLECTIONS)[number][1];

export interface SyncScope {
  backend: string;
  userId: string;
}

export interface PendingRevision {
  collection: WritableCollection;
  id: string;
  revision: number;
}

export interface SyncCursor {
  epoch: string;
  // bigint is transported as text; never round a Postgres cursor in JS.
  revision: string;
}

export interface LocalSyncState {
  version: 1;
  scope: SyncScope | null;
  nextRevision: number;
  pending: PendingRevision[];
  cursor: SyncCursor | null;
}

export function sameScope(a: SyncScope | null, b: SyncScope | null): boolean {
  return a?.backend === b?.backend && a?.userId === b?.userId;
}

export function revisionKey(value: Pick<PendingRevision, "collection" | "id">): string {
  return `${value.collection}:${value.id}`;
}

export function initializeSyncState(
  snapshot: LocalDataSnapshot,
  scope: SyncScope | null,
  deviceId: string,
): LocalDataSnapshot {
  if (snapshot.syncState) {
    if (scope && snapshot.syncState.scope && !sameScope(scope, snapshot.syncState.scope)) {
      throw new Error("로컬 동기화 대기열이 다른 서버/계정에 연결되어 있습니다. 별도 데이터 이전이 필요합니다.");
    }
    return scope && !snapshot.syncState.scope
      ? { ...snapshot, syncState: { ...snapshot.syncState, scope } }
      : snapshot;
  }
  let nextRevision = 0;
  const pending: PendingRevision[] = [];
  for (const [collection] of WRITE_COLLECTIONS) {
    for (const row of snapshot[collection]) {
      if (row.deviceId === deviceId) {
        pending.push({ collection, id: row.id, revision: ++nextRevision });
      }
    }
  }
  // Legacy caches are uploaded once, then use only explicitly changed rows.
  return { ...snapshot, syncState: { version: 1, scope, nextRevision, pending, cursor: null } };
}

export function trackLocalChanges(
  current: LocalDataSnapshot,
  next: LocalDataSnapshot,
  deviceId: string,
): LocalDataSnapshot {
  if (current === next) return current;
  const initialized = initializeSyncState(current, null, deviceId);
  const state = initialized.syncState!;
  const pending = new Map(state.pending.map((item) => [revisionKey(item), item]));
  let nextRevision = state.nextRevision;
  for (const [collection] of WRITE_COLLECTIONS) {
    const before = new Map<string, SyncableEntity>(current[collection].map((row) => [row.id, row]));
    for (const row of next[collection]) {
      if (row.deviceId !== deviceId) continue;
      const previous = before.get(row.id);
      if (previous !== row && JSON.stringify(previous) !== JSON.stringify(row)) {
        if (nextRevision === Number.MAX_SAFE_INTEGER) throw new Error("로컬 동기화 revision 한도를 초과했습니다.");
        const item = { collection, id: row.id, revision: ++nextRevision };
        pending.set(revisionKey(item), item);
      }
    }
  }
  return { ...next, syncState: { ...state, nextRevision, pending: [...pending.values()] } };
}

export function acknowledgeRevisions(
  state: LocalSyncState,
  acknowledged: PendingRevision[],
): LocalSyncState {
  const completed = new Map(acknowledged.map((item) => [revisionKey(item), item.revision]));
  return {
    ...state,
    pending: state.pending.filter((item) => completed.get(revisionKey(item)) !== item.revision),
  };
}

// Persisted metadata is part of the same atomic envelope as the rows. Fail
// closed on corruption: dropping a pending revision would silently lose retry.
export function parseSyncState(value: unknown): LocalSyncState | undefined {
  if (value === undefined) return undefined;
  const state = value as LocalSyncState;
  const collections = new Set<string>(WRITE_COLLECTIONS.map(([collection]) => collection));
  if (!state || state.version !== 1 || !Number.isSafeInteger(state.nextRevision) || state.nextRevision < 0 ||
      !Array.isArray(state.pending) ||
      (state.scope !== null && (!state.scope || typeof state.scope.backend !== "string" || !state.scope.backend ||
        typeof state.scope.userId !== "string" || !state.scope.userId)) ||
      (state.cursor !== null && (!state.scope || !state.cursor || typeof state.cursor.epoch !== "string" ||
        !state.cursor.epoch || typeof state.cursor.revision !== "string" || !/^\d+$/.test(state.cursor.revision))) ||
      state.pending.some((item) => !item || !collections.has(item.collection) || typeof item.id !== "string" || !item.id ||
        !Number.isSafeInteger(item.revision) || item.revision < 1 || item.revision > state.nextRevision) ||
      new Set(state.pending.map(revisionKey)).size !== state.pending.length) {
    throw new Error("저장된 동기화 대기열을 읽을 수 없습니다.");
  }
  return state;
}
