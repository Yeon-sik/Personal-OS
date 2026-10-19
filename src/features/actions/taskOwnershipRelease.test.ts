import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { Task } from "../../types";
import { LocalStorageAdapter } from "../../lib/storage/localStorageAdapter";
import { initializeSyncState, trackLocalChanges } from "../../lib/sync/syncState";
import { reconcilePull, reconcilePush } from "../../lib/sync/syncReconciliation";
import { emptyIncomingSnapshot, pushSnapshotChanges } from "../../lib/sync/supabase/deltaPush";
import type { SnapshotTransport } from "../../lib/sync/supabase/snapshotIo";
import type { TaskRow } from "../../lib/sync/supabase/rows";
import { taskFromRow } from "../../lib/sync/supabase/mappers";
import { makeDevice, makeSnapshot, makeTask } from "../../lib/sync/supabase/testFixtures";
import { softDeleteTask } from "../tasks/taskService";
import { ACTION_IMPORT_EXAMPLE } from "./actionExample";
import { applyImportedTasks, editAction, parseActionImport, prepareImport, type ImportOutcome } from "./actionImport";

const owner = "00000000-0000-4000-8000-000000000001";
const other = "00000000-0000-4000-8000-000000000002";
const id = "00000000-0000-4000-8000-000000000011";
const scope = { backend: "https://example.supabase.co", userId: owner };
const windows = { ...scope, device: makeDevice() };
const android = { ...scope, device: makeDevice({ id: "device-b" }) };
const migrations = new URL("../../../supabase/migrations/", import.meta.url);
let db: PGlite;
let forwardPreservedRows: boolean;

async function tasks(taskId?: string): Promise<Task[]> {
  const result = await db.query<{ value: TaskRow }>(
    "select to_jsonb(t) as value from public.tasks t where user_id=$1 and ($2::uuid is null or id=$2) order by id", [owner, taskId ?? null],
  );
  return result.rows.map(row => taskFromRow(row.value));
}
function transport(): SnapshotTransport {
  return {
    async upsertRows(table, values) {
      if (table !== "devices" && table !== "tasks") throw new Error(`Unexpected table ${table}`);
      const rows = Array.isArray(values) ? values : [values];
      const columns = Object.keys(rows[0] as object);
      if (columns.some(column => !/^[a-z_]+$/.test(column))) throw new Error("Invalid fixture column");
      const updates = columns.filter(column => column !== "id").map(column => `${column}=excluded.${column}`).join(",");
      await db.query(`insert into public.${table} select * from jsonb_populate_recordset(null::public.${table},$1)
        on conflict(${table === "devices" ? "user_id,id" : "id"}) do update set ${updates}`, [JSON.stringify(rows)]);
      return { error: null };
    },
    async selectRows<Row>(table: string, user: string, options?: { ids?: string[] }) {
      if (table !== "tasks") throw new Error(`Unexpected table ${table}`);
      const result = await db.query<{ value: Row }>(
        "select to_jsonb(t) as value from public.tasks t where user_id=$1 and id=any($2::uuid[])", [user, options?.ids ?? []],
      );
      return { data: result.rows.map(row => row.value), error: null };
    },
    async ensureAction(row) {
      const result = await db.query<{ value: TaskRow }>("select to_jsonb(t) as value from public.ensure_action_v1($1) t", [row]);
      return { data: result.rows.map(row => row.value), error: null };
    },
  };
}
function offlineSnapshot() {
  return initializeSyncState(makeSnapshot({ tasks: [makeTask({
    id, text: "newer offline user edit", deviceId: "device-b", createdAt: "2000-01-01T00:00:00Z",
    updatedAt: "2000-01-02T00:00:00Z", dueDate: "2027-02-05",
  })] }), scope, android.device.id);
}

beforeAll(async () => {
  db = new PGlite();
  await db.exec(`set time zone 'UTC';
    create role anon; create role authenticated; create schema auth;
    create table auth.users(id uuid primary key); insert into auth.users values('${owner}');
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('test.user_id',true),'')::uuid $$;
    grant usage on schema auth to authenticated,anon; grant execute on function auth.uid() to authenticated,anon;
    create table public.devices(user_id text,id text,name text,last_seen_at timestamptz,app_version text,primary key(user_id,id));
    insert into public.devices values('legacy-owner','device-a','Windows','2000-01-01','1'),('legacy-owner','device-b','Android','2000-01-01','1');
    create table public.tasks(id uuid primary key,user_id text not null,text text not null,is_done boolean not null default false,
      order_index integer not null default 0,due_date date,due_time time,planned_date date,updated_at timestamptz not null,
      deleted_at timestamptz,device_id text not null,created_at timestamptz not null default now(),is_backfilled boolean not null default false,
      backfilled_at timestamptz,backfill_reason text,foreign key(user_id,device_id) references public.devices(user_id,id));
    grant all on public.tasks,public.devices to anon,authenticated;
    insert into public.tasks(id,user_id,text,device_id,created_at,updated_at,due_date) values
      ('${id}','legacy-owner','original server content','device-a','2000-01-01','2000-01-01','2027-02-05');
    insert into public.tasks(id,user_id,text,device_id,created_at,updated_at,deleted_at) values
      ('00000000-0000-4000-8000-000000000012','legacy-owner','deleted before migration','device-a','2000-01-01','2000-01-01','2000-01-01');`);
  const base = readFileSync(new URL("20260910130049_dev_control_v1.sql", migrations), "utf8");
  await db.exec(base.match(/create or replace function public\.prevent_stale_sync_write\(\)[\s\S]*?\$\$;/)![0]);
  await db.exec("create trigger tasks_lww_guard before insert or update on public.tasks for each row execute function public.prevent_stale_sync_write()");
  // Execute the immutable historical migration itself, including its clock bump.
  await db.exec(readFileSync(new URL("20261018133855_action_calendar_v1_1.sql", migrations), "utf8"));
  const before = JSON.stringify((await db.query("select to_jsonb(t) as row from public.tasks t order by id")).rows);
  await db.exec(readFileSync(new URL("20261019161235_guard_task_ownership_content_revision.sql", migrations), "utf8"));
  forwardPreservedRows = before === JSON.stringify((await db.query("select to_jsonb(t) as row from public.tasks t order by id")).rows);
  await db.exec(`insert into auth.users values('${other}');
    insert into public.devices values('${other}','device-a','Other','2000-01-01','1');
    select set_config('test.user_id','${owner}',false);`);
}, 60_000);
beforeEach(async () => { await db.exec("begin"); });
afterEach(async () => { await db.exec("rollback"); });
afterAll(async () => { await db?.close(); });

describe("Task ownership release safety in real local PostgreSQL", () => {
  it("reproduces historical offline-edit loss when the old timestamp-only acknowledgment is used", async () => {
    const offline = offlineSnapshot();
    const remote = (await tasks(id))[0];
    expect(Date.parse(remote.updatedAt)).toBeGreaterThan(Date.parse(offline.tasks[0].updatedAt));
    const result = await pushSnapshotChanges(transport(), offline, android, "2026-10-20T00:00:00Z");
    expect((await tasks(id))[0].text).toBe("original server content"); // Real LWW rejection.
    // The pre-fix response carried only sent revision IDs, and discarded the edit.
    const historical = reconcilePush(offline, result.snapshot, offline.syncState!.pending);
    expect(historical.tasks[0].text).toBe("original server content");
    expect(historical.syncState?.pending).toEqual([]);
  });

  it("retains the offline edit and server version durably and blocks automatic retry until review", async () => {
    const offline = offlineSnapshot();
    const result = await pushSnapshotChanges(transport(), offline, android, "2026-10-20T00:00:00Z");
    expect(result.error).toBeInstanceOf(Error);
    const preserved = reconcilePush(offline, result.snapshot, result.acknowledged);
    expect(preserved.tasks[0].text).toBe("newer offline user edit");
    expect(preserved.syncState?.pending[0].conflictTask?.text).toBe("original server content");
    const values = new Map<string, string>();
    Object.defineProperty(globalThis, "window", { configurable: true, value: { localStorage: {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
    } } });
    await new LocalStorageAdapter().save(preserved);
    const restarted = await new LocalStorageAdapter().load();
    const retry = await pushSnapshotChanges(transport(), restarted, android, "2026-10-20T00:00:01Z");
    expect(retry.error).toBeInstanceOf(Error);
    expect(retry.acknowledged).toEqual([]);
    expect(restarted.tasks[0].text).toBe("newer offline user edit");
  });

  it("also preserves a rejected offline deletion and a newer edit made during upload", async () => {
    const original = offlineSnapshot();
    const deleted = { ...original, tasks: [{ ...original.tasks[0], deletedAt: original.tasks[0].updatedAt }] };
    const result = await pushSnapshotChanges(transport(), deleted, android, "2026-10-20T00:00:00Z");
    const preserved = reconcilePush(deleted, result.snapshot, result.acknowledged);
    expect(preserved.tasks[0].deletedAt).toBeTruthy();
    expect(preserved.syncState?.pending[0].conflictTask?.deletedAt).toBeNull();
    const inFlight = trackLocalChanges(original, { ...original, tasks: [{ ...original.tasks[0], text: "another local edit" }] }, android.device.id);
    const rebased = reconcilePush(inFlight, result.snapshot, result.acknowledged);
    expect(rebased.tasks[0].text).toBe("another local edit");
    expect(rebased.syncState?.pending[0].revision).toBe(2);
  });

  it("adds a forward invariant without rewriting history, and allows metadata-only maintenance", async () => {
    expect(forwardPreservedRows).toBe(true);
    const before = (await db.query<{ row: Record<string, unknown> }>("select to_jsonb(t) as row from public.tasks t where id=$1", [id])).rows[0].row;
    // Model privileged maintenance. The new AFTER guard remains enabled.
    await db.exec("alter table public.tasks disable trigger tasks_action_guard_v1; alter table public.tasks disable trigger tasks_lww_guard; savepoint unsafe_transfer");
    await expect(db.query("update public.tasks set user_id=$1,updated_at=updated_at+interval '1 day' where id=$2", [other, id])).rejects.toThrow(/Ownership metadata must preserve/);
    await db.exec("rollback to unsafe_transfer");
    await db.query("update public.tasks set user_id=$1 where id=$2", [other, id]);
    const after = (await db.query<{ row: Record<string, unknown> }>("select to_jsonb(t) as row from public.tasks t where id=$1", [id])).rows[0].row;
    expect(after).toEqual({ ...before, user_id: other });
    await db.exec("alter table public.tasks enable trigger tasks_action_guard_v1; alter table public.tasks enable trigger tasks_lww_guard");
  });

  it("keeps ordinary account ownership changes forbidden", async () => {
    await db.exec("savepoint account_boundary; set local role authenticated");
    await expect(db.query("update public.tasks set user_id=$1 where id=$2", [other, id])).rejects.toThrow(/immutable|row.level security/);
    await db.exec("rollback to account_boundary");
    expect((await tasks(id))[0].actionOwnerScope).toBe(owner);
  });

  it("simulates the complete two-client create/edit/delete/reimport flow without claiming device verification", async () => {
    const item = parseActionImport(ACTION_IMPORT_EXAMPLE).items[0].task!;
    const proposal = (await prepareImport([{ task: item, state: "CONFIRMED", independent: false }], owner, windows.device.id))[0];
    const empty = initializeSyncState(makeSnapshot(), scope, windows.device.id);
    const outcomes: ImportOutcome[] = [];
    const created = trackLocalChanges(empty, applyImportedTasks(empty, [proposal], outcomes), windows.device.id);
    const sent = await pushSnapshotChanges(transport(), created, windows, "2026-10-20T00:00:00Z");
    expect(sent.error).toBeNull();
    const firstClient = reconcilePush(created, sent.snapshot, sent.acknowledged);
    const secondClient = initializeSyncState(makeSnapshot({ tasks: await tasks(proposal.id) }), scope, android.device.id);
    expect(secondClient.tasks[0].id).toBe(proposal.id);
    const edited = trackLocalChanges(secondClient, { ...secondClient, tasks: [editAction(secondClient.tasks[0], { text: "Android user edit", plannedDate: "2027-02-03" }, android.device.id, owner)] }, android.device.id);
    const editSent = await pushSnapshotChanges(transport(), edited, android, "2026-10-20T00:00:01Z");
    expect(editSent.error).toBeNull();
    const received = reconcilePull(firstClient, { ...emptyIncomingSnapshot(), tasks: await tasks(proposal.id) });
    expect(received.tasks[0].text).toBe("Android user edit");
    expect(applyImportedTasks(received, [proposal], outcomes)).toBe(received);
    expect(outcomes[0].outcome).toBe("REVIEW_REQUIRED");
    const deleted = trackLocalChanges(received, { ...received, tasks: [softDeleteTask(received.tasks[0], windows.device.id)] }, windows.device.id);
    const deleteSent = await pushSnapshotChanges(transport(), deleted, windows, "2026-10-20T00:00:02Z");
    expect(deleteSent.error).toBeNull();
    const synchronized = reconcilePush(deleted, deleteSent.snapshot, deleteSent.acknowledged);
    const retry = await pushSnapshotChanges(transport(), synchronized, windows, "2026-10-20T00:00:03Z");
    expect(retry.error).toBeNull();
    expect((await tasks(proposal.id))[0].deletedAt).toBeTruthy();
    expect(applyImportedTasks(synchronized, [proposal], outcomes)).toBe(synchronized);
    expect(outcomes[0].outcome).toBe("DELETED_MATCH");
    expect((await db.query("select id from public.tasks where source_namespace=$1 and external_key=$2", [proposal.sourceNamespace, proposal.externalKey])).rows).toHaveLength(1);
  });
});
