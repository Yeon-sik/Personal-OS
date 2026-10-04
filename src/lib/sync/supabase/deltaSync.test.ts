import { beforeEach, describe, expect, it } from "vitest";
import { LocalStorageAdapter } from "../../storage/localStorageAdapter";
import { initializeSyncState, trackLocalChanges, type SyncCursor } from "../syncState";
import { reconcilePull, reconcilePush, reconcileResult } from "../syncReconciliation";
import { SupabaseSyncClient } from "../supabaseSyncClient";
import { CHANGE_PAGE_SIZE, pullSnapshotChanges, validateChangePage, type ChangeFeedTransport, type SyncChange } from "./changeFeed";
import { pushSnapshotChanges, WRITE_BATCH_SIZE } from "./deltaPush";
import { createSupabaseSnapshotTransport, pullSnapshotAuthoritative, pushSnapshot } from "./snapshotIo";
import { noteToRow, taskToRow } from "./mappers";
import type { SnapshotTableName, SupabaseClient } from "./rows";
import { makeDevice, makeNote, makeProject, makeProjectAction, makeSnapshot, makeTask } from "./testFixtures";

type Row = { id: string; user_id: string; updated_at?: string; deleted_at?: string | null; date?: string; [field: string]: unknown };
const scope = { backend: "https://example.supabase.co", userId: "user-1" };
const context = { device: makeDevice(), userId: scope.userId, backend: scope.backend };

class Server {
  rows = new Map<SnapshotTableName, Row[]>();
  changes = new Map<string, SyncChange>();
  revision = 0;
  requests: Array<{ method: string; table: string; count: number }> = [];
  writeErrors = new Map<string, Error>();
  readErrors = new Map<string, Error>();
  writeHook?: (table: string, count: number) => Error | undefined;

  set(table: SnapshotTableName, rows: Array<{ id: string; user_id: string }>) {
    this.rows.set(table, structuredClone(rows) as Row[]);
  }
  changed(table: SnapshotTableName, id: string) {
    this.changes.set(`${table}:${id}`, { table_name: table, id, revision: String(++this.revision) });
  }
  feed(): ChangeFeedTransport {
    return {
      getCursor: async () => ({ epoch: "epoch", revision: String(this.revision) }),
      readChanges: async (after, until) => {
        this.requests.push({ method: "feed", table: "feed", count: 0 });
        const upper = until ?? String(this.revision);
        const available = [...this.changes.values()].filter((item) => BigInt(item.revision) > BigInt(after.revision) &&
          BigInt(item.revision) <= BigInt(upper)).sort((a, b) => Number(BigInt(a.revision) - BigInt(b.revision)));
        const page = available.slice(0, CHANGE_PAGE_SIZE);
        return { epoch: "epoch", until_revision: upper, changes: page, has_more: available.length > page.length,
          next_revision: available.length > page.length ? page.at(-1)!.revision : upper };
      },
    };
  }
  apiWithFeed(): SupabaseClient {
    const api = this.api();
    const feed = this.feed();
    const rpcApi = api as unknown as { rpc: (name: string, args?: Record<string, string>) => Promise<unknown> };
    rpcApi.rpc = async (name, args) => ({ data: name === "get_personal_os_sync_cursor_v1" ? await feed.getCursor() :
      await feed.readChanges({ epoch: args!.p_epoch, revision: args!.p_after_revision }, args?.p_until_revision || undefined), error: null });
    return api;
  }
  api(userId = scope.userId): SupabaseClient {
    return {
      auth: {
        onAuthStateChange() {},
        getSession: async () => ({ data: { session: { user: { id: userId } } }, error: null }),
      },
      from: (table: SnapshotTableName) => ({
        upsert: async (value: Row | Row[]) => {
          const batch = Array.isArray(value) ? value : [value];
          this.requests.push({ method: "upsert", table, count: batch.length });
          const error = this.writeErrors.get(table) ?? this.writeHook?.(table, batch.length);
          if (error) return { error };
          const rows = this.rows.get(table) ?? [];
          for (const row of batch) {
            if (row.user_id !== userId) return { error: new Error("RLS denied") };
            const index = rows.findIndex((old) => old.id === row.id && old.user_id === row.user_id);
            const old = rows[index];
            if (!old || !row.updated_at || row.updated_at > old.updated_at! ||
              (row.updated_at === old.updated_at && !old.deleted_at && row.deleted_at)) {
              if (!old) rows.push(structuredClone(row)); else rows[index] = structuredClone(row);
              if (table !== "devices") this.changed(table, row.id);
            }
          }
          this.rows.set(table, rows);
          return { error: null };
        },
        select: () => ({ eq: (_column: string, owner: string) => {
          let filter: { column: string; values: string[] } | undefined;
          const query = {
            in: (column: string, values: string[]) => { filter = { column, values }; return query; },
            order: () => ({ range: async (from: number, to: number) => {
              const rows = (this.rows.get(table) ?? []).filter((row) => row.user_id === userId && row.user_id === owner &&
                (!filter || filter.values.includes(String(row[filter.column])))).sort((a, b) => a.id.localeCompare(b.id));
              const selected = rows.slice(from, to + 1);
              this.requests.push({ method: "select", table, count: selected.length });
              return { data: structuredClone(selected), error: this.readErrors.get(table) ?? null };
            } }),
          };
          return query;
        } }),
      }),
    } as unknown as SupabaseClient;
  }
}

function clean(snapshot = makeSnapshot()) {
  const initialized = initializeSyncState(snapshot, scope, context.device.id);
  return { ...initialized, syncState: { ...initialized.syncState!, pending: [], cursor: { epoch: "epoch", revision: "0" } } };
}

beforeEach(() => {
  const values = new Map<string, string>();
  Object.defineProperty(globalThis, "window", { configurable: true, value: { localStorage: {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
  } } });
});

describe("durable delta sync", () => {
  it("persists offline edits, tombstones and revision together and retries after restart", async () => {
    const server = new Server();
    const original = clean(makeSnapshot({ notes: [makeNote()] }));
    const edited = trackLocalChanges(original, { ...original, notes: [makeNote({ content: "offline", deletedAt: "2026-08-02T00:00:00Z", updatedAt: "2026-08-02T00:00:00Z" })] }, context.device.id);
    const adapter = new LocalStorageAdapter();
    await adapter.save(edited);
    const restarted = await new LocalStorageAdapter().load();
    expect(restarted.syncState?.pending).toHaveLength(1);
    const client = new SupabaseSyncClient({ supabaseUrl: scope.backend, supabaseAnonKey: "public-key",
      dependencies: { createClient: () => server.api(), getOnlineState: () => false } });
    expect((await client.push(restarted, context)).status.mode).toBe("offline");
    expect(server.requests).toHaveLength(0);
    const result = await pushSnapshotChanges(createSupabaseSnapshotTransport(server.api()), restarted, context, "2026-08-03T00:00:00Z");
    await adapter.save(reconcilePush(restarted, result.snapshot, result.acknowledged));
    expect((await adapter.load()).syncState?.pending).toEqual([]);
    expect(server.rows.get("notes")?.[0].deleted_at).not.toBeNull();
  });

  it("preserves an in-flight edit even when its updated_at equals the sent revision", async () => {
    const server = new Server();
    const first = initializeSyncState(makeSnapshot({ notes: [makeNote({ content: "first" })] }), scope, context.device.id);
    const second = trackLocalChanges(first, { ...first, notes: [makeNote({ content: "second" })] }, context.device.id);
    const result = await pushSnapshotChanges(createSupabaseSnapshotTransport(server.api()), first, context, "2026-08-02T00:00:00Z");
    const merged = reconcilePush(second, result.snapshot, result.acknowledged);
    expect(merged.notes[0].content).toBe("second");
    expect(merged.syncState?.pending[0].revision).toBe(2);
    expect(first.syncState?.pending[0].revision).toBe(1);
  });

  it("only retries the failed table after persisting partial success and restarting", async () => {
    const server = new Server();
    server.writeErrors.set("tasks", new Error("interrupted"));
    const dirty = initializeSyncState(makeSnapshot({ notes: [makeNote()], tasks: [makeTask()] }), scope, context.device.id);
    const transport = createSupabaseSnapshotTransport(server.api());
    const first = await pushSnapshotChanges(transport, dirty, context, "2026-08-02T00:00:00Z");
    expect(first.error).toBeInstanceOf(Error);
    expect(first.acknowledged.map((item) => item.collection)).toEqual(["notes"]);
    const adapter = new LocalStorageAdapter();
    await adapter.save(reconcilePush(dirty, first.snapshot, first.acknowledged));
    server.requests = [];
    server.writeErrors.clear();
    const retry = await pushSnapshotChanges(transport, await adapter.load(), context, "2026-08-02T00:00:01Z");
    expect(retry.error).toBeNull();
    expect(server.requests.filter((item) => item.method === "upsert").map((item) => item.table)).toEqual(["devices", "tasks"]);
  });

  it("retains unconfirmed revisions after a successful write and failed confirmation", async () => {
    const server = new Server();
    server.readErrors.set("notes", new Error("read timed out"));
    const dirty = initializeSyncState(makeSnapshot({ notes: [makeNote()] }), scope, context.device.id);
    const result = await pushSnapshotChanges(createSupabaseSnapshotTransport(server.api()), dirty, context, "2026-08-02T00:00:00Z");
    expect(result.acknowledged).toEqual([]);
    expect(reconcilePush(dirty, result.snapshot, result.acknowledged).syncState?.pending).toHaveLength(1);
    server.readErrors.clear();
    const retry = await pushSnapshotChanges(createSupabaseSnapshotTransport(server.api()), dirty, context, "2026-08-02T00:00:01Z");
    expect(retry.acknowledged).toHaveLength(1);
  });

  it("confirms completed chunks without acknowledging a failed later chunk", async () => {
    const server = new Server();
    server.writeHook = (table, count) => table === "notes" && count === 1 ? new Error("second chunk failed") : undefined;
    const dirty = initializeSyncState(makeSnapshot({ notes: Array.from({ length: WRITE_BATCH_SIZE + 1 }, (_, index) => makeNote({ id: `note-${index}` })) }), scope, context.device.id);
    const result = await pushSnapshotChanges(createSupabaseSnapshotTransport(server.api()), dirty, context, "2026-08-02T00:00:00Z");
    expect(result.acknowledged).toHaveLength(WRITE_BATCH_SIZE);
    expect(reconcilePush(dirty, result.snapshot, result.acknowledged).syncState?.pending).toHaveLength(1);
  });

  it("keeps parent-before-child writes and never uploads foreign-device/source rows", async () => {
    const server = new Server();
    const snapshot = initializeSyncState(makeSnapshot({ projects: [makeProject()], projectActions: [makeProjectAction()],
      notes: [makeNote({ deviceId: "other-device" })] }), scope, context.device.id);
    await pushSnapshotChanges(createSupabaseSnapshotTransport(server.api()), snapshot, context, "2026-08-02T00:00:00Z");
    expect(server.requests.filter((item) => item.method === "upsert").map((item) => item.table)).toEqual(["devices", "projects", "project_actions"]);
  });

  it("reconciles an older two-device write with the server winner and propagates deletion", async () => {
    const server = new Server();
    const remote = makeNote({ content: "device B", deviceId: "device-b", updatedAt: "2026-08-03T00:00:00Z" });
    server.set("notes", [noteToRow(remote, scope.userId)]);
    const stale = initializeSyncState(makeSnapshot({ notes: [makeNote({ content: "device A offline" })] }), scope, context.device.id);
    const transport = createSupabaseSnapshotTransport(server.api());
    const pushed = await pushSnapshotChanges(transport, stale, context, "2026-08-04T00:00:00Z");
    const resolved = reconcilePush(stale, pushed.snapshot, pushed.acknowledged);
    expect(resolved.notes[0].content).toBe("device B");
    expect(resolved.syncState?.pending).toEqual([]);
    const deleted = { ...remote, deletedAt: "2026-08-05T00:00:00Z", updatedAt: "2026-08-05T00:00:00Z" };
    server.set("notes", [noteToRow(deleted, scope.userId)]);
    server.changed("notes", deleted.id);
    const receiver = { ...resolved, syncState: { ...resolved.syncState!, cursor: { epoch: "epoch", revision: "0" } } };
    const pulled = await pullSnapshotChanges(transport, server.feed(), receiver, scope.userId);
    expect(pulled.snapshot.notes[0].deletedAt).toBe(deleted.deletedAt);
  });

  it("uses cursor pages independent of equal/backdated client clocks and catches changes across a watermark", async () => {
    const server = new Server();
    const rows = Array.from({ length: CHANGE_PAGE_SIZE + 2 }, (_, index) => noteToRow(makeNote({ id: `id-${index}`, updatedAt: "2000-01-01T00:00:00Z" }), scope.userId));
    server.set("notes", rows);
    rows.forEach((row) => server.changed("notes", row.id));
    const feed = server.feed();
    const originalRead = feed.readChanges;
    let pages = 0;
    feed.readChanges = async (after, until) => {
      const result = await originalRead(after, until);
      if (++pages === 1) server.changed("notes", rows[CHANGE_PAGE_SIZE].id);
      return result;
    };
    const local = clean();
    const result = await pullSnapshotChanges(createSupabaseSnapshotTransport(server.api()), feed, local, scope.userId);
    expect(result.snapshot.syncState?.cursor?.revision).toBe(String(CHANGE_PAGE_SIZE + 2));
    expect(local.syncState.cursor.revision).toBe("0");
    expect(result.snapshot.notes).toHaveLength(CHANGE_PAGE_SIZE + 1);
    const next = await pullSnapshotChanges(createSupabaseSnapshotTransport(server.api()), server.feed(), result.snapshot, scope.userId);
    expect(next.snapshot.notes).toHaveLength(CHANGE_PAGE_SIZE + 2);
    expect(next.snapshot.syncState?.cursor?.revision).toBe(String(CHANGE_PAGE_SIZE + 3));
  });

  it("captures the cursor before initial/full recovery and replays writes during the full read", async () => {
    const server = new Server();
    server.set("notes", [noteToRow(makeNote(), scope.userId)]);
    const local = initializeSyncState(makeSnapshot(), scope, context.device.id);
    const feed = server.feed();
    feed.getCursor = async () => {
      const watermark = { epoch: "epoch", revision: String(server.revision) };
      server.changed("notes", "note-1");
      return watermark;
    };
    const result = await pullSnapshotChanges(createSupabaseSnapshotTransport(server.api()), feed, local, scope.userId);
    expect(result.snapshot.syncState?.cursor?.revision).toBe("0");
    const next = await pullSnapshotChanges(createSupabaseSnapshotTransport(server.api()), server.feed(), result.snapshot, scope.userId);
    expect(next.snapshot.syncState?.cursor?.revision).toBe("1");
  });

  it("refreshes only dirty nutrition dates and removes summaries when the date becomes empty", async () => {
    const server = new Server();
    const summary = { id: "2026-08-01", date: "2026-08-01", contractVersion: 1 as const, mealCount: 1, calories: 500,
      carbsGrams: null, proteinGrams: null, fatGrams: null, updatedAt: "2026-08-01T00:00:00Z" };
    const local = clean(makeSnapshot({ fitnessNutritionSummaries: [summary, { ...summary, id: "2026-08-02", date: "2026-08-02" }] }));
    server.changed("fitness_nutrition_summary_v1", summary.date);
    const result = await pullSnapshotChanges(createSupabaseSnapshotTransport(server.api()), server.feed(), local, scope.userId);
    expect(result.snapshot.fitnessNutritionSummaries?.map((item) => item.date)).toEqual(["2026-08-02"]);
    expect(server.requests.filter((item) => item.method === "select").map((item) => item.table)).toEqual(["fitness_nutrition_summary_v1"]);
  });

  it("retains the cursor for retry when a source query fails, without losing core changes", async () => {
    const server = new Server();
    server.set("notes", [noteToRow(makeNote(), scope.userId)]);
    server.changed("notes", "note-1");
    server.changed("fitness_nutrition_summary_v1", "2026-08-01");
    server.readErrors.set("fitness_nutrition_summary_v1", new Error("view failed"));
    const result = await pullSnapshotChanges(createSupabaseSnapshotTransport(server.api()), server.feed(), clean(), scope.userId);
    expect(result.snapshot.notes).toHaveLength(1);
    expect(result.snapshot.syncState?.cursor?.revision).toBe("0");
    server.readErrors.clear();
    const retried = await pullSnapshotChanges(createSupabaseSnapshotTransport(server.api()), server.feed(), result.snapshot, scope.userId);
    expect(retried.snapshot.syncState?.cursor?.revision).toBe("2");
  });

  it("rejects a foreign account/backend queue before remote I/O and rejects bad cursor boundaries", async () => {
    const server = new Server();
    const client = new SupabaseSyncClient({ supabaseUrl: scope.backend, supabaseAnonKey: "public-key",
      dependencies: { createClient: () => server.api(), getOnlineState: () => true } });
    const other = initializeSyncState(makeSnapshot({ notes: [makeNote()] }), { ...scope, userId: "other" }, context.device.id);
    expect((await client.push(other, context)).status.mode).toBe("error");
    expect(server.requests).toHaveLength(0);
    expect((await client.push(clean(), { ...context, userId: "other" })).status.mode).toBe("offline");
    expect(server.requests).toHaveLength(0);
    const after: SyncCursor = { epoch: "epoch", revision: "9007199254740993" };
    expect(() => validateChangePage({ epoch: "epoch", until_revision: "9007199254740994", next_revision: "9007199254740994",
      has_more: false, changes: [{ table_name: "notes", id: "1", revision: "9007199254740994" }] }, after)).not.toThrow();
    expect(() => validateChangePage({ epoch: "epoch", until_revision: "10", next_revision: "10", has_more: true, changes: [] }, { epoch: "epoch", revision: "0" })).toThrow();
  });

  it("rejects a delayed acknowledgment from another account and invalid pending keys", async () => {
    const server = new Server();
    const original = initializeSyncState(makeSnapshot({ notes: [makeNote()] }), scope, context.device.id);
    const result = await pushSnapshotChanges(createSupabaseSnapshotTransport(server.api()), original, context, "2026-08-02T00:00:00Z");
    const other = { ...original, syncState: { ...original.syncState!, scope: { ...scope, userId: "other" } } };
    expect(() => reconcilePush(other, result.snapshot, result.acknowledged)).toThrow("다른 서버/계정");
    server.requests = [];
    const missing = { ...original, notes: [] };
    expect((await pushSnapshotChanges(createSupabaseSnapshotTransport(server.api()), missing, context, "2026-08-02T00:00:00Z")).error).toBeInstanceOf(Error);
    expect(server.requests).toEqual([]);
  });

  it("uses the facade RPC path for deltas and retains explicit full recovery", async () => {
    const server = new Server();
    server.set("notes", [noteToRow(makeNote(), scope.userId)]);
    server.changed("notes", "note-1");
    const feed = server.feed();
    const rpcCalls: string[] = [];
    const api = server.api();
    const rpcApi = api as unknown as { rpc: (name: string, args?: Record<string, string>) => Promise<unknown> };
    rpcApi.rpc = async (name, args) => {
      rpcCalls.push(name);
      return { data: name === "get_personal_os_sync_cursor_v1" ? await feed.getCursor() :
        await feed.readChanges({ epoch: args!.p_epoch, revision: args!.p_after_revision }, args?.p_until_revision || undefined), error: null };
    };
    const client = new SupabaseSyncClient({ supabaseUrl: scope.backend, supabaseAnonKey: "public-key",
      dependencies: { createClient: () => api, getOnlineState: () => true } });
    const result = await client.pull(clean(), context);
    expect(result.notes).toHaveLength(1);
    expect(result.syncState?.cursor?.revision).toBe("1");
    expect(rpcCalls).toEqual(["read_personal_os_sync_changes_v1"]);
    expect(server.requests.filter((item) => item.method === "select").map((item) => item.table)).toEqual(["notes"]);
    rpcCalls.length = 0;
    server.requests = [];
    await client.pull(result, context, { full: true });
    expect(rpcCalls).toEqual(["get_personal_os_sync_cursor_v1"]);
    expect(server.requests.filter((item) => item.method === "select")).toHaveLength(19);
  });

  it("recovers reset cursors and falls back safely when the new RPC is not installed", async () => {
    const server = new Server();
    const transport = createSupabaseSnapshotTransport(server.api());
    const feed = server.feed();
    feed.readChanges = async () => { throw { message: "PERSONAL_OS_SYNC_CURSOR_RESET_REQUIRED" }; };
    feed.getCursor = async () => ({ epoch: "new-epoch", revision: "0" });
    const recovered = await pullSnapshotChanges(transport, feed, clean(), scope.userId);
    expect(recovered.snapshot.syncState?.cursor).toEqual({ epoch: "new-epoch", revision: "0" });
    feed.getCursor = async () => { throw { code: "PGRST202", message: "missing RPC" }; };
    const fallback = await pullSnapshotChanges(transport, feed, clean(), scope.userId);
    expect(fallback.fallback).toBe(true);
    expect(fallback.snapshot.syncState?.cursor).toBeNull();
  });

  it("does not checkpoint a failed compatibility source even when v2 diagnostics succeed", async () => {
    const server = new Server();
    // A valid v2 row hides the v1 read error in the existing display diagnostic.
    server.set("fitness_summary_projections_v2", [{ id: "session", user_id: scope.userId,
      source_fitness_session_id: "session", date: "2026-08-01", completion_status: "completed", contract_version: 2,
      chest_sets: 1, back_sets: 0, legs_sets: 0, shoulders_sets: 0, abs_sets: 0, triceps_sets: 0, biceps_sets: 0,
      total_duration_seconds: 60, cardio_duration_seconds: null, device_id: "fitness", updated_at: "2026-08-01T00:00:00Z", deleted_at: null } as Row]);
    server.readErrors.set("workout_records", new Error("legacy source failed"));
    const transport = createSupabaseSnapshotTransport(server.api());
    const local = { ...clean(), syncState: { ...clean().syncState, cursor: null } };
    const result = await pullSnapshotChanges(transport, server.feed(), local, scope.userId);
    expect(transport.fitnessReadModels?.workout.state).toBe("connected");
    expect(result.snapshot.syncState?.cursor).toBeNull();
    server.readErrors.clear();
    expect((await pullSnapshotChanges(transport, server.feed(), result.snapshot, scope.userId)).snapshot.syncState?.cursor?.revision).toBe("0");
  });

  it("refreshes only changed sources after a write, retaining nutrition refresh timing and newer local revisions", async () => {
    const server = new Server();
    const summary = { id: "2026-08-01", date: "2026-08-01", contractVersion: 1 as const, mealCount: 1, calories: 500,
      carbsGrams: null, proteinGrams: null, fatGrams: null, updatedAt: "2026-08-01T00:00:00Z" };
    server.set("fitness_nutrition_summary_v1", [{ id: "2026-08-02", user_id: scope.userId, date: "2026-08-02",
      contract_version: 1, meal_count: 1, calories: 600, carbs_grams: null, protein_grams: null, fat_grams: null,
      updated_at: "2026-08-02T00:00:00Z" } as Row]);
    server.changed("fitness_nutrition_summary_v1", "2026-08-01");
    server.changed("fitness_nutrition_summary_v1", "2026-08-02");
    const base = clean(makeSnapshot({ fitnessNutritionSummaries: [summary] }));
    const dirty = trackLocalChanges(base, { ...base, notes: [makeNote()] }, context.device.id);
    const client = new SupabaseSyncClient({ supabaseUrl: scope.backend, supabaseAnonKey: "public-key",
      dependencies: { createClient: () => server.apiWithFeed(), getOnlineState: () => true } });
    const result = await client.push(dirty, context);
    expect(result.status.mode).toBe("synced");
    expect(result.received?.snapshot.syncState?.cursor?.revision).toBe("3");
    const newer = trackLocalChanges(dirty, { ...dirty, notes: [makeNote({ content: "newer local" })] }, context.device.id);
    const resolved = reconcileResult(newer, result);
    expect(resolved.notes[0].content).toBe("newer local");
    expect(resolved.syncState?.pending[0].revision).toBe(2);
    expect(resolved.fitnessNutritionSummaries?.map((row) => row.date)).toEqual(["2026-08-02"]);
    expect(new Set(server.requests.filter((item) => item.method === "select").map((item) => item.table))).toEqual(new Set(["notes", "fitness_nutrition_summary_v1"]));
  });

  it("persists confirmed writes even if the post-write incremental read fails", async () => {
    const server = new Server();
    server.set("tasks", [taskToRow(makeTask(), scope.userId)]);
    server.changed("tasks", "task-1");
    server.readErrors.set("tasks", new Error("delta read failed"));
    const base = clean();
    const dirty = trackLocalChanges(base, { ...base, notes: [makeNote()] }, context.device.id);
    const client = new SupabaseSyncClient({ supabaseUrl: scope.backend, supabaseAnonKey: "public-key",
      dependencies: { createClient: () => server.apiWithFeed(), getOnlineState: () => true } });
    const result = await client.push(dirty, context);
    expect(result.status.mode).toBe("error");
    const resolved = reconcileResult(dirty, result);
    expect(resolved.syncState?.pending).toEqual([]);
    expect(resolved.syncState?.cursor?.revision).toBe("0");
    server.readErrors.clear();
    server.requests = [];
    const pulled = await client.pull(resolved, context);
    expect(pulled.syncState?.cursor?.revision).toBe("2");
    expect(server.requests.some((item) => item.method === "upsert")).toBe(false);
  });

  it("rebases scoped source refreshes on newer realtime rows and ignores older completed cursors", () => {
    const first = { id: "weight-1", date: "2026-08-01", weightKg: 70, sourceApp: "fitness" as const,
      scope: "fitness" as const, metadata: {}, contractVersion: 1 as const, updatedAt: "2026-08-01T00:00:00Z",
      createdAt: "2026-08-01T00:00:00Z", deletedAt: null, deviceId: "fitness", isBackfilled: false, backfilledAt: null, backfillReason: null };
    const base = clean(makeSnapshot({ fitnessWeightRecords: [first, { ...first, id: "weight-2" }] }));
    const live = { ...base, fitnessWeightRecords: [{ ...first, weightKg: 75, updatedAt: "2026-08-03T00:00:00Z" }, { ...first, id: "weight-2" }] };
    const pulled = { ...base, fitnessWeightRecords: [{ ...first, weightKg: 71, updatedAt: "2026-08-02T00:00:00Z" },
      { ...first, id: "weight-2", weightKg: 72, updatedAt: "2000-01-01T00:00:00Z" }],
      syncState: { ...base.syncState, cursor: { epoch: "epoch", revision: "7" } } };
    const resolved = reconcilePull(live, pulled, base);
    expect(resolved.fitnessWeightRecords?.map((row) => row.weightKg)).toEqual([75, 72]);
    expect(reconcilePull(resolved, base, base)).toBe(resolved);
  });

  it("compares actual transport requests and uploaded rows for one edit among N=1000 notes", async () => {
    const server = new Server();
    const notes = Array.from({ length: 1000 }, (_, index) => makeNote({ id: `note-${index}` }));
    server.set("notes", notes.map((row) => noteToRow(row, scope.userId)));
    const transport = createSupabaseSnapshotTransport(server.api());
    const legacy = makeSnapshot({ notes: notes.map((row, index) => index ? row : { ...row, content: "one edit", updatedAt: "2026-08-02T00:00:00Z" }) });
    await pushSnapshot(transport, legacy, context, "2026-08-02T00:00:00Z");
    await pullSnapshotAuthoritative(transport, legacy, scope.userId);
    const before = { requests: server.requests.length, uploadedRows: server.requests.filter((item) => item.method === "upsert").reduce((total, item) => total + item.count, 0) };
    server.requests = [];
    server.set("notes", notes.map((row) => noteToRow(row, scope.userId)));
    server.changes.clear();
    server.revision = 0;
    const base = clean(makeSnapshot({ notes }));
    const delta = trackLocalChanges(base, legacy, context.device.id);
    const client = new SupabaseSyncClient({ supabaseUrl: scope.backend, supabaseAnonKey: "public-key",
      dependencies: { createClient: () => server.apiWithFeed(), getOnlineState: () => true } });
    await client.push(delta, context);
    const after = { requests: server.requests.length, uploadedRows: server.requests.filter((item) => item.method === "upsert").reduce((total, item) => total + item.count, 0) };
    expect(before).toEqual({ requests: 22, uploadedRows: 1001 });
    expect(after).toEqual({ requests: 5, uploadedRows: 2 });
    expect(server.requests.find((item) => item.method === "select")?.count).toBe(1);
    console.info("SYNC_COST N=1000", JSON.stringify({ before, after, entityRows: { before: 1000, after: 1 } }));
    server.requests = [];
    const withoutMigration = new SupabaseSyncClient({ supabaseUrl: scope.backend, supabaseAnonKey: "public-key",
      dependencies: { createClient: () => server.api(), getOnlineState: () => true } });
    await withoutMigration.push(delta, context);
    expect(server.requests).toHaveLength(3);
  });
});
