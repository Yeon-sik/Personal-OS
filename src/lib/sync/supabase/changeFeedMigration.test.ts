import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { WRITE_COLLECTIONS, type SyncCursor } from "../syncState";
import type { ChangePage } from "./changeFeed";

const userA = "00000000-0000-4000-8000-000000000001";
const userB = "00000000-0000-4000-8000-000000000002";
const tables = [...WRITE_COLLECTIONS.map(([, table]) => table),
  "fitness_summary_projections_v2", "workout_records", "weight_records", "meal_records"];
let db: PGlite;

async function cursor(): Promise<SyncCursor> {
  return (await db.query<{ value: SyncCursor }>("select public.get_personal_os_sync_cursor_v1() as value")).rows[0].value;
}

async function changes(after: SyncCursor, until: string | null = null, limit = 500): Promise<ChangePage> {
  return (await db.query<{ value: ChangePage }>(
    "select public.read_personal_os_sync_changes_v1($1, $2, $3, $4) as value",
    [after.epoch, after.revision, until, limit],
  )).rows[0].value;
}

async function authenticate(userId: string) {
  await db.query("select set_config('test.user_id', $1, false)", [userId]);
}

async function asRole<T>(role: "authenticated" | "anon", run: () => Promise<T>): Promise<T> {
  await db.exec(`set role ${role}`);
  try { return await run(); } finally { await db.exec("reset role"); }
}

beforeAll(async () => {
  db = new PGlite();
  // Minimal existing domain schema: execute the new migration itself, and the
  // original LWW guard unchanged. This is not a live Supabase/RLS integration.
  await db.exec(`
    create role anon;
    create role authenticated;
    create schema auth;
    create function auth.uid() returns uuid language sql stable as
      $$ select nullif(current_setting('test.user_id', true), '')::uuid $$;
    grant usage on schema auth to authenticated, anon;
    grant execute on function auth.uid() to authenticated, anon;
  `);
  for (const table of tables) {
    await db.exec(`create table public.${table} (
      id text primary key, user_id text not null,
      updated_at timestamptz not null default now(), deleted_at timestamptz,
      device_id text not null default 'device-a', content text not null default '',
      date date not null default '2026-08-01', source_app text not null default 'fitness',
      scope text not null default 'both'
    );`);
  }
  const original = readFileSync(new URL("../../../../supabase/migrations/20260910130049_dev_control_v1.sql", import.meta.url), "utf8");
  const lww = original.match(/create or replace function public\.prevent_stale_sync_write\(\)[\s\S]*?\$\$;/)?.[0];
  if (!lww) throw new Error("Existing LWW function was not found");
  await db.exec(lww);
  for (const table of ["notes", "tasks", "projects", "project_milestones", "project_actions", "project_ideas", "project_history"]) {
    await db.exec(`create trigger ${table}_lww_guard before insert or update on public.${table}
      for each row execute function public.prevent_stale_sync_write();`);
  }
  await db.exec(`
    alter table public.notes enable row level security;
    create policy notes_own on public.notes to authenticated
      using (user_id = auth.uid()::text) with check (user_id = auth.uid()::text);
    grant select, insert, update on public.notes to authenticated;
  `);
  await db.exec(readFileSync(new URL("../../../../supabase/migrations/20261005090000_personal_os_incremental_sync.sql", import.meta.url), "utf8"));
}, 60_000);

beforeEach(async () => {
  await db.exec(`truncate ${tables.map((table) => `public.${table}`).join(", ")},
    public.personal_os_sync_changes_v1, public.personal_os_sync_state_v1 cascade;`);
  await authenticate(userA);
});

afterAll(async () => { await db?.close(); });

describe("incremental sync migration in local PostgreSQL", () => {
  it("logs only accepted LWW writes, including the equal-time tombstone", async () => {
    const start = await cursor();
    await db.query("insert into public.notes(id,user_id,content,updated_at) values ('note',$1,'winner','2026-08-02')", [userA]);
    await db.exec("update public.notes set content='older', updated_at='2026-08-01' where id='note'");
    await db.exec("update public.notes set content='equal' where id='note'");
    expect((await cursor()).revision).toBe("1");
    expect((await db.query<{ content: string }>("select content from public.notes")).rows[0].content).toBe("winner");
    await db.exec("update public.notes set deleted_at='2026-08-02' where id='note'");
    expect((await cursor()).revision).toBe("2");
    const page = await changes(start);
    expect(page.changes).toEqual([{ table_name: "notes", id: "note", revision: "2" }]);
    expect((await db.query<{ deleted: boolean }>("select deleted_at is not null as deleted from public.notes")).rows[0].deleted).toBe(true);
  });

  it("coalesces repeated edits and rolls back the cursor and keys with the domain write", async () => {
    await db.query("insert into public.notes(id,user_id,updated_at) values ('note',$1,'2026-08-01')", [userA]);
    await db.exec("update public.notes set updated_at=updated_at+interval '1 second'");
    expect((await db.query<{ count: number }>("select count(*)::integer as count from public.personal_os_sync_changes_v1")).rows[0].count).toBe(1);
    const before = await cursor();
    await db.exec("begin; update public.notes set content='rolled back',updated_at=updated_at+interval '1 second'; rollback;");
    expect(await cursor()).toEqual(before);
    expect((await db.query<{ content: string }>("select content from public.notes")).rows[0].content).toBe("");
  });

  it("keeps the server winner when two devices upsert an older or equal active revision", async () => {
    const start = await asRole("authenticated", () => cursor());
    const upsert = (content: string, device: string, time: string) => asRole("authenticated", () => db.query(`
      insert into public.notes(id,user_id,content,device_id,updated_at) values ('shared',$1,$2,$3,$4)
      on conflict(id) do update set content=excluded.content, device_id=excluded.device_id, updated_at=excluded.updated_at`,
    [userA, content, device, time]));
    await upsert("device B winner", "device-b", "2026-08-02");
    await upsert("device A stale", "device-a", "2026-08-01");
    await upsert("device A equal", "device-a", "2026-08-02");
    const confirmed = await asRole("authenticated", () => db.query<{ content: string; device_id: string }>(
      "select content,device_id from public.notes where user_id=$1 and id='shared'", [userA]));
    expect(confirmed.rows).toEqual([{ content: "device B winner", device_id: "device-b" }]);
    expect((await changes(start)).changes).toEqual([{ table_name: "notes", id: "shared", revision: "1" }]);
  });

  it("tracks source-owned records independently of equal and backdated client clocks", async () => {
    const start = await cursor();
    await db.query("insert into public.weight_records(id,user_id,updated_at) values ('weight',$1,'2026-08-02')", [userA]);
    await db.exec("update public.weight_records set content='equal clock'");
    await db.exec("update public.weight_records set content='backdated',updated_at='2000-01-01'");
    expect((await changes(start)).changes).toEqual([{ table_name: "weight_records", id: "weight", revision: "3" }]);
  });

  it("invalidates old/new nutrition dates and deletion without exposing meal details", async () => {
    const start = await cursor();
    await db.query("insert into public.meal_records(id,user_id,content,date) values ('meal',$1,'private meal','2026-08-01')", [userA]);
    await db.exec("update public.meal_records set date='2026-08-02' where id='meal'");
    await db.exec("update public.meal_records set date='2026-08-03' where id='meal'");
    await db.exec("update public.meal_records set deleted_at=now() where id='meal'");
    const page = await changes(start);
    expect(page.changes.map((row) => row.id).sort()).toEqual(["2026-08-01", "2026-08-02", "2026-08-03"]);
    expect(page.changes.every((row) => row.table_name === "fitness_nutrition_summary_v1")).toBe(true);
    expect(JSON.stringify(page)).not.toContain("private meal");
    await db.query("insert into public.meal_records(id,user_id,source_app,scope,date) values ('os-meal',$1,'os','os','2026-08-04')", [userA]);
    expect((await changes(start)).changes).toHaveLength(3);
    await db.exec("update public.meal_records set scope='os' where id='meal'");
    expect((await cursor()).revision).toBe("7");
  });

  it("pages at 500 keys with a fixed watermark and replays a key moved past the boundary", async () => {
    const start = await cursor();
    await db.query(`insert into public.notes(id,user_id,updated_at)
      select 'note-' || n, $1, '2026-08-01'::timestamptz from generate_series(1,502) n`, [userA]);
    const first = await changes(start);
    expect(first.changes).toHaveLength(500);
    expect(first.has_more).toBe(true);
    expect(first.until_revision).toBe("502");
    await db.exec("update public.notes set updated_at='2026-08-02' where id='note-501'");
    const second = await changes({ epoch: start.epoch, revision: first.next_revision }, first.until_revision);
    expect(second.changes).toEqual([{ table_name: "notes", id: "note-502", revision: "502" }]);
    expect(second.next_revision).toBe("502");
    const next = await changes({ epoch: start.epoch, revision: second.next_revision });
    expect(next.changes).toEqual([{ table_name: "notes", id: "note-501", revision: "503" }]);
  });

  it("transports bigint cursors as strings and requests recovery for invalid epochs/ranges", async () => {
    const start = await cursor();
    await db.query("update public.personal_os_sync_state_v1 set revision=9007199254740993 where user_id=$1", [userA]);
    await db.query("insert into public.notes(id,user_id) values ('bigint',$1)", [userA]);
    expect((await cursor()).revision).toBe("9007199254740994");
    const page = await changes({ ...start, revision: "9007199254740993" });
    expect(page.changes[0].revision).toBe("9007199254740994");
    await expect(changes({ ...start, epoch: "00000000-0000-4000-8000-000000000099" })).rejects.toThrow("CURSOR_RESET_REQUIRED");
    await expect(changes({ ...start, revision: "9007199254740995" })).rejects.toThrow("CURSOR_RESET_REQUIRED");
    await expect(changes(start, null, 501)).rejects.toThrow("invalid page size");
  });

  it("isolates authenticated accounts and denies anonymous/direct feed access", async () => {
    await db.query("insert into public.notes(id,user_id) values ('a',$1),('b',$2)", [userA, userB]);
    const first = await asRole("authenticated", () => cursor());
    const page = await asRole("authenticated", () => changes({ ...first, revision: "0" }));
    expect(page.changes.map((row) => row.id)).toEqual(["a"]);
    await asRole("authenticated", async () => {
      expect((await db.query("select * from public.notes where id='b'")).rows).toEqual([]);
      await expect(db.query("insert into public.notes(id,user_id) values ('illegal',$1)", [userB])).rejects.toThrow("row-level security");
      await expect(db.query("select * from public.personal_os_sync_changes_v1")).rejects.toThrow("permission denied");
      await expect(db.query("select public.touch_personal_os_sync_key_v1($1,'notes','illegal')", [userA])).rejects.toThrow("permission denied");
    });
    await authenticate(userB);
    const second = await asRole("authenticated", () => cursor());
    expect(second.epoch).not.toBe(first.epoch);
    expect((await asRole("authenticated", () => changes({ ...second, revision: "0" }))).changes.map((row) => row.id)).toEqual(["b"]);
    await expect(asRole("authenticated", () => changes(first))).rejects.toThrow("CURSOR_RESET_REQUIRED");
    await expect(asRole("anon", () => cursor())).rejects.toThrow("permission denied");
    await authenticate("");
    await expect(asRole("authenticated", () => cursor())).rejects.toThrow("authenticated user is required");
  });
});
