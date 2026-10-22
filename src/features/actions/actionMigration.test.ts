import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { makeTask } from "../../lib/sync/supabase/testFixtures";
import { taskToRow } from "../../lib/sync/supabase/mappers";
import { ACTION_DEFAULTS } from "./actionModel";

const owner = "00000000-0000-4000-8000-000000000001";
const other = "00000000-0000-4000-8000-000000000002";
let db: PGlite;
async function authenticated<T>(user: string, operation: () => Promise<T>) {
  await db.query("select set_config('test.user_id',$1,false)", [user]);
  await db.exec("set role authenticated");
  try { return await operation(); } finally { await db.exec("reset role"); }
}
function row(id: string, key = id) {
  return taskToRow(makeTask({
    ...ACTION_DEFAULTS, id, deviceId: "device-a", text: "접수", kind: "REGISTRATION",
    windowStartDate: "2027-02-01", dueDate: "2027-02-05", sourceNamespace: "test", externalKey: key,
    origin: "IMPORT", sourceType: "EXTERNAL_NOTICE", verificationStatus: "UNVERIFIED",
  }), owner);
}
beforeAll(async () => {
  db = new PGlite();
  await db.exec(
    "create role anon; create role authenticated; create schema auth;" +
    "create table auth.users(id uuid primary key);" +
    "create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('test.user_id',true),'')::uuid $$;" +
    "grant usage on schema auth to authenticated,anon; grant execute on function auth.uid() to authenticated,anon;" +
    "create table public.devices(user_id text not null,id text not null,name text not null,last_seen_at timestamptz not null,app_version text,primary key(user_id,id));" +
    "create table public.tasks(id uuid primary key,user_id text not null,text text not null,is_done boolean not null default false,order_index integer not null default 0," +
    "due_date date,due_time time,planned_date date,updated_at timestamptz not null,deleted_at timestamptz,device_id text not null,created_at timestamptz not null default now()," +
    "is_backfilled boolean not null default false,backfilled_at timestamptz,backfill_reason text,foreign key(user_id,device_id) references public.devices(user_id,id));" +
    "grant all on public.tasks,public.devices to anon,authenticated;" +
    "insert into auth.users values ('" + owner + "');" +
    "insert into public.devices values('legacy-owner','device-a','Windows','2026-10-01','1');" +
    "insert into public.tasks(id,user_id,text,device_id,updated_at,deleted_at) values('00000000-0000-4000-8000-000000000099','legacy-owner','기존 삭제 항목','device-a','2026-10-01','2026-10-02');"
  );
  await db.exec(readFileSync(new URL("../../../supabase/migrations/20261018133855_action_calendar_v1_1.sql", import.meta.url), "utf8"));
  await db.exec("insert into auth.users values('" + other + "'); insert into public.devices values('" + other + "','device-a','Mobile','2026-10-01','1');");
}, 60_000);
afterAll(async () => { await db?.close(); });
describe("action calendar migration in local PostgreSQL", () => {
  it("adopts legacy tasks to the single authorized login without changing IDs or tombstones", async () => {
    const record = (await db.query<{ user_id: string; deleted_at: string; kind: string }>("select user_id,deleted_at,kind from public.tasks where id='00000000-0000-4000-8000-000000000099'")).rows[0];
    expect(record.user_id).toBe(owner); expect(record.deleted_at).toBeTruthy(); expect(record.kind).toBe("TASK");
    expect((await db.query("select * from public.devices where user_id=$1 and id='device-a'", [owner])).rows).toHaveLength(1);
  });
  it("creates once and returns server edits without overwriting them on retry", async () => {
    const proposal = row("00000000-0000-5000-8000-000000000010");
    await authenticated(owner, () => db.query("select * from public.ensure_action_v1($1)", [proposal]));
    await authenticated(owner, () => db.query("update public.tasks set text='사용자 수정',updated_at=now() where id=$1", [proposal.id]));
    const again = await authenticated(owner, () => db.query<{ text: string }>("select * from public.ensure_action_v1($1)", [proposal]));
    expect(again.rows[0].text).toBe("사용자 수정");
    expect((await db.query("select id from public.tasks where external_key=$1", [proposal.external_key])).rows).toHaveLength(1);
  });
  it("returns a tombstone instead of restoring a deleted external identity", async () => {
    const proposal = row("00000000-0000-5000-8000-000000000011");
    await authenticated(owner, () => db.query("select * from public.ensure_action_v1($1)", [proposal]));
    await authenticated(owner, () => db.query("update public.tasks set deleted_at=now(),updated_at=now() where id=$1", [proposal.id]));
    const again = await authenticated(owner, () => db.query<{ deleted_at: string }>("select * from public.ensure_action_v1($1)", [proposal]));
    expect(again.rows[0].deleted_at).toBeTruthy();
  });
  it("enforces owner reads/writes and rejects anonymous access", async () => {
    expect((await authenticated(other, () => db.query("select * from public.tasks"))).rows).toHaveLength(0);
    await expect(authenticated(other, () => db.query("select * from public.ensure_action_v1($1)", [row("00000000-0000-5000-8000-000000000012")]))).rejects.toThrow(/owner/);
    await db.exec("set role anon");
    try { await expect(db.query("select * from public.tasks")).rejects.toThrow(/permission denied/); }
    finally { await db.exec("reset role"); }
  });
  it("rejects invalid ranges, completed candidates, and spoofed source confirmation", async () => {
    const proposal = row("00000000-0000-5000-8000-000000000013");
    await expect(authenticated(owner, () => db.query("select * from public.ensure_action_v1($1)", [{ ...proposal, window_start_date: "2027-03-01" }]))).rejects.toThrow(/constraint/);
    await expect(authenticated(owner, () => db.query("select * from public.ensure_action_v1($1)", [{ ...proposal, registration_state: "CANDIDATE", is_done: true }]))).rejects.toThrow(/constraint/);
    await expect(authenticated(owner, () => db.query("select * from public.ensure_action_v1($1)", [{ ...proposal, verification_status: "SOURCE_CHECKED", source_url: "https://example.org", source_checked_at: "2026-10-18", source_checked_by: other }]))).rejects.toThrow(/authenticated user/);
  });
  it("invalidates checked evidence on schedule changes while keeping registration", async () => {
    const proposal = { ...row("00000000-0000-5000-8000-000000000014"), verification_status: "SOURCE_CHECKED", source_url: "https://example.org", source_checked_at: "2026-10-18", source_checked_by: owner };
    await authenticated(owner, () => db.query("select * from public.ensure_action_v1($1)", [proposal]));
    const changed = await authenticated(owner, () => db.query<{ registration_state: string; verification_status: string }>(
      "update public.tasks set due_date='2027-02-06',updated_at=now() where id=$1 returning registration_state,verification_status", [proposal.id]));
    expect(changed.rows[0]).toEqual({ registration_state: "CONFIRMED", verification_status: "UNVERIFIED" });
    await expect(authenticated(owner, () => db.query("update public.tasks set external_key='different' where id=$1", [proposal.id]))).rejects.toThrow(/immutable/);
  });
});
