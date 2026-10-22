import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";

const tables = ["devices", "notes", "workout_records", "workout_exercises", "workout_sets", "meal_records", "weight_records"] as const;
const owner = "00000000-0000-4000-8000-000000000001";
const other = "00000000-0000-4000-8000-000000000002";
type Row = Record<string, unknown>;
let db: PGlite;
let preserved: boolean;

function payload(user: string, prefix: string): Record<string, Row[]> {
  const id = (n: number) => `${prefix.padStart(8, "0")}-0000-4000-8000-${String(n).padStart(12, "0")}`;
  const common = { user_id: user, device_id: "android-local", created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z", deleted_at: null, is_backfilled: false };
  const provenance = { source_app: "fitness", scope: "fitness", metadata: {} };
  return {
    devices: [{ user_id: user, id: "android-local", name: "Fitness", last_seen_at: common.updated_at, app_version: "1" }],
    notes: [{ ...common, id: id(1), title: "Personal OS", content: "private" }],
    workout_records: [{ ...common, ...provenance, id: id(2), date: "2026-01-01", workout_type: "strength", category: "test", exercise_name: "test" }],
    workout_exercises: [{ user_id: user, device_id: common.device_id, created_at: common.created_at, updated_at: common.updated_at,
      id: id(3), record_id: id(2), order_index: 0, exercise_id: "test", exercise_name_snapshot: "test", ui_part: "test", record_type: "strength" }],
    workout_sets: [{ user_id: user, device_id: common.device_id, created_at: common.created_at, updated_at: common.updated_at,
      id: id(4), workout_exercise_id: id(3), set_index: 0, is_completed: false }],
    meal_records: [{ ...common, ...provenance, id: id(5), date: "2026-01-01", menu: "test", calories: 100, protein_grams: 10 }],
    weight_records: [{ ...common, ...provenance, id: id(6), date: "2026-01-01", weight_kg: 70 }],
  };
}
async function insert(table: string, row: Row) {
  const columns = Object.keys(row);
  if (![table, ...columns].every(value => /^[a-z_]+$/.test(value))) throw new Error("Invalid fixture identifier");
  return db.query(`insert into public.${table}(${columns.join(",")})
    select ${columns.join(",")} from jsonb_populate_record(null::public.${table},$1)`, [row]);
}
async function role(user: string, name = "authenticated") {
  await db.exec(`reset role; set local role ${name}`);
  await db.query("select set_config('request.jwt.claim.sub',$1,true)", [user]);
}
async function denied(sql: string, params: unknown[] = []) {
  await db.exec("savepoint denied");
  try {
    await expect(db.query(sql, params)).rejects.toMatchObject({ code: "42501" });
  } finally { await db.exec("rollback to savepoint denied; release savepoint denied"); }
}
async function fingerprint() {
  return JSON.stringify(await Promise.all(tables.map(async table =>
    (await db.query(`select to_jsonb(t) value from public.${table} t order by user_id,id`)).rows)));
}
async function rpc(changes: Record<string, Row[]>) {
  const fitness = { ...changes }; delete fitness.notes;
  return (await db.query<{ result: { pushed: Record<string, number>; rows: Record<string, Row[]> } }>(
    "select public.sync_fitness_data_v1($1,'{}',500) result", [fitness])).rows[0].result;
}

beforeAll(async () => {
  db = new PGlite();
  await db.exec(`create role anon; create role authenticated; create schema auth;
    create table auth.users(id uuid primary key); insert into auth.users values('${owner}');
    create function auth.uid() returns uuid language sql stable as $$
      select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
    grant usage on schema auth to anon,authenticated;
    grant execute on function auth.uid() to anon,authenticated;`);
  await db.exec(readFileSync(new URL("./fixtures/shared-security-baseline.sql", import.meta.url), "utf8"));
  await db.exec(`create view public.fitness_nutrition_summary_v1 with(security_invoker=true) as
    select user_id,date,count(*) as meal_count from public.meal_records
    where user_id=(select auth.uid())::text and source_app='fitness' and scope in ('fitness','both') and deleted_at is null
    group by user_id,date; grant select on public.fitness_nutrition_summary_v1 to authenticated;`);
  await db.exec(`grant all on ${tables.map(t => `public.${t}`).join(",")} to anon,authenticated`);
  for (const [user, prefix] of [[owner, "1"], [other, "2"], ["legacy-unclaimed", "3"]]) {
    const rows = payload(user, prefix);
    for (const table of tables) await insert(table, rows[table][0]);
  }
  const before = await fingerprint();
  await db.exec("begin");
  await db.exec(readFileSync(new URL("../../../../supabase/migrations/20261019165450_secure_shared_personal_os_fitness_tables.sql", import.meta.url), "utf8"));
  await db.exec("commit");
  preserved = before === await fingerprint();
}, 60_000);
beforeEach(async () => { await db.exec("begin"); });
afterEach(async () => { await db.exec("rollback; reset role"); });
afterAll(async () => { await db?.close(); });

describe("shared production RLS migration in PostgreSQL", () => {
  it("preserves every existing content/timestamp/tombstone/legacy owner field", () => { expect(preserved).toBe(true); });

  it("runs the same rollback-only smoke script used on production", async () => {
    // The script owns its transaction, so close the per-test transaction first.
    await db.exec("rollback");
    const before = await fingerprint();
    await db.exec(readFileSync(new URL("../../../../supabase/tests/shared_security_smoke.sql", import.meta.url), "utf8"));
    expect(await fingerprint()).toBe(before);
  });

  it.each(tables)("blocks anon read/write and privileged grants on %s", async table => {
    await role("", "anon");
    for (const sql of [`select * from public.${table}`, `insert into public.${table} default values`,
      `update public.${table} set user_id='attacker'`, `delete from public.${table}`, `truncate public.${table}`]) await denied(sql);
  });

  it.each(tables)("permits only owner reads/inserts/updates and rejects owner reassignment on %s", async table => {
    await role(owner);
    const visible = (await db.query<{ user_id: string }>(`select user_id from public.${table}`)).rows;
    expect(visible).toEqual([{ user_id: owner }]);
    const own = payload(owner, "4")[table][0];
    if (table === "devices") own.id = "windows";
    if (table === "workout_exercises") own.record_id = payload(owner, "1").workout_records[0].id;
    if (table === "workout_sets") own.workout_exercise_id = payload(owner, "1").workout_exercises[0].id;
    await insert(table, own);
    const updated = await db.query(`update public.${table} set ${table === "devices" ? "name='changed'" : "updated_at='2027-01-01'"} where user_id=$1 returning *`, [owner]);
    expect(updated.rows.length).toBeGreaterThan(0);
    await denied(`update public.${table} set user_id=$1${table === "devices" ? "" : ",updated_at='2028-01-01'"} where user_id=$2`, [other, owner]);
    await denied(`delete from public.${table} where user_id=$1`, [owner]);
    await denied(`truncate public.${table}`);
  });

  it.each(tables)("denies another account's read/update/spoofed insert on %s", async table => {
    await role(other);
    expect((await db.query(`select * from public.${table} where user_id=$1`, [owner])).rows).toEqual([]);
    expect((await db.query(`update public.${table} set user_id=$1 where user_id=$2 returning *`, [other, owner])).rows).toEqual([]);
    await db.exec("savepoint spoof");
    try { await expect(insert(table, payload(owner, "5")[table][0])).rejects.toMatchObject({ code: "42501" }); }
    finally { await db.exec("rollback to savepoint spoof"); }
  });

  it.each(["workout_exercises", "workout_sets"])("rejects foreign parent insertion and reparenting on %s", async table => {
    await role(owner);
    const column = table === "workout_exercises" ? "record_id" : "workout_exercise_id";
    const parent = payload(other, "2")[table][0][column];
    await db.exec("savepoint parent");
    await expect(insert(table, { ...payload(owner, "6")[table][0], [column]: parent })).rejects.toMatchObject({ code: "42501" });
    await db.exec("rollback to savepoint parent");
    await denied(`update public.${table} set ${column}=$1,updated_at='2028-01-01' where user_id=$2`, [parent, owner]);
  });

  it("preserves Fitness batch parent-child push/pull, stale write rejection, tombstones and source/scope", async () => {
    await role(owner);
    const changes = payload(owner, "7");
    const result = await rpc(changes);
    for (const table of tables.filter(t => t !== "notes" && t !== "devices")) {
      expect(result.pushed[table]).toBe(1);
      expect(result.rows[table].some(row => row.id === changes[table][0].id)).toBe(true);
      changes[table][0].updated_at = "2027-01-01T00:00:00Z";
      changes[table][0].deleted_at = "2027-01-01T00:00:00Z";
    }
    const deleted = await rpc(changes);
    for (const table of tables.filter(t => t !== "notes" && t !== "devices")) {
      expect(deleted.pushed[table]).toBe(1);
      expect(deleted.rows[table].find(row => row.id === changes[table][0].id)?.deleted_at).toBeTruthy();
    }
    const stale = await rpc(payload(owner, "7"));
    expect(stale.pushed.workout_records).toBe(0);
    expect(stale.rows.workout_records.find(row => row.id === changes.workout_records[0].id)).toMatchObject({ source_app: "fitness", scope: "fitness" });
    await denied("select public.sync_fitness_data_v1($1,'{}',500)", [payload(other, "8")]);
  });

  it("preserves Personal OS note upsert confirmation, LWW and tombstone reads", async () => {
    await role(owner);
    const id = payload(owner, "1").notes[0].id;
    expect((await db.query("update public.notes set content='offline edit',updated_at='2027-01-01' where id=$1 returning content", [id])).rows).toEqual([{ content: "offline edit" }]);
    expect((await db.query("update public.notes set content='stale',updated_at='2026-01-01' where id=$1 returning id", [id])).rows).toEqual([]);
    await db.query("update public.notes set deleted_at='2028-01-01',updated_at='2028-01-01' where id=$1", [id]);
    expect((await db.query<{ deleted_at: string }>("select deleted_at from public.notes where id=$1", [id])).rows[0].deleted_at).toBeTruthy();
  });
});
