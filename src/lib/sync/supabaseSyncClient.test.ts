import { describe, expect, it, vi } from "vitest";
import {
  SupabaseSyncClient,
  createSupabaseSyncClient,
} from "./supabaseSyncClient";
import type { SnapshotTableName, SupabaseClient } from "./supabase/rows";
import { noteToRow } from "./supabase/mappers";
import {
  makeDevice,
  makeNote,
  makeSnapshot,
  makeTask,
} from "./supabase/testFixtures";

interface FakeClientOptions {
  userId?: string | null;
  sessionError?: Error | null;
  selectError?: Error | null;
  selectErrorsByTable?: Partial<Record<SnapshotTableName, unknown>>;
  rowsByTable?: Partial<Record<SnapshotTableName, unknown[]>>;
  upsertErrorsByTable?: Partial<Record<SnapshotTableName, Error>>;
}

function createFakeClient({
  userId = null,
  sessionError = null,
  selectError = null,
  selectErrorsByTable = {},
  rowsByTable = {},
  upsertErrorsByTable = {},
}: FakeClientOptions = {}) {
  const select = vi.fn((tableName: SnapshotTableName) => ({
    eq: vi.fn(() => ({
      order: vi.fn(() => ({
        range: vi.fn(async (from: number, to: number) => ({
          data: (rowsByTable[tableName] ?? []).slice(from, to + 1),
          error: selectErrorsByTable[tableName] ?? selectError,
        })),
      })),
    })),
  }));
  const upsert = vi.fn((tableName: SnapshotTableName) =>
    Promise.resolve({ error: upsertErrorsByTable[tableName] ?? null }),
  );
  const session = userId
    ? { user: { id: userId, email: `${userId}@example.com` } }
    : null;
  const client = {
    auth: {
      onAuthStateChange: vi.fn(),
      getSession: vi.fn(async () => ({
        data: { session },
        error: sessionError,
      })),
      signInWithPassword: vi.fn(),
      signOut: vi.fn(async () => ({ error: null })),
    },
    from: vi.fn((tableName: SnapshotTableName) => ({
      select: () => select(tableName),
      upsert: () => upsert(tableName),
    })),
  };

  return {
    client: client as unknown as SupabaseClient,
    select,
    upsert,
    auth: client.auth,
  };
}

function createConfiguredClient(
  fakeClient: SupabaseClient,
  getOnlineState: () => boolean,
): SupabaseSyncClient {
  return new SupabaseSyncClient({
    supabaseUrl: "https://example.supabase.co",
    supabaseAnonKey: "anon-key",
    dependencies: {
      createClient: () => fakeClient,
      getOnlineState,
      now: () => new Date("2026-08-01T00:00:00.000Z"),
    },
  });
}

describe("SupabaseSyncClient facade", () => {
  it("preserves the public factory and local-only behavior", async () => {
    const client = createSupabaseSyncClient();
    const snapshot = makeSnapshot();

    expect(client).toBeInstanceOf(SupabaseSyncClient);
    expect(client.isConfigured()).toBe(false);
    await expect(client.getAuthState()).resolves.toEqual({
      userId: null,
      email: null,
    });
    await expect(client.signIn("user@example.com", "password")).rejects.toThrow(
      "Supabase 연결 설정을 먼저 저장하세요.",
    );
    await expect(
      client.pull(snapshot, { userId: "user-1", device: makeDevice() }),
    ).resolves.toBe(snapshot);
    expect(client.getStatus().mode).toBe("local-only");
  });

  it("does not query remote tables for an unauthenticated user", async () => {
    const fake = createFakeClient();
    const client = createConfiguredClient(fake.client, () => true);
    const snapshot = makeSnapshot();

    await expect(
      client.pull(snapshot, { userId: "user-1", device: makeDevice() }),
    ).resolves.toBe(snapshot);
    expect(fake.select).not.toHaveBeenCalled();
    expect(client.getStatus()).toMatchObject({
      mode: "offline",
      detail: "원격 동기화를 사용하려면 로그인하세요.",
    });
  });

  it("does not query remote tables while offline even with a session", async () => {
    const fake = createFakeClient({ userId: "user-1" });
    const client = createConfiguredClient(fake.client, () => false);
    const snapshot = makeSnapshot();

    await expect(
      client.push(snapshot, { userId: "user-1", device: makeDevice() }),
    ).resolves.toMatchObject({ changedRows: 0, status: { mode: "offline" } });
    expect(fake.select).not.toHaveBeenCalled();
  });

  it("keeps the local snapshot and exposes a query error status", async () => {
    const queryError = new Error("RLS denied");
    const fake = createFakeClient({
      userId: "user-1",
      selectError: queryError,
    });
    const client = createConfiguredClient(fake.client, () => true);
    const snapshot = makeSnapshot();

    await expect(
      client.pull(snapshot, { userId: "user-1", device: makeDevice() }),
    ).resolves.toBe(snapshot);
    expect(fake.select).toHaveBeenCalledTimes(19);
    expect(client.getStatus()).toMatchObject({
      mode: "error",
      detail: "RLS denied",
    });
  });

  it("reports source-specific partial Fitness failures while core sync succeeds", async () => {
    const fake = createFakeClient({
      userId: "user-1",
      selectErrorsByTable: {
        fitness_nutrition_summary_v1: {
          code: "PGRST205",
          status: 404,
          message: "Could not find the table 'public.fitness_nutrition_summary_v1' in the schema cache",
        },
      },
    });
    const client = createConfiguredClient(fake.client, () => true);

    const result = await client.pull(makeSnapshot(), {
      userId: "user-1",
      device: makeDevice(),
    });

    expect(result.notes).toEqual([]);
    expect(result.tasks).toEqual([]);
    expect(result.fitnessSummaryProjections).toEqual([]);
    expect(client.getStatus()).toMatchObject({
      mode: "synced",
      fitnessReadModels: {
        workout: { state: "empty" },
        nutrition: {
          state: "error",
          detail: expect.stringContaining("20260922090000_fitness_nutrition_summary_v1.sql"),
        },
        weight: { state: "empty" },
      },
      detail: expect.stringContaining("Fitness read model 부분 실패"),
    });
  });

  it("pulls the authoritative server value after a stale write is accepted", async () => {
    const fake = createFakeClient({
      userId: "user-1",
      rowsByTable: {
        notes: [
          noteToRow(
            makeNote({
              content: "server value",
              updatedAt: "2026-08-01T00:00:02.000Z",
            }),
            "user-1",
          ),
        ],
      },
    });
    const client = createConfiguredClient(fake.client, () => true);
    const staleSnapshot = makeSnapshot({
      notes: [
        makeNote({
          content: "stale local value",
          updatedAt: "2026-08-01T00:00:01.000Z",
        }),
      ],
    });

    const result = await client.push(staleSnapshot, {
      userId: "user-1",
      device: makeDevice(),
    });

    expect(result.status.mode).toBe("synced");
    expect(result.snapshot?.notes[0].content).toBe("server value");
    expect(fake.select).toHaveBeenCalledTimes(19);
  });

  it("uses the server value for equal-time active rows during reconciliation", async () => {
    const updatedAt = "2026-08-01T00:00:02.000Z";
    const fake = createFakeClient({
      userId: "user-1",
      rowsByTable: {
        notes: [
          noteToRow(
            makeNote({ content: "server value", updatedAt }),
            "user-1",
          ),
        ],
      },
    });
    const client = createConfiguredClient(fake.client, () => true);

    const result = await client.push(
      makeSnapshot({
        notes: [makeNote({ content: "local value", updatedAt })],
      }),
      { userId: "user-1", device: makeDevice() },
    );

    expect(result.status.mode).toBe("synced");
    expect(result.snapshot?.notes[0].content).toBe("server value");
  });

  it("reports a partial push failure instead of marking sync successful", async () => {
    const writeError = new Error("tasks upsert failed");
    const fake = createFakeClient({
      userId: "user-1",
      upsertErrorsByTable: { tasks: writeError },
    });
    const client = createConfiguredClient(fake.client, () => true);

    const result = await client.push(
      makeSnapshot({
        notes: [makeNote()],
        tasks: [makeTask()],
      }),
      { userId: "user-1", device: makeDevice() },
    );

    expect(result.status.mode).toBe("error");
    expect(result.snapshot).toBeUndefined();
    expect(result.status.detail).toBe("tasks upsert failed");
  });

  it("propagates auth session errors before remote IO", async () => {
    const sessionError = new Error("session storage unavailable");
    const fake = createFakeClient({ sessionError });
    const client = createConfiguredClient(fake.client, () => true);

    await expect(
      client.pull(makeSnapshot(), {
        userId: "user-1",
        device: makeDevice(),
      }),
    ).rejects.toBe(sessionError);
    expect(fake.select).not.toHaveBeenCalled();
  });
});
