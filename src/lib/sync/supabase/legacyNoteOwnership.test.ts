import { readFileSync, readdirSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { initializeSyncState } from "../syncState";
import { reconcilePush } from "../syncReconciliation";
import { pushSnapshotChanges } from "./deltaPush";
import { type SnapshotTransport } from "./snapshotIo";
import { makeDevice, makeNote, makeSnapshot } from "./testFixtures";

const migrationDirectory = new URL("../../../../supabase/migrations/", import.meta.url);
const migrationFile = readdirSync(migrationDirectory).find(name => name.endsWith("_repair_legacy_note_ownership.sql"))!;
const migration = readFileSync(new URL(migrationFile, migrationDirectory), "utf8");
const owner = "00000000-0000-4000-8000-000000000001";
const noteId = "00000000-0000-4000-8000-000000000011";
const scope = { backend: "https://example.supabase.co", userId: owner };
const context = { ...scope, device: makeDevice() };
let db: PGlite;

beforeEach(async () => {
  db = new PGlite();
  await db.exec(`
    set time zone 'UTC';
    create schema auth;
    create table auth.users(id uuid primary key);
    insert into auth.users values('${owner}');
    create table public.devices(user_id text, id text, name text, last_seen_at timestamptz, app_version text, primary key(user_id,id));
    insert into public.devices values
      ('yeonsik-main','device-a','Windows','2026-08-01','1'),
      ('yeonsik-main','device-b','Mobile','2026-08-01','1'),
      ('${owner}','device-a','Current device','2026-08-02','2');
    create table public.tasks(id uuid primary key,user_id text);
    insert into public.tasks values('${noteId}','${owner}');
    create table public.notes(id uuid primary key,user_id text,title text,content text,
      updated_at timestamptz,deleted_at timestamptz,device_id text,created_at timestamptz,
      is_backfilled boolean,backfilled_at timestamptz,backfill_reason text,
      foreign key(user_id,device_id) references public.devices(user_id,id));
    insert into public.notes values
      ('${noteId}','yeonsik-main','Title','Content','2026-08-01',null,'device-a','2026-08-01',false,null,null),
      ('00000000-0000-4000-8000-000000000012','yeonsik-main','Deleted','Keep deleted','2026-08-01','2026-08-01','device-b','2026-08-01',false,null,null);
  `);
  // Use the actual production LWW function, including its equal-time rejection.
  const base = readFileSync(new URL("20260910130049_dev_control_v1.sql", migrationDirectory), "utf8");
  await db.exec(base.match(/create or replace function public\.prevent_stale_sync_write\(\)[\s\S]*?\$\$;/)![0]);
  await db.exec("create trigger notes_lww_guard before insert or update on public.notes for each row execute function public.prevent_stale_sync_write()");
}, 60_000);
afterEach(async () => { await db?.close(); });

function transport(): SnapshotTransport {
  return {
    async upsertRows(table, values) {
      const rows = Array.isArray(values) ? values : [values];
      const assignments = table === "devices"
        ? "name=excluded.name,last_seen_at=excluded.last_seen_at,app_version=excluded.app_version"
        : "user_id=excluded.user_id,title=excluded.title,content=excluded.content,updated_at=excluded.updated_at,deleted_at=excluded.deleted_at,device_id=excluded.device_id";
      if (table !== "devices" && table !== "notes") throw new Error(`Unexpected table: ${table}`);
      await db.query(`insert into public.${table} select * from jsonb_populate_recordset(null::public.${table}, $1)
        on conflict (${table === "devices" ? "user_id,id" : "id"}) do update set ${assignments}`, [JSON.stringify(rows)]);
      return { error: null };
    },
    async selectRows<Row>(table: string, userId: string, options?: { ids?: string[] }) {
      if (table !== "notes") throw new Error(`Unexpected table: ${table}`);
      const result = await db.query<{ value: Row }>(
        "select to_jsonb(n) as value from public.notes n where user_id=$1 and id=any($2::uuid[])",
        [userId, options?.ids ?? []],
      );
      return { data: result.rows.map(row => row.value), error: null };
    },
  };
}

async function dataWithoutOwner() {
  return (await db.query("select to_jsonb(n)-'user_id' as value from public.notes n order by id")).rows;
}
async function guardEnabled() {
  return (await db.query<{ tgenabled: string }>("select tgenabled from pg_trigger where tgname='notes_lww_guard'")).rows[0].tgenabled;
}

describe("legacy note ownership repair", () => {
  it("reproduces the app error, repairs ownership without changing content/timestamps, and acknowledges the retry", async () => {
    const snapshot = initializeSyncState(makeSnapshot({ notes: [makeNote({ id: noteId })] }), scope, context.device.id);
    const before = await dataWithoutOwner();
    const failed = await pushSnapshotChanges(transport(), snapshot, context, "2026-10-18T00:00:00Z");
    expect((failed.error as Error).message).toBe("notes: 전송한 행의 서버 확정값을 확인하지 못했습니다.");
    expect(failed.acknowledged).toEqual([]);
    await db.exec(migration);
    expect(await dataWithoutOwner()).toEqual(before);
    expect(await guardEnabled()).toBe("O");
    expect((await db.query("select id from devices where user_id=$1 and id='device-b'", [owner])).rows).toHaveLength(1);
    const retried = await pushSnapshotChanges(transport(), snapshot, context, "2026-10-18T00:00:01Z");
    expect(retried.error).toBeNull();
    expect(reconcilePush(snapshot, retried.snapshot, retried.acknowledged).syncState?.pending).toEqual([]);
    await db.exec(migration);
    expect(await dataWithoutOwner()).toEqual(before);
  });

  it("lets newer offline edits win and continues rejecting stale tombstone resurrection", async () => {
    await db.exec(migration);
    const snapshot = initializeSyncState(makeSnapshot({ notes: [makeNote({
      id: noteId, content: "Offline edit", updatedAt: "2026-08-02T00:00:00Z",
    })] }), scope, context.device.id);
    const result = await pushSnapshotChanges(transport(), snapshot, context, "2026-10-18T00:00:00Z");
    expect(result.error).toBeNull();
    expect(result.snapshot.notes[0].content).toBe("Offline edit");
    await db.exec("update public.notes set deleted_at=null,updated_at='2026-07-31' where device_id='device-b'");
    expect((await db.query("select id from public.notes where deleted_at is not null")).rows).toHaveLength(1);
  });

  it("rolls back an ambiguous account mapping and leaves the LWW guard enabled", async () => {
    const before = await dataWithoutOwner();
    await db.exec("insert into auth.users values('00000000-0000-4000-8000-000000000002')");
    await expect(db.exec(migration)).rejects.toThrow(/exactly one/);
    await db.exec("rollback");
    expect(await dataWithoutOwner()).toEqual(before);
    expect((await db.query("select id from notes where user_id='yeonsik-main'")).rows).toHaveLength(2);
    expect(await guardEnabled()).toBe("O");
  });

  it("requires the prior Task migration and leaves unknown legacy owners untouched", async () => {
    await db.exec("delete from public.tasks");
    await expect(db.exec(migration)).rejects.toThrow(/Task account migration/);
    await db.exec("rollback");
    await db.exec(`insert into public.tasks values('${noteId}','${owner}');
      insert into public.devices values('unrelated','device-c','Other','2026-08-01','1');
      insert into public.notes(id,user_id,title,device_id,updated_at) values
        ('00000000-0000-4000-8000-000000000013','unrelated','Other','device-c','2026-08-01');`);
    await db.exec(migration);
    expect((await db.query("select user_id from notes where device_id='device-c'")).rows).toEqual([{ user_id: "unrelated" }]);
    expect(await guardEnabled()).toBe("O");
  });
});
