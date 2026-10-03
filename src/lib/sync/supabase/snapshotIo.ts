import { fitnessNutritionSummaryFromRow } from "../../../features/fitness-summary/fitnessNutritionContract";
import type { Device, LegacyWorkoutRecordV1, LocalDataSnapshot } from "../../../types";
import type { SyncContext } from "../syncTypes";
import {
  deviceFromRow,
  deviceToRow,
  fitnessSummaryProjectionV2FromRow,
  knowledgeDocumentFromRow,
  knowledgeDocumentToRow,
  noteFromRow,
  noteToRow,
  projectActionFromRow,
  projectActionToRow,
  projectFromRow,
  projectHistoryFromRow,
  projectHistoryToRow,
  projectIdeaFromRow,
  projectIdeaToRow,
  projectMilestoneFromRow,
  projectMilestoneToRow,
  projectToRow,
  workstreamActionDependencyFromRow,
  workstreamActionDependencyToRow,
  workstreamActionFromRow,
  workstreamActionProjectFromRow,
  workstreamActionProjectToRow,
  workstreamActionToRow,
  workstreamFromRow,
  workstreamMilestoneFromRow,
  workstreamMilestoneToRow,
  workstreamProjectFromRow,
  workstreamProjectToRow,
  workstreamToRow,
  taskFromRow,
  taskToRow,
  weightRecordFromRow,
  workoutRecordFromRow,
} from "./mappers";
import type {
  DeviceRow,
  FitnessSummaryProjectionV2Row,
  KnowledgeDocumentRow,
  NoteRow,
  ProjectActionRow,
  ProjectHistoryRow,
  ProjectIdeaRow,
  ProjectMilestoneRow,
  ProjectRow,
  SnapshotTableName,
  SupabaseClient,
  TaskRow,
  WeightRecordRow,
  WorkoutRecordRow,
  WorkstreamActionDependencyRow,
  WorkstreamActionProjectRow,
  WorkstreamActionRow,
  WorkstreamMilestoneRow,
  WorkstreamProjectRow,
  WorkstreamRow,
} from "./rows";
import type { FitnessReadModelDiagnostics, FitnessReadModelName } from "../syncTypes";
import {
  mergeAuthoritativeSnapshot,
  mergeSnapshot,
} from "./snapshotMerge";

export interface SnapshotQueryResult<Row> {
  data: Row[] | null;
  error: unknown | null;
}

export interface SnapshotWriteResult {
  error: unknown | null;
}

export interface SnapshotTransport {
  fitnessReadModels?: FitnessReadModelDiagnostics;
  selectRows<Row>(
    tableName: SnapshotTableName,
    userId: string,
  ): Promise<SnapshotQueryResult<Row>>;
  upsertRows<Row>(
    tableName: SnapshotTableName,
    values: Row | Row[],
    onConflict: string,
  ): Promise<SnapshotWriteResult>;
}

export const SNAPSHOT_PAGE_SIZE = 1000;

interface SelectTable<Row> {
  select(columns: string): {
    eq(column: string, value: string): {
      order(
        column: string,
        options: { ascending: boolean },
      ): {
        range(from: number, to: number): Promise<SnapshotQueryResult<Row>>;
      };
    };
  };
}

interface UpsertTable<Row> {
  upsert(
    values: Row | Row[],
    options: { onConflict: string },
  ): Promise<SnapshotWriteResult>;
}

export function createSupabaseSnapshotTransport(
  supabase: SupabaseClient,
): SnapshotTransport {
  return {
    async selectRows<Row>(tableName: SnapshotTableName, userId: string) {
      const table = supabase.from(tableName) as unknown as SelectTable<Row>;
      const rows: Row[] = [];

      for (let pageIndex = 0; ; pageIndex += 1) {
        const pageStart = pageIndex * SNAPSHOT_PAGE_SIZE;
        const pageResult = await table
          .select("*")
          .eq("user_id", userId)
          .order("id", { ascending: true })
          .range(pageStart, pageStart + SNAPSHOT_PAGE_SIZE - 1);

        if (pageResult.error) {
          return { data: null, error: pageResult.error };
        }

        const pageRows = pageResult.data ?? [];
        rows.push(...pageRows);

        if (pageRows.length < SNAPSHOT_PAGE_SIZE) {
          return { data: rows, error: null };
        }
      }
    },
    upsertRows<Row>(
      tableName: SnapshotTableName,
      values: Row | Row[],
      onConflict: string,
    ) {
      const table = supabase.from(tableName) as unknown as UpsertTable<Row>;
      return table.upsert(values, { onConflict });
    },
  };
}

function throwQueryError(result: { error: unknown | null }): void {
  if (result.error) {
    throw result.error;
  }
}

function errorFields(error: unknown): Record<string, unknown> {
  if (!error || typeof error !== "object") {
    return { message: String(error ?? "알 수 없는 오류") };
  }
  return error as Record<string, unknown>;
}

function fitnessQueryErrorDetail(
  source: FitnessReadModelName,
  tableName: string,
  error: unknown,
): string {
  const fields = errorFields(error);
  const code = typeof fields.code === "string" ? fields.code : "";
  const status = typeof fields.status === "number" ? fields.status : undefined;
  const message = typeof fields.message === "string" ? fields.message : String(error);
  const hint = typeof fields.hint === "string" ? fields.hint : "";
  const details = typeof fields.details === "string" ? fields.details : "";
  const serverDetail = [message, details, hint].filter(Boolean).join(" · ");
  const suffix = [code && `code ${code}`, status && `HTTP ${status}`]
    .filter(Boolean)
    .join(", ");
  const context = suffix ? ` (${suffix})` : "";

  if (
    source === "nutrition" &&
    (code === "42P01" || code === "PGRST205" || status === 404 ||
      /does not exist|could not find.*schema cache|not find the table/i.test(message))
  ) {
    return `${tableName} view를 현재 Supabase 프로젝트에서 찾지 못했습니다${context}. 프로젝트 URL/ref와 PostgREST schema cache를 확인하고 migration 20260922090000_fitness_nutrition_summary_v1.sql을 적용하세요. 서버 응답: ${serverDetail}`;
  }

  if (code === "42501" || status === 401 || status === 403) {
    return `${tableName} 접근이 인증/권한/RLS에 의해 거부됐습니다${context}. 같은 Supabase 프로젝트의 로그인 계정과 authenticated SELECT 권한을 확인하세요. 서버 응답: ${serverDetail}`;
  }

  return `${tableName} read query 실패${context}. Supabase project URL/ref, 인증 및 RLS를 확인하세요. 서버 응답: ${serverDetail}`;
}

function fitnessReadModelStatus(
  source: FitnessReadModelName,
  tableName: string,
  rows: unknown[] | null,
  error: unknown | null,
) {
  if (error) {
    return {
      state: "error" as const,
      detail: fitnessQueryErrorDetail(source, tableName, error),
    };
  }
  return rows && rows.length > 0
    ? { state: "connected" as const, detail: `${tableName}: ${rows.length}개 row` }
    : { state: "empty" as const, detail: `${tableName}: row 없음` };
}

function fitnessWeightReadModelStatus(
  rows: unknown[] | null,
  error: unknown | null,
) {
  const status = fitnessReadModelStatus(
    "weight",
    "weight_records (Fitness-owned)",
    rows,
    error,
  );

  if (status.state === "error") {
    return status;
  }

  const activeRowCount = (rows ?? []).filter(
    (row) =>
      typeof row === "object" &&
      row !== null &&
      "deletedAt" in row &&
      row.deletedAt === null,
  ).length;

  return {
    ...status,
    detail: `${status.detail} · 삭제되지 않은 row ${activeRowCount}개`,
  };
}

function isSharedLegacyWorkout(
  record: LegacyWorkoutRecordV1,
): boolean {
  return record.sourceApp === "fitness" &&
    record.scope === "both" &&
    record.deletedAt === null &&
    record.metadata?.status === "completed" &&
    record.category.trim().length > 0;
}

function selectFitnessRows<Row>(
  transport: SnapshotTransport,
  tableName: SnapshotTableName,
  userId: string,
): Promise<SnapshotQueryResult<Row>> {
  try {
    return transport.selectRows<Row>(tableName, userId).catch((error: unknown) => ({
      data: null,
      error,
    }));
  } catch (error) {
    return Promise.resolve({ data: null, error });
  }
}

async function fetchIncomingSnapshot(
  transport: SnapshotTransport,
  userId: string,
  localSnapshot: LocalDataSnapshot,
): Promise<LocalDataSnapshot> {
  const [
    notesResult,
    tasksResult,
    fitnessNutritionSummariesResult,
    fitnessSummaryProjectionsResult,
    workoutRecordsResult,
    weightRecordsResult,
    devicesResult,
    projectsResult,
    projectMilestonesResult,
    projectActionsResult,
    projectIdeasResult,
    projectHistoryResult,
    workstreamsResult,
    workstreamProjectsResult,
    workstreamMilestonesResult,
    workstreamActionsResult,
    workstreamActionProjectsResult,
    workstreamActionDependenciesResult,
    knowledgeDocumentsResult,
  ] = await Promise.all([
    transport.selectRows<NoteRow>("notes", userId),
    transport.selectRows<TaskRow>("tasks", userId),
    selectFitnessRows<unknown>(transport, "fitness_nutrition_summary_v1", userId),
    selectFitnessRows<FitnessSummaryProjectionV2Row>(
      transport,
      "fitness_summary_projections_v2",
      userId,
    ),
    // Read-only v1 compatibility; v2 stays authoritative for each session.
    selectFitnessRows<WorkoutRecordRow>(transport, "workout_records", userId),
    // Compatibility read path only; weight_records never enter a push payload.
    selectFitnessRows<WeightRecordRow>(transport, "weight_records", userId),
    transport.selectRows<DeviceRow>("devices", userId),
    transport.selectRows<ProjectRow>("projects", userId),
    transport.selectRows<ProjectMilestoneRow>("project_milestones", userId),
    transport.selectRows<ProjectActionRow>("project_actions", userId),
    transport.selectRows<ProjectIdeaRow>("project_ideas", userId),
    transport.selectRows<ProjectHistoryRow>("project_history", userId),
    transport.selectRows<WorkstreamRow>("workstreams", userId),
    transport.selectRows<WorkstreamProjectRow>(
      "workstream_projects",
      userId,
    ),
    transport.selectRows<WorkstreamMilestoneRow>(
      "workstream_milestones",
      userId,
    ),
    transport.selectRows<WorkstreamActionRow>("workstream_actions", userId),
    transport.selectRows<WorkstreamActionProjectRow>(
      "workstream_action_projects",
      userId,
    ),
    transport.selectRows<WorkstreamActionDependencyRow>(
      "workstream_action_dependencies",
      userId,
    ),
    transport.selectRows<KnowledgeDocumentRow>("knowledge_documents", userId),
  ]);

  const sharedLegacyWorkouts = (
    workoutRecordsResult.error
      ? localSnapshot.fitnessSharedWorkoutRecords ?? []
      : (workoutRecordsResult.data ?? []).map(workoutRecordFromRow)
  ).filter(isSharedLegacyWorkout);

  const fitnessWeightRecords = weightRecordsResult.error
    ? localSnapshot.fitnessWeightRecords ?? []
    : (weightRecordsResult.data ?? [])
        .map(weightRecordFromRow)
        .filter((record) => record.sourceApp === "fitness" && (record.scope === "fitness" || record.scope === "both"));

  transport.fitnessReadModels = {
    workout: fitnessSummaryProjectionsResult.error
      ? fitnessReadModelStatus(
          "workout",
          "fitness_summary_projections_v2",
          fitnessSummaryProjectionsResult.data,
          fitnessSummaryProjectionsResult.error,
        )
      : fitnessSummaryProjectionsResult.data?.length
        ? fitnessReadModelStatus(
            "workout",
            "fitness_summary_projections_v2",
            fitnessSummaryProjectionsResult.data,
            null,
          )
        : fitnessReadModelStatus(
            "workout",
            "workout_records (Fitness 공유 v1)",
            workoutRecordsResult.error ? null : sharedLegacyWorkouts,
            workoutRecordsResult.error,
          ),
    nutrition: fitnessReadModelStatus(
      "nutrition",
      "fitness_nutrition_summary_v1",
      fitnessNutritionSummariesResult.data,
      fitnessNutritionSummariesResult.error,
    ),
    weight: fitnessWeightReadModelStatus(
      weightRecordsResult.error ? null : fitnessWeightRecords,
      weightRecordsResult.error,
    ),
  };

  // Keep the established fail-fast policy for core Personal OS tables.
  for (const result of [
    notesResult,
    tasksResult,
    devicesResult,
    projectsResult,
    projectMilestonesResult,
    projectActionsResult,
    projectIdeasResult,
    projectHistoryResult,
    workstreamsResult,
    workstreamProjectsResult,
    workstreamMilestonesResult,
    workstreamActionsResult,
    workstreamActionProjectsResult,
    workstreamActionDependenciesResult,
    knowledgeDocumentsResult,
  ]) {
    throwQueryError(result);
  }

  const incomingSnapshot: LocalDataSnapshot = {
    notes: (notesResult.data ?? []).map(noteFromRow),
    tasks: (tasksResult.data ?? []).map(taskFromRow),
    // Preserve the local v1 archive; this full read-only owner view is separate.
    workoutRecords: [],
    fitnessSharedWorkoutRecords: sharedLegacyWorkouts,
    mealRecords: [],
    weightRecords: [],
    fitnessWeightRecords,
    fitnessNutritionSummaries: fitnessNutritionSummariesResult.error
      ? localSnapshot.fitnessNutritionSummaries ?? []
      : (fitnessNutritionSummariesResult.data ?? []).map(fitnessNutritionSummaryFromRow),
    fitnessSummaryProjections: fitnessSummaryProjectionsResult.error
      ? localSnapshot.fitnessSummaryProjections
      : (fitnessSummaryProjectionsResult.data ?? []).map(
          fitnessSummaryProjectionV2FromRow,
        ),
    devices: (devicesResult.data ?? []).map(deviceFromRow),
    projects: (projectsResult.data ?? []).map(projectFromRow),
    projectMilestones: (projectMilestonesResult.data ?? []).map(
      projectMilestoneFromRow,
    ),
    projectActions: (projectActionsResult.data ?? []).map(projectActionFromRow),
    projectIdeas: (projectIdeasResult.data ?? []).map(projectIdeaFromRow),
    projectHistory: (projectHistoryResult.data ?? []).map(projectHistoryFromRow),
    workstreams: (workstreamsResult.data ?? []).map(workstreamFromRow),
    workstreamProjects: (workstreamProjectsResult.data ?? []).map(
      workstreamProjectFromRow,
    ),
    workstreamMilestones: (workstreamMilestonesResult.data ?? []).map(
      workstreamMilestoneFromRow,
    ),
    workstreamActions: (workstreamActionsResult.data ?? []).map(
      workstreamActionFromRow,
    ),
    workstreamActionProjects: (workstreamActionProjectsResult.data ?? []).map(
      workstreamActionProjectFromRow,
    ),
    workstreamActionDependencies: (
      workstreamActionDependenciesResult.data ?? []
    ).map(workstreamActionDependencyFromRow),
    knowledgeDocuments: (knowledgeDocumentsResult.data ?? []).map(
      knowledgeDocumentFromRow,
    ),
  };

  return incomingSnapshot;
}

export async function pullSnapshot(
  transport: SnapshotTransport,
  localSnapshot: LocalDataSnapshot,
  userId: string,
): Promise<LocalDataSnapshot> {
  const incomingSnapshot = await fetchIncomingSnapshot(transport, userId, localSnapshot);
  return mergeSnapshot(localSnapshot, incomingSnapshot);
}

export async function pullSnapshotAuthoritative(
  transport: SnapshotTransport,
  localSnapshot: LocalDataSnapshot,
  userId: string,
): Promise<LocalDataSnapshot> {
  const incomingSnapshot = await fetchIncomingSnapshot(transport, userId, localSnapshot);
  return mergeAuthoritativeSnapshot(localSnapshot, incomingSnapshot);
}

export interface PushPayload {
  currentDevice: Device;
  device: DeviceRow;
  notes: NoteRow[];
  tasks: TaskRow[];
  projects: ProjectRow[];
  projectMilestones: ProjectMilestoneRow[];
  projectActions: ProjectActionRow[];
  projectIdeas: ProjectIdeaRow[];
  projectHistory: ProjectHistoryRow[];
  workstreams: WorkstreamRow[];
  workstreamProjects: WorkstreamProjectRow[];
  workstreamMilestones: WorkstreamMilestoneRow[];
  workstreamActions: WorkstreamActionRow[];
  workstreamActionProjects: WorkstreamActionProjectRow[];
  workstreamActionDependencies: WorkstreamActionDependencyRow[];
  knowledgeDocuments: KnowledgeDocumentRow[];
}

export function createPushPayload(
  localSnapshot: LocalDataSnapshot,
  context: SyncContext,
  lastSeenAt: string,
): PushPayload {
  const currentDevice: Device = {
    ...context.device,
    lastSeenAt,
  };
  const isOwnedByCurrentDevice = (entity: { deviceId: string }) =>
    entity.deviceId === context.device.id;

  return {
    currentDevice,
    device: deviceToRow(currentDevice, context.userId),
    notes: localSnapshot.notes
      .filter(isOwnedByCurrentDevice)
      .map((note) => noteToRow(note, context.userId)),
    tasks: localSnapshot.tasks
      .filter(isOwnedByCurrentDevice)
      .map((task) => taskToRow(task, context.userId)),
    projects: localSnapshot.projects
      .filter(isOwnedByCurrentDevice)
      .map((project) => projectToRow(project, context.userId)),
    projectMilestones: localSnapshot.projectMilestones
      .filter(isOwnedByCurrentDevice)
      .map((milestone) => projectMilestoneToRow(milestone, context.userId)),
    projectActions: localSnapshot.projectActions
      .filter(isOwnedByCurrentDevice)
      .map((action) => projectActionToRow(action, context.userId)),
    projectIdeas: localSnapshot.projectIdeas
      .filter(isOwnedByCurrentDevice)
      .map((idea) => projectIdeaToRow(idea, context.userId)),
    projectHistory: localSnapshot.projectHistory
      .filter(isOwnedByCurrentDevice)
      .map((history) => projectHistoryToRow(history, context.userId)),
    workstreams: localSnapshot.workstreams
      .filter(isOwnedByCurrentDevice)
      .map((workstream) => workstreamToRow(workstream, context.userId)),
    workstreamProjects: localSnapshot.workstreamProjects
      .filter(isOwnedByCurrentDevice)
      .map((link) => workstreamProjectToRow(link, context.userId)),
    workstreamMilestones: localSnapshot.workstreamMilestones
      .filter(isOwnedByCurrentDevice)
      .map((milestone) =>
        workstreamMilestoneToRow(milestone, context.userId),
      ),
    workstreamActions: localSnapshot.workstreamActions
      .filter(isOwnedByCurrentDevice)
      .map((action) => workstreamActionToRow(action, context.userId)),
    workstreamActionProjects: localSnapshot.workstreamActionProjects
      .filter(isOwnedByCurrentDevice)
      .map((link) =>
        workstreamActionProjectToRow(link, context.userId),
      ),
    workstreamActionDependencies: localSnapshot.workstreamActionDependencies
      .filter(isOwnedByCurrentDevice)
      .map((dependency) =>
        workstreamActionDependencyToRow(dependency, context.userId),
      ),
    knowledgeDocuments: localSnapshot.knowledgeDocuments
      .filter(isOwnedByCurrentDevice)
      .map((document) => knowledgeDocumentToRow(document, context.userId)),
  };
}

export interface PushSnapshotResult {
  changedRows: number;
  currentDevice: Device;
}

export async function pushSnapshot(
  transport: SnapshotTransport,
  localSnapshot: LocalDataSnapshot,
  context: SyncContext,
  lastSeenAt: string,
): Promise<PushSnapshotResult> {
  const payload = createPushPayload(localSnapshot, context, lastSeenAt);
  let changedRows = 0;

  const deviceResult = await transport.upsertRows(
    "devices",
    payload.device,
    "user_id,id",
  );
  throwQueryError(deviceResult);
  changedRows += 1;

  const batches: Array<{
    tableName: SnapshotTableName;
    rows: unknown[];
  }> = [
    { tableName: "projects", rows: payload.projects },
    { tableName: "workstreams", rows: payload.workstreams },
    { tableName: "notes", rows: payload.notes },
    { tableName: "tasks", rows: payload.tasks },
    // Parents must arrive before children so the composite ownership FK is
    // satisfied on every device, including a first sync of a new project.
    { tableName: "project_milestones", rows: payload.projectMilestones },
    { tableName: "project_actions", rows: payload.projectActions },
    { tableName: "project_ideas", rows: payload.projectIdeas },
    { tableName: "project_history", rows: payload.projectHistory },
    { tableName: "workstream_projects", rows: payload.workstreamProjects },
    { tableName: "workstream_milestones", rows: payload.workstreamMilestones },
    { tableName: "workstream_actions", rows: payload.workstreamActions },
    {
      tableName: "workstream_action_projects",
      rows: payload.workstreamActionProjects,
    },
    {
      tableName: "workstream_action_dependencies",
      rows: payload.workstreamActionDependencies,
    },
    { tableName: "knowledge_documents", rows: payload.knowledgeDocuments },
  ];

  for (const batch of batches) {
    if (batch.rows.length === 0) {
      continue;
    }

    const result = await transport.upsertRows(
      batch.tableName,
      batch.rows,
      "id",
    );
    throwQueryError(result);
    changedRows += batch.rows.length;
  }

  return { changedRows, currentDevice: payload.currentDevice };
}
