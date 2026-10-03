import { describe, expect, it, vi } from "vitest";
import type { SyncContext } from "../syncTypes";
import { noteToRow, workoutRecordToRow } from "./mappers";
import type { SnapshotTableName } from "./rows";
import {
  createPushPayload,
  createSupabaseSnapshotTransport,
  pullSnapshot,
  pushSnapshot,
  SNAPSHOT_PAGE_SIZE,
  type SnapshotQueryResult,
  type SnapshotTransport,
  type SnapshotWriteResult,
} from "./snapshotIo";
import {
  makeDevice,
  makeMealRecord,
  makeNote,
  makeProject,
  makeProjectAction,
  makeProjectHistory,
  makeProjectIdea,
  makeProjectMilestone,
  makeSnapshot,
  makeTask,
  makeWeightRecord,
  makeWorkoutRecord,
  makeWorkstream,
  makeWorkstreamAction,
  makeWorkstreamActionDependency,
  makeWorkstreamActionProject,
  makeWorkstreamMilestone,
  makeWorkstreamProject,
} from "./testFixtures";

class FakeSnapshotTransport implements SnapshotTransport {
  fitnessReadModels?: SnapshotTransport["fitnessReadModels"];
  readonly selectCalls: Array<{ tableName: SnapshotTableName; userId: string }> = [];
  readonly upsertCalls: Array<{
    tableName: SnapshotTableName;
    values: unknown;
    onConflict: string;
  }> = [];
  readonly selectedRows = new Map<SnapshotTableName, SnapshotQueryResult<unknown>>();
  readonly writeErrors = new Map<SnapshotTableName, unknown>();

  async selectRows<Row>(
    tableName: SnapshotTableName,
    userId: string,
  ): Promise<SnapshotQueryResult<Row>> {
    this.selectCalls.push({ tableName, userId });
    const result = this.selectedRows.get(tableName) ?? { data: [], error: null };
    return result as SnapshotQueryResult<Row>;
  }

  async upsertRows<Row>(
    tableName: SnapshotTableName,
    values: Row | Row[],
    onConflict: string,
  ): Promise<SnapshotWriteResult> {
    this.upsertCalls.push({ tableName, values, onConflict });
    return { error: this.writeErrors.get(tableName) ?? null };
  }
}

const context: SyncContext = {
  userId: "user-1",
  device: makeDevice({ id: "device-a" }),
};

const workoutProjectionRow = {
  id: "projection-1",
  user_id: "user-1",
  source_fitness_session_id: "session-1",
  date: "2026-08-02",
  completion_status: "completed",
  chest_sets: 4,
  back_sets: 0,
  legs_sets: 0,
  shoulders_sets: 0,
  abs_sets: 0,
  triceps_sets: 0,
  biceps_sets: 0,
  total_duration_seconds: 1800,
  cardio_duration_seconds: null,
  contract_version: 2,
  created_at: "2026-08-02T00:00:00.000Z",
  updated_at: "2026-08-02T00:00:00.000Z",
  deleted_at: null,
  device_id: "fitness-phone",
};

const nutritionSummaryRow = {
  id: "2026-08-02",
  user_id: "user-1",
  date: "2026-08-02",
  contract_version: 1,
  meal_count: 1,
  calories: 600,
  carbs_grams: 70,
  protein_grams: 40,
  fat_grams: 20,
  updated_at: "2026-08-02T00:00:00.000Z",
};

const fitnessWeightRow = {
  id: "fitness-weight-live",
  user_id: "user-1",
  date: "2026-08-02",
  weight_kg: 72,
  source_app: "fitness",
  scope: "fitness",
  metadata: {},
  contract_version: 1,
  updated_at: "2026-08-02T00:00:00.000Z",
  deleted_at: null,
  device_id: "fitness-phone",
};

describe("Supabase snapshot IO", () => {
  it("paginates every snapshot table through the common transport", async () => {
    const ranges = new Map<SnapshotTableName, Array<[number, number]>>();
    const supabase = {
      from: vi.fn((tableName: SnapshotTableName) => ({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            order: vi.fn(() => ({
              range: vi.fn(async (from: number, to: number) => {
                const tableRanges = ranges.get(tableName) ?? [];
                tableRanges.push([from, to]);
                ranges.set(tableName, tableRanges);
                const rowCount =
                  from === 0 ? SNAPSHOT_PAGE_SIZE : 1;
                return {
                  data: Array.from({ length: rowCount }, (_, index) => ({
                    id: `${tableName}-${from + index}`,
                  })),
                  error: null,
                };
              }),
            })),
          })),
        })),
      })),
    };
    const transport = createSupabaseSnapshotTransport(
      supabase as never,
    );
    const tableNames: SnapshotTableName[] = [
      "notes",
      "tasks",
      "fitness_nutrition_summary_v1",
      "fitness_summary_projections_v2",
      "workout_records",
      "weight_records",
      "devices",
      "projects",
      "project_milestones",
      "project_actions",
      "project_ideas",
      "project_history",
      "workstreams",
      "workstream_projects",
      "workstream_milestones",
      "workstream_actions",
      "workstream_action_projects",
      "workstream_action_dependencies",
    ];

    for (const tableName of tableNames) {
      const result = await transport.selectRows(tableName, "user-1");
      expect(result.data).toHaveLength(SNAPSHOT_PAGE_SIZE + 1);
    }

    for (const tableName of tableNames) {
      expect(ranges.get(tableName)).toEqual([
        [0, SNAPSHOT_PAGE_SIZE - 1],
        [SNAPSHOT_PAGE_SIZE, SNAPSHOT_PAGE_SIZE * 2 - 1],
      ]);
    }
  });

  it("pulls all snapshot tables and merges mapped rows into the local snapshot", async () => {
    const transport = new FakeSnapshotTransport();
    transport.selectedRows.set("notes", {
      data: [
        noteToRow(
          makeNote({
            content: "remote",
            updatedAt: "2026-08-01T00:00:02.000Z",
          }),
          context.userId,
        ),
      ],
      error: null,
    });
    const local = makeSnapshot({
      notes: [
        makeNote({
          content: "local",
          updatedAt: "2026-08-01T00:00:01.000Z",
        }),
      ],
    });

    const result = await pullSnapshot(transport, local, context.userId);

    expect(transport.selectCalls.map((call) => call.tableName)).toEqual([
      "notes",
      "tasks",
      "fitness_nutrition_summary_v1",
      "fitness_summary_projections_v2",
      "workout_records",
      "weight_records",
      "devices",
      "projects",
      "project_milestones",
      "project_actions",
      "project_ideas",
      "project_history",
      "workstreams",
      "workstream_projects",
      "workstream_milestones",
      "workstream_actions",
      "workstream_action_projects",
      "workstream_action_dependencies",
      "knowledge_documents",
    ]);
    expect(result.notes[0].content).toBe("remote");
  });

  it("reads completed Fitness v1 rows with a missing contract column without pushing them", async () => {
    const transport = new FakeSnapshotTransport();
    const shared = makeWorkoutRecord({
      id: "fitness-legs",
      category: "하체",
      sourceApp: "fitness",
      scope: "both",
      metadata: { status: "completed" },
    });
    const fitnessOnly = makeWorkoutRecord({
      ...shared,
      id: "fitness-only",
      scope: "fitness",
    });
    const inProgress = makeWorkoutRecord({
      ...shared,
      id: "in-progress",
      metadata: { status: "in_progress" },
    });
    const deleted = makeWorkoutRecord({
      ...shared,
      id: "deleted",
      deletedAt: "2026-08-03T00:00:00.000Z",
    });
    const row = workoutRecordToRow(shared, context.userId);
    delete (row as { contract_version?: number }).contract_version;
    transport.selectedRows.set("workout_records", {
      data: [
        row,
        workoutRecordToRow(fitnessOnly, context.userId),
        workoutRecordToRow(inProgress, context.userId),
        workoutRecordToRow(deleted, context.userId),
      ],
      error: null,
    });

    const result = await pullSnapshot(transport, makeSnapshot(), context.userId);
    expect(result.workoutRecords).toEqual([]);
    expect(result.fitnessSharedWorkoutRecords).toMatchObject([{
      id: "fitness-legs",
      category: "하체",
      contractVersion: 1,
    }]);
    expect(transport.fitnessReadModels?.workout.state).toBe("connected");

    await pushSnapshot(transport, result, context, shared.updatedAt);
    expect(transport.upsertCalls.map((call) => call.tableName)).not.toContain("workout_records");
  });

  it("filters cached Fitness v1 rows when the remote read fails", async () => {
    const transport = new FakeSnapshotTransport();
    transport.selectedRows.set("workout_records", {
      data: null,
      error: { code: "42501", message: "workout_records RLS denied" },
    });
    const shared = makeWorkoutRecord({
      id: "shared-legs",
      sourceApp: "fitness",
      scope: "both",
      category: "하체",
      metadata: { status: "completed" },
    });
    const privateRecord = makeWorkoutRecord({
      ...shared,
      id: "private-legs",
      scope: "fitness",
    });

    const result = await pullSnapshot(
      transport,
      makeSnapshot({ fitnessSharedWorkoutRecords: [shared, privateRecord] }),
      context.userId,
    );

    expect(result.fitnessSharedWorkoutRecords?.map((record) => record.id))
      .toEqual(["shared-legs"]);
  });

  it("replaces only the remote Fitness read model after an empty pull", async () => {
    const archived = makeWorkoutRecord({ id: "local-archive" });
    const staleShared = makeWorkoutRecord({
      id: "old-remote",
      sourceApp: "fitness",
      scope: "both",
      metadata: { status: "completed" },
    });
    const result = await pullSnapshot(
      new FakeSnapshotTransport(),
      makeSnapshot({
        workoutRecords: [archived],
        fitnessSharedWorkoutRecords: [staleShared],
      }),
      context.userId,
    );
    expect(result.workoutRecords).toEqual([archived]);
    expect(result.fitnessSharedWorkoutRecords).toEqual([]);
  });

  it("pulls read-only weights while preserving legacy workout and meal archives", async () => {
    const transport = new FakeSnapshotTransport();
    transport.selectedRows.set("weight_records", {
      data: [{
        id: "fitness-weight-1",
        user_id: context.userId,
        date: "2026-08-02",
        weight_kg: 72,
        source_app: "fitness",
        scope: "both",
        metadata: {},
        contract_version: 1,
        updated_at: "2026-08-02T00:00:00.000Z",
        deleted_at: null,
        device_id: "fitness-phone",
      }],
      error: null,
    });
    const archivedWorkout = makeWorkoutRecord();
    const archivedMeal = makeMealRecord();
    const cachedWeight = makeWeightRecord({
      id: "fitness-weight-1",
      date: "2026-08-01",
      weightKg: 74,
      sourceApp: "fitness",
      scope: "both",
      updatedAt: "2026-08-01T00:00:00.000Z",
    });

    const result = await pullSnapshot(
      transport,
      makeSnapshot({
        workoutRecords: [archivedWorkout],
        mealRecords: [archivedMeal],
        weightRecords: [cachedWeight],
      }),
      context.userId,
    );

    expect(result.workoutRecords).toEqual([archivedWorkout]);
    expect(result.mealRecords).toEqual([archivedMeal]);
    expect(result.fitnessWeightRecords?.find((record) => record.id === "fitness-weight-1")).toMatchObject({
      date: "2026-08-02",
      weightKg: 72,
    });
    const pulledTables = transport.selectCalls.map((call) => call.tableName);
    expect(pulledTables).toContain("fitness_summary_projections_v2");
    expect(pulledTables).toContain("fitness_nutrition_summary_v1");
    expect(pulledTables).toContain("weight_records");
    expect(pulledTables).toContain("workout_records");
    expect(pulledTables).not.toContain("meal_records");
  });
  it.each([
    {
      name: "missing nutrition view (404)",
      error: {
        code: "PGRST205",
        status: 404,
        message: "Could not find the table 'public.fitness_nutrition_summary_v1' in the schema cache",
      },
      detail: "20260922090000_fitness_nutrition_summary_v1.sql",
    },
    {
      name: "nutrition permission/RLS denial",
      error: {
        code: "42501",
        status: 403,
        message: "permission denied for view fitness_nutrition_summary_v1",
      },
      detail: "인증/권한/RLS",
    },
  ])("keeps workout and weight available after $name", async ({ error, detail }) => {
    const transport = new FakeSnapshotTransport();
    transport.selectedRows.set("fitness_nutrition_summary_v1", { data: null, error });
    transport.selectedRows.set("fitness_summary_projections_v2", {
      data: [workoutProjectionRow], error: null,
    });
    transport.selectedRows.set("weight_records", { data: [fitnessWeightRow], error: null });
    const cachedNutrition = {
      id: "2026-08-01",
      date: "2026-08-01",
      contractVersion: 1 as const,
      mealCount: 1,
      calories: 500,
      carbsGrams: 40,
      proteinGrams: 30,
      fatGrams: 10,
      updatedAt: "2026-08-01T00:00:00.000Z",
    };

    const result = await pullSnapshot(
      transport,
      makeSnapshot({ fitnessNutritionSummaries: [cachedNutrition] }),
      context.userId,
    );

    expect(result.fitnessSummaryProjections.map((row) => row.id)).toContain("projection-1");
    expect(result.fitnessWeightRecords?.map((row) => row.id)).toContain("fitness-weight-live");
    expect(result.fitnessNutritionSummaries).toEqual([cachedNutrition]);
    expect(transport.fitnessReadModels).toMatchObject({
      workout: { state: "connected" },
      nutrition: { state: "error" },
      weight: { state: "connected" },
    });
    expect(transport.fitnessReadModels?.nutrition.detail).toContain(detail);
  });

  it("keeps nutrition and weight available when the workout projection query fails", async () => {
    const transport = new FakeSnapshotTransport();
    transport.selectedRows.set("fitness_summary_projections_v2", {
      data: null,
      error: { code: "42501", status: 403, message: "workout projection RLS denied" },
    });
    transport.selectedRows.set("fitness_nutrition_summary_v1", {
      data: [nutritionSummaryRow], error: null,
    });
    transport.selectedRows.set("weight_records", { data: [fitnessWeightRow], error: null });

    const result = await pullSnapshot(transport, makeSnapshot(), context.userId);

    expect(result.fitnessSummaryProjections).toEqual([]);
    expect(result.fitnessNutritionSummaries?.map((row) => row.id)).toContain("2026-08-02");
    expect(result.fitnessWeightRecords?.map((row) => row.id)).toContain("fitness-weight-live");
    expect(transport.fitnessReadModels).toMatchObject({
      workout: { state: "error" },
      nutrition: { state: "connected" },
      weight: { state: "connected" },
    });
  });

  it("keeps workout and nutrition available when the weight query fails", async () => {
    const transport = new FakeSnapshotTransport();
    transport.selectedRows.set("fitness_summary_projections_v2", {
      data: [workoutProjectionRow], error: null,
    });
    transport.selectedRows.set("fitness_nutrition_summary_v1", {
      data: [nutritionSummaryRow], error: null,
    });
    transport.selectedRows.set("weight_records", {
      data: null,
      error: { code: "42501", status: 403, message: "weight_records RLS denied" },
    });

    const result = await pullSnapshot(transport, makeSnapshot(), context.userId);

    expect(result.fitnessSummaryProjections.map((row) => row.id)).toContain("projection-1");
    expect(result.fitnessNutritionSummaries?.map((row) => row.id)).toContain("2026-08-02");
    expect(transport.fitnessReadModels).toMatchObject({
      workout: { state: "connected" },
      nutrition: { state: "connected" },
      weight: { state: "error" },
    });
  });

  it("removes nutrition dates omitted by the next full view pull", async () => {
    const transport = new FakeSnapshotTransport();
    transport.selectedRows.set("fitness_nutrition_summary_v1", { data: [], error: null });
    const oldSummary = {
      id: "2026-08-01",
      date: "2026-08-01",
      contractVersion: 1 as const,
      mealCount: 1,
      calories: 500,
      carbsGrams: 40,
      proteinGrams: 30,
      fatGrams: 10,
      updatedAt: "2026-08-01T00:00:00.000Z",
    };

    const result = await pullSnapshot(
      transport,
      makeSnapshot({ fitnessNutritionSummaries: [oldSummary] }),
      context.userId,
    );

    expect(result.fitnessNutritionSummaries).toEqual([]);
  });
  it("fails the pull when any table query fails", async () => {
    const transport = new FakeSnapshotTransport();
    const queryError = new Error("RLS denied tasks");
    transport.selectedRows.set("tasks", { data: null, error: queryError });

    await expect(
      pullSnapshot(transport, makeSnapshot(), context.userId),
    ).rejects.toBe(queryError);
  });

  it("builds a current-device-only payload while retaining tombstones", () => {
    const deletedAt = "2026-08-01T00:00:03.000Z";
    const snapshot = makeSnapshot({
      notes: [
        makeNote({ deletedAt, updatedAt: deletedAt, deviceId: "device-a" }),
        makeNote({ id: "note-b", deviceId: "device-b" }),
      ],
    });

    const payload = createPushPayload(
      snapshot,
      context,
      "2026-08-01T00:00:04.000Z",
    );

    expect(payload.notes).toHaveLength(1);
    expect(payload.notes[0]).toMatchObject({
      user_id: context.userId,
      device_id: "device-a",
      deleted_at: deletedAt,
    });
    expect(payload.device).toMatchObject({
      user_id: context.userId,
      id: "device-a",
      last_seen_at: "2026-08-01T00:00:04.000Z",
    });
    expect(JSON.stringify(payload)).not.toContain("access_token");
    expect(JSON.stringify(payload)).not.toContain("refresh_token");
    expect(payload).not.toHaveProperty("workoutRecords");
    expect(payload).not.toHaveProperty("mealRecords");
    expect(payload).not.toHaveProperty("weightRecords");
    expect(payload).not.toHaveProperty("fitnessSummaryProjections");
    expect(payload).not.toHaveProperty("fitnessNutritionSummaries");
  });

  it("pushes device then entity batches with the canonical conflicts", async () => {
    const transport = new FakeSnapshotTransport();
    const snapshot = makeSnapshot({
      notes: [makeNote()],
      tasks: [makeTask()],
      workoutRecords: [makeWorkoutRecord()],
      mealRecords: [makeMealRecord()],
      weightRecords: [makeWeightRecord()],
      projects: [makeProject()],
      projectMilestones: [makeProjectMilestone()],
      projectActions: [makeProjectAction()],
      projectIdeas: [makeProjectIdea()],
      projectHistory: [makeProjectHistory()],
      workstreams: [makeWorkstream()],
      workstreamProjects: [makeWorkstreamProject()],
      workstreamMilestones: [makeWorkstreamMilestone()],
      workstreamActions: [makeWorkstreamAction()],
      workstreamActionProjects: [makeWorkstreamActionProject()],
      workstreamActionDependencies: [makeWorkstreamActionDependency()],
    });

    const result = await pushSnapshot(
      transport,
      snapshot,
      context,
      "2026-08-01T00:00:05.000Z",
    );

    expect(transport.upsertCalls.map((call) => call.tableName)).toEqual([
      "devices",
      "projects",
      "workstreams",
      "notes",
      "tasks",
      "project_milestones",
      "project_actions",
      "project_ideas",
      "project_history",
      "workstream_projects",
      "workstream_milestones",
      "workstream_actions",
      "workstream_action_projects",
      "workstream_action_dependencies",
    ]);
    expect(transport.upsertCalls.map((call) => call.onConflict)).toEqual([
      "user_id,id",
      "id",
      "id",
      "id",
      "id",
      "id",
      "id",
      "id",
      "id",
      "id",
      "id",
      "id",
      "id",
      "id",
    ]);
    expect(result.changedRows).toBe(14);
    expect(result.currentDevice.lastSeenAt).toBe("2026-08-01T00:00:05.000Z");
  });

  it("stops and reports the write error instead of claiming later batches", async () => {
    const transport = new FakeSnapshotTransport();
    const writeError = new Error("tasks upsert failed");
    transport.writeErrors.set("tasks", writeError);
    const snapshot = makeSnapshot({
      notes: [makeNote()],
      tasks: [makeTask()],
      workoutRecords: [makeWorkoutRecord()],
    });

    await expect(
      pushSnapshot(
        transport,
        snapshot,
        context,
        "2026-08-01T00:00:05.000Z",
      ),
    ).rejects.toBe(writeError);
    expect(transport.upsertCalls.map((call) => call.tableName)).toEqual([
      "devices",
      "notes",
      "tasks",
    ]);
  });
});
