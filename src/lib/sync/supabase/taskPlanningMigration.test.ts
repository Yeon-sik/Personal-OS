import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { makeTask } from "./testFixtures";
import { taskFromRow, taskToRow } from "./mappers";
import type { TaskRow } from "./rows";
import { WRITE_COLLECTIONS } from "../syncState";

const owner = "00000000-0000-4000-8000-000000000001";
const other = "00000000-0000-4000-8000-000000000002";
const linkedAction = "00000000-0000-4000-8000-000000000003";
const otherAction = "00000000-0000-4000-8000-000000000004";
const migrations = new URL("../../../../supabase/migrations/", import.meta.url);
const sql = (name: string) => readFileSync(new URL(name, migrations), "utf8");
const newColumns = ["completed_at", "skipped_at", "description", "category", "checklist", "recurrence",
  "recurrence_series_id", "recurrence_occurrence", "project_action_id"];
let db: PGlite;
let originalRows: unknown;
let migrationPreservedRows: unknown;
let sequence = 100;

async function authenticated<T>(user: string, run: () => Promise<T>) {
  await db.query("select set_config('test.user_id',$1,false)", [user]);
  await db.exec("set role authenticated");
  try { return await run(); } finally { await db.exec("reset role"); }
}
function proposal(overrides: Partial<TaskRow> = {}): TaskRow {
  const id = `00000000-0000-5000-8000-${String(sequence++).padStart(12, "0")}`;
  return { ...taskToRow(makeTask({ id, deviceId: "device-a", text: "weekly review", sourceNamespace: "planning",
    externalKey: id, origin: "IMPORT", actionOwnerScope: owner, updatedAt: "2027-01-01T00:00:00.000Z" }), owner), ...overrides };
}
async function ensure(row: TaskRow) {
  return (await authenticated(owner, () => db.query<{ value: TaskRow }>(
    "select to_jsonb(t) as value from public.ensure_action_v1($1) t", [row]))).rows[0].value;
}

beforeAll(async () => {
  db = new PGlite();
  await db.exec(`set time zone 'UTC';
    create role anon; create role authenticated; create schema auth;
    create table auth.users(id uuid primary key); insert into auth.users values('${owner}'),('${other}');
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('test.user_id',true),'')::uuid $$;
    grant usage on schema auth to authenticated,anon; grant execute on function auth.uid() to authenticated,anon;
    create table public.devices(user_id text,id text,name text,last_seen_at timestamptz,app_version text,primary key(user_id,id));
    insert into public.devices values('${owner}','device-a','Windows','2026-01-01','1'),('${other}','device-a','Other','2026-01-01','1');
    create table public.tasks(id uuid primary key,user_id text not null,text text not null,is_done boolean not null default false,
      order_index integer not null default 0,due_date date,due_time time,planned_date date,updated_at timestamptz not null,
      deleted_at timestamptz,device_id text not null,created_at timestamptz not null default now(),is_backfilled boolean not null default false,
      backfilled_at timestamptz,backfill_reason text,foreign key(user_id,device_id) references public.devices(user_id,id));
    create table public.project_actions(id uuid primary key,user_id text not null,updated_at timestamptz not null default now(),deleted_at timestamptz);
    insert into public.project_actions(id,user_id) values('${linkedAction}','${owner}'),('${otherAction}','${other}');
    alter table public.project_actions enable row level security;
    create policy project_actions_own on public.project_actions to authenticated using(user_id=auth.uid()::text) with check(user_id=auth.uid()::text);
    grant select,insert,update on public.tasks,public.project_actions to authenticated;
    insert into public.tasks(id,user_id,text,device_id,created_at,updated_at,is_done,deleted_at) values
      ('00000000-0000-4000-8000-000000000010','${owner}','completed before migration','device-a','2026-01-01','2026-02-01',true,null),
      ('00000000-0000-4000-8000-000000000011','${owner}','deleted before migration','device-a','2026-01-01','2026-02-01',false,'2026-02-01');`);
  const lww = sql("20260910130049_dev_control_v1.sql").match(/create or replace function public\.prevent_stale_sync_write\(\)[\s\S]*?\$\$;/)![0];
  await db.exec(lww);
  await db.exec("create trigger tasks_lww_guard before insert or update on public.tasks for each row execute function public.prevent_stale_sync_write()");
  await db.exec(sql("20261018133855_action_calendar_v1_1.sql"));
  await db.exec(sql("20261019161235_guard_task_ownership_content_revision.sql"));
  const tables = new Set([...WRITE_COLLECTIONS.map(([, table]) => table), "fitness_summary_projections_v2", "workout_records", "weight_records", "meal_records"]);
  for (const table of tables) {
    if (table === "tasks" || table === "project_actions") continue;
    await db.exec(`create table public.${table}(id text primary key,user_id text not null,
      updated_at timestamptz not null default now(),deleted_at timestamptz,date date,source_app text,scope text);`);
  }
  await db.exec(sql("20261005090000_personal_os_incremental_sync.sql"));
  originalRows = (await db.query("select to_jsonb(t) as value from public.tasks t order by id")).rows;
  await db.exec(sql("20261106172347_task_planning_workflow_v1.sql"));
  migrationPreservedRows = (await db.query("select to_jsonb(t) - $1::text[] as value from public.tasks t order by id", [newColumns])).rows;
}, 60_000);
afterAll(async () => { await db?.close(); });

describe("Task planning forward migration", () => {
  it("preserves every existing field and leaves historical completion time unknown", async () => {
    expect(migrationPreservedRows).toEqual(originalRows);
    const row = (await db.query<{ is_done: boolean; completed_at: string | null; checklist: unknown[] }>(
      "select is_done,completed_at,checklist from public.tasks where id='00000000-0000-4000-8000-000000000010'")).rows[0];
    expect(row).toEqual({ is_done: true, completed_at: null, checklist: [] });
  });

  it("round-trips details, recurrence and same-owner project links through the existing RPC", async () => {
    const row = proposal({ description: "prepare notes", category: "study", checklist: [{ id: "one", text: "read", isDone: false }],
      recurrence: { frequency: "WEEKLY", interval: 2, anchorDate: "2027-01-01" }, recurrence_occurrence: 0,
      project_action_id: linkedAction });
    row.recurrence_series_id = row.id;
    const saved = await ensure(row);
    expect(taskFromRow(saved)).toMatchObject({ description: row.description, category: row.category,
      checklist: row.checklist, recurrence: row.recurrence, recurrenceSeriesId: row.id, recurrenceOccurrence: 0, projectActionId: linkedAction });
    expect(await ensure({ ...row, description: "retry must not overwrite" })).toEqual(saved);
  });

  it("accepts an old RPC payload without inventing workflow metadata", async () => {
    const row = await ensure(proposal());
    expect(row).toMatchObject({ completed_at: null, skipped_at: null, description: "", checklist: [], recurrence: null });
  });

  it.each([
    { checklist: {} }, { checklist: [{ id: "a", text: "", isDone: false }] },
    { checklist: [{ id: "a", text: "first", isDone: false }, { id: "a", text: "second", isDone: true }] },
    { checklist: [{ id: "a", text: "first", isDone: "false" }] },
    { recurrence: { frequency: "YEARLY", interval: 1, anchorDate: "2027-01-01" } },
    { recurrence: { frequency: "DAILY", interval: 0, anchorDate: "2027-01-01" } },
    { recurrence: { frequency: "DAILY", interval: 1.5, anchorDate: "2027-01-01" } },
    { recurrence: { frequency: "DAILY", interval: 366, anchorDate: "2027-01-01" } },
    { recurrence: { frequency: "DAILY", interval: 1, anchorDate: "2027-02-30" } },
    { recurrence_series_id: "00000000-0000-4000-8000-000000000010", recurrence_occurrence: null },
    { completed_at: "2027-01-01", is_done: false },
    { skipped_at: "2027-01-01", is_done: true },
  ])("rejects invalid workflow shape/state %#", async invalid => {
    await expect(ensure(proposal(invalid as Partial<TaskRow>))).rejects.toThrow(/constraint/);
  });

  it("keeps unknown fields on an old-client partial upsert and handles completion toggles", async () => {
    const row = proposal({ is_done: true, completed_at: "2027-01-01T00:00:00Z", description: "must survive",
      category: "home", checklist: [{ id: "one", text: "keep", isDone: true }] });
    await ensure(row);
    await authenticated(owner, () => db.query(`insert into public.tasks(id,user_id,text,is_done,device_id,updated_at)
      values($1,$2,'old client edit',true,'device-a','2027-01-02') on conflict(id) do update
      set text=excluded.text,is_done=excluded.is_done,updated_at=excluded.updated_at`, [row.id,owner]));
    const saved = (await db.query<{ value: TaskRow }>("select to_jsonb(t) as value from public.tasks t where id=$1", [row.id])).rows[0].value;
    expect(saved).toMatchObject({ description: "must survive", category: "home", checklist: row.checklist });
    expect(saved.completed_at).not.toBeNull();
    await authenticated(owner, () => db.query("update public.tasks set is_done=false,updated_at='2027-01-03' where id=$1", [row.id]));
    await authenticated(owner, () => db.query("update public.tasks set is_done=true,updated_at='2027-01-04' where id=$1", [row.id]));
    expect((await db.query("select completed_at from public.tasks where id=$1", [row.id])).rows).toEqual([{ completed_at: null }]);
  });

  it("prevents duplicate recurrence occurrences even after deletion", async () => {
    const row = proposal({ recurrence_occurrence: 1, deleted_at: "2027-01-01" });
    row.recurrence_series_id = row.id;
    await ensure(row);
    await expect(ensure(proposal({ recurrence_series_id: row.id, recurrence_occurrence: 1 }))).rejects.toThrow(/identity conflict/);
  });

  it("rejects links to another owner's project action", async () => {
    await expect(ensure(proposal({ project_action_id: otherAction }))).rejects.toThrow(/foreign key/);
  });

  it("retains authenticated ownership policies and denies anonymous access", async () => {
    const row = proposal(); await ensure(row);
    expect((await authenticated(other, () => db.query("select id from public.tasks where id=$1", [row.id]))).rows).toEqual([]);
    await expect(authenticated(other, () => db.query("select * from public.ensure_action_v1($1)", [row]))).rejects.toThrow(/owner/);
    await db.exec("set role anon");
    try { await expect(db.query("select * from public.tasks")).rejects.toThrow(/permission denied/); }
    finally { await db.exec("reset role"); }
  });

  it("keeps LWW and the existing change feed for new-field edits", async () => {
    const row = proposal({ description: "current" }); await ensure(row);
    const cursor = (await authenticated(owner, () => db.query<{ value: { epoch: string; revision: string } }>(
      "select public.get_personal_os_sync_cursor_v1() as value"))).rows[0].value;
    await authenticated(owner, () => db.query("update public.tasks set description='stale',updated_at='2026-01-01' where id=$1", [row.id]));
    expect((await db.query("select description from public.tasks where id=$1", [row.id])).rows).toEqual([{ description: "current" }]);
    await authenticated(owner, () => db.query("update public.tasks set checklist=$2,updated_at='2027-01-02' where id=$1", [row.id, [{ id: "one", text: "new detail", isDone: false }]]));
    const page = (await authenticated(owner, () => db.query<{ value: { changes: { table_name: string; id: string }[] } }>(
      "select public.read_personal_os_sync_changes_v1($1,$2,null,500) as value", [cursor.epoch,cursor.revision]))).rows[0].value;
    expect(page.changes).toEqual([expect.objectContaining({ table_name: "tasks", id: row.id })]);
  });
});
