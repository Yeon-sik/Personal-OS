import type {
  FitnessSummaryProjectionV2,
  KnowledgeDocument,
  LocalDataSnapshot,
  LegacyWorkoutRecordV1,
  MealRecord,
  Note,
  Project,
  ProjectAction,
  ProjectHistory,
  ProjectIdea,
  ProjectMilestone,
  Task,
  WeightRecord,
  Workstream,
  WorkstreamAction,
  WorkstreamActionDependency,
  WorkstreamActionProject,
  WorkstreamMilestone,
  WorkstreamProject,
} from "../../../types";
import type { RealtimeSubscription } from "../syncTypes";
import { mergeEntities } from "../merge";
import {
  mealRecordFromRow,
  noteFromRow,
  taskFromRow,
  projectActionFromRow,
  projectHistoryFromRow,
  projectIdeaFromRow,
  projectMilestoneFromRow,
  projectFromRow,
  fitnessSummaryProjectionV2FromRow,
  weightRecordFromRow,
  workoutRecordFromRow,
  knowledgeDocumentFromRow,
  workstreamActionDependencyFromRow,
  workstreamActionProjectFromRow,
  workstreamActionFromRow,
  workstreamFromRow,
  workstreamMilestoneFromRow,
  workstreamProjectFromRow,
} from "./mappers";
import type {
  MealRecordRow,
  NoteRow,
  PostgresChangePayload,
  RealtimeTableName,
  SupabaseClient,
  TaskRow,
  WeightRecordRow,
  FitnessSummaryProjectionV2Row,
  KnowledgeDocumentRow,
  ProjectActionRow,
  ProjectHistoryRow,
  ProjectIdeaRow,
  ProjectMilestoneRow,
  ProjectRow,
  WorkoutRecordRow,
  WorkstreamActionDependencyRow,
  WorkstreamActionProjectRow,
  WorkstreamActionRow,
  WorkstreamMilestoneRow,
  WorkstreamProjectRow,
  WorkstreamRow,
} from "./rows";

const REALTIME_TABLES: RealtimeTableName[] = [
  "notes",
  "tasks",
  "fitness_summary_projections_v2",
  "weight_records",
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
];

const REALTIME_DETAILS: Record<RealtimeTableName, string> = {
  notes: "다른 기기의 메모 변경사항을 반영했습니다.",
  tasks: "다른 기기의 체크리스트 변경사항을 반영했습니다.",
  workout_records: "다른 기기의 운동 기록 변경을 반영했습니다.",
  fitness_summary_projections_v2:
    "Fitness Summary Projection v2 변경을 반영했습니다.",
  meal_records: "다른 기기의 식사 기록 변경을 반영했습니다.",
  weight_records: "다른 기기의 체중 기록 변경을 반영했습니다.",
  projects: "다른 기기의 프로젝트 변경사항을 반영했습니다.",
  project_milestones: "다른 기기의 마일스톤 변경사항을 반영했습니다.",
  project_actions: "다른 기기의 프로젝트 작업 변경사항을 반영했습니다.",
  project_ideas: "다른 기기의 프로젝트 아이디어 변경사항을 반영했습니다.",
  project_history: "다른 기기의 프로젝트 이력 변경사항을 반영했습니다.",
  workstreams: "다른 기기의 Workstream 변경사항을 반영했습니다.",
  workstream_projects: "Workstream 참여 Project 변경사항을 반영했습니다.",
  workstream_milestones: "Workstream 마일스톤 변경사항을 반영했습니다.",
  workstream_actions: "Workstream 작업 변경사항을 반영했습니다.",
  workstream_action_projects:
    "Workstream 작업의 영향 Project 변경사항을 반영했습니다.",
  workstream_action_dependencies:
    "Workstream 작업 dependency 변경사항을 반영했습니다.",
  knowledge_documents: "Knowledge 문서 registry 변경사항을 반영했습니다.",
};

export function getRealtimeDetail(tableName: RealtimeTableName): string {
  return REALTIME_DETAILS[tableName];
}

export function applyRemoteNote(
  snapshot: LocalDataSnapshot,
  remoteNote: Note,
): LocalDataSnapshot {
  return {
    ...snapshot,
    notes: mergeEntities(snapshot.notes, [remoteNote]),
  };
}

export function applyRemoteTask(
  snapshot: LocalDataSnapshot,
  remoteTask: Task,
): LocalDataSnapshot {
  return {
    ...snapshot,
    tasks: mergeEntities(snapshot.tasks, [remoteTask]),
  };
}

export function applyRemoteWorkoutRecord(
  snapshot: LocalDataSnapshot,
  remoteRecord: LegacyWorkoutRecordV1,
): LocalDataSnapshot {
  return {
    ...snapshot,
    workoutRecords: mergeEntities(snapshot.workoutRecords, [remoteRecord]),
  };
}

export function applyRemoteFitnessSummaryProjectionV2(
  snapshot: LocalDataSnapshot,
  remoteProjection: FitnessSummaryProjectionV2,
): LocalDataSnapshot {
  return {
    ...snapshot,
    fitnessSummaryProjections: mergeEntities(
      snapshot.fitnessSummaryProjections,
      [remoteProjection],
    ),
  };
}

export function applyRemoteMealRecord(
  snapshot: LocalDataSnapshot,
  remoteRecord: MealRecord,
): LocalDataSnapshot {
  return {
    ...snapshot,
    mealRecords: mergeEntities(snapshot.mealRecords, [remoteRecord]),
  };
}

export function applyRemoteWeightRecord(
  snapshot: LocalDataSnapshot,
  remoteRecord: WeightRecord,
): LocalDataSnapshot {
  return {
    ...snapshot,
    fitnessWeightRecords: mergeEntities(snapshot.fitnessWeightRecords ?? [], [remoteRecord]),
  };
}

export function applyRemoteProject(
  snapshot: LocalDataSnapshot,
  remoteProject: Project,
): LocalDataSnapshot {
  return {
    ...snapshot,
    projects: mergeEntities(snapshot.projects, [remoteProject]),
  };
}

export function applyRemoteProjectMilestone(
  snapshot: LocalDataSnapshot,
  remoteMilestone: ProjectMilestone,
): LocalDataSnapshot {
  return {
    ...snapshot,
    projectMilestones: mergeEntities(snapshot.projectMilestones, [remoteMilestone]),
  };
}

export function applyRemoteProjectAction(
  snapshot: LocalDataSnapshot,
  remoteAction: ProjectAction,
): LocalDataSnapshot {
  return {
    ...snapshot,
    projectActions: mergeEntities(snapshot.projectActions, [remoteAction]),
  };
}

export function applyRemoteProjectIdea(
  snapshot: LocalDataSnapshot,
  remoteIdea: ProjectIdea,
): LocalDataSnapshot {
  return {
    ...snapshot,
    projectIdeas: mergeEntities(snapshot.projectIdeas, [remoteIdea]),
  };
}

export function applyRemoteProjectHistory(
  snapshot: LocalDataSnapshot,
  remoteHistory: ProjectHistory,
): LocalDataSnapshot {
  return {
    ...snapshot,
    projectHistory: mergeEntities(snapshot.projectHistory, [remoteHistory]),
  };
}

export function applyRemoteWorkstream(
  snapshot: LocalDataSnapshot,
  workstream: Workstream,
): LocalDataSnapshot {
  return {
    ...snapshot,
    workstreams: mergeEntities(snapshot.workstreams, [workstream]),
  };
}

export function applyRemoteWorkstreamProject(
  snapshot: LocalDataSnapshot,
  link: WorkstreamProject,
): LocalDataSnapshot {
  return {
    ...snapshot,
    workstreamProjects: mergeEntities(snapshot.workstreamProjects, [link]),
  };
}

export function applyRemoteWorkstreamMilestone(
  snapshot: LocalDataSnapshot,
  milestone: WorkstreamMilestone,
): LocalDataSnapshot {
  return {
    ...snapshot,
    workstreamMilestones: mergeEntities(
      snapshot.workstreamMilestones,
      [milestone],
    ),
  };
}

export function applyRemoteWorkstreamAction(
  snapshot: LocalDataSnapshot,
  action: WorkstreamAction,
): LocalDataSnapshot {
  return {
    ...snapshot,
    workstreamActions: mergeEntities(snapshot.workstreamActions, [action]),
  };
}

export function applyRemoteWorkstreamActionProject(
  snapshot: LocalDataSnapshot,
  link: WorkstreamActionProject,
): LocalDataSnapshot {
  return {
    ...snapshot,
    workstreamActionProjects: mergeEntities(
      snapshot.workstreamActionProjects,
      [link],
    ),
  };
}

export function applyRemoteWorkstreamActionDependency(
  snapshot: LocalDataSnapshot,
  dependency: WorkstreamActionDependency,
): LocalDataSnapshot {
  return {
    ...snapshot,
    workstreamActionDependencies: mergeEntities(
      snapshot.workstreamActionDependencies,
      [dependency],
    ),
  };
}

export function applyRemoteKnowledgeDocument(
  snapshot: LocalDataSnapshot,
  document: KnowledgeDocument,
): LocalDataSnapshot {
  return {
    ...snapshot,
    knowledgeDocuments: mergeEntities(snapshot.knowledgeDocuments, [document]),
  };
}

export function applyRealtimePayload(
  snapshot: LocalDataSnapshot,
  tableName: RealtimeTableName,
  payload: PostgresChangePayload<unknown>,
  currentDeviceId: string,
): LocalDataSnapshot | null {
  const row = payload.new as { device_id?: string } | null | undefined;

  // Hard DELETE payloads have no `new` row. Soft deletes arrive as UPDATE
  // tombstones and continue through the canonical LWW merge.
  if (!row || row.device_id === currentDeviceId) {
    return null;
  }

  switch (tableName) {
    case "notes":
      return applyRemoteNote(snapshot, noteFromRow(row as NoteRow));
    case "tasks":
      return applyRemoteTask(snapshot, taskFromRow(row as TaskRow));
    case "workout_records":
      return null;
    case "fitness_summary_projections_v2":
      return applyRemoteFitnessSummaryProjectionV2(
        snapshot,
        fitnessSummaryProjectionV2FromRow(
          row as FitnessSummaryProjectionV2Row,
        ),
      );
    case "meal_records":
      return null;
    case "weight_records": {
      const remoteRecord = weightRecordFromRow(row as WeightRecordRow);
      return remoteRecord.sourceApp === "fitness" && (remoteRecord.scope === "fitness" || remoteRecord.scope === "both")
        ? applyRemoteWeightRecord(snapshot, remoteRecord)
        : null;
    }
    case "projects":
      return applyRemoteProject(snapshot, projectFromRow(row as ProjectRow));
    case "project_milestones":
      return applyRemoteProjectMilestone(
        snapshot,
        projectMilestoneFromRow(row as ProjectMilestoneRow),
      );
    case "project_actions":
      return applyRemoteProjectAction(
        snapshot,
        projectActionFromRow(row as ProjectActionRow),
      );
    case "project_ideas":
      return applyRemoteProjectIdea(
        snapshot,
        projectIdeaFromRow(row as ProjectIdeaRow),
      );
    case "project_history":
      return applyRemoteProjectHistory(
        snapshot,
        projectHistoryFromRow(row as ProjectHistoryRow),
      );
    case "workstreams":
      return applyRemoteWorkstream(
        snapshot,
        workstreamFromRow(row as WorkstreamRow),
      );
    case "workstream_projects":
      return applyRemoteWorkstreamProject(
        snapshot,
        workstreamProjectFromRow(row as WorkstreamProjectRow),
      );
    case "workstream_milestones":
      return applyRemoteWorkstreamMilestone(
        snapshot,
        workstreamMilestoneFromRow(row as WorkstreamMilestoneRow),
      );
    case "workstream_actions":
      return applyRemoteWorkstreamAction(
        snapshot,
        workstreamActionFromRow(row as WorkstreamActionRow),
      );
    case "workstream_action_projects":
      return applyRemoteWorkstreamActionProject(
        snapshot,
        workstreamActionProjectFromRow(row as WorkstreamActionProjectRow),
      );
    case "workstream_action_dependencies":
      return applyRemoteWorkstreamActionDependency(
        snapshot,
        workstreamActionDependencyFromRow(
          row as WorkstreamActionDependencyRow,
        ),
      );
    case "knowledge_documents":
      return applyRemoteKnowledgeDocument(
        snapshot,
        knowledgeDocumentFromRow(row as KnowledgeDocumentRow),
      );
  }
}

export interface RealtimeTransport {
  subscribe(
    userId: string,
    onChange: (
      tableName: RealtimeTableName,
      payload: PostgresChangePayload<unknown>,
    ) => void,
    onStatus: (status: string) => void,
  ): unknown;
  removeChannel(channel: unknown): Promise<void> | void;
}

interface RealtimeChannelLike {
  on(
    eventType: "postgres_changes",
    filter: {
      event: "*";
      schema: "public";
      table: RealtimeTableName;
      filter: string;
    },
    callback: (payload: PostgresChangePayload<unknown>) => void,
  ): RealtimeChannelLike;
  subscribe(callback: (status: string) => void): unknown;
}

interface RealtimeClientLike {
  channel(name: string): RealtimeChannelLike;
  removeChannel(channel: unknown): Promise<unknown>;
}

export function createSupabaseRealtimeTransport(
  supabase: SupabaseClient,
): RealtimeTransport {
  const client = supabase as unknown as RealtimeClientLike;

  return {
    subscribe(userId, onChange, onStatus) {
      let channel = client.channel(`localsyncmemo:${userId}`);

      for (const tableName of REALTIME_TABLES) {
        channel = channel.on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: tableName,
            filter: `user_id=eq.${userId}`,
          },
          (payload) => onChange(tableName, payload),
        );
      }

      return channel.subscribe(onStatus);
    },
    async removeChannel(channel) {
      await client.removeChannel(channel);
    },
  };
}

export interface SubscribeSnapshotRealtimeOptions {
  transport: RealtimeTransport;
  userId: string;
  currentDeviceId: string;
  getSnapshot: () => LocalDataSnapshot;
  onSnapshot: (
    tableName: RealtimeTableName,
    snapshot: LocalDataSnapshot,
  ) => void;
  onError: () => void;
}

export function subscribeSnapshotRealtime({
  transport,
  userId,
  currentDeviceId,
  getSnapshot,
  onSnapshot,
  onError,
}: SubscribeSnapshotRealtimeOptions): RealtimeSubscription {
  const channel = transport.subscribe(
    userId,
    (tableName, payload) => {
      const nextSnapshot = applyRealtimePayload(
        getSnapshot(),
        tableName,
        payload,
        currentDeviceId,
      );

      if (nextSnapshot) {
        onSnapshot(tableName, nextSnapshot);
      }
    },
    (status) => {
      if (status === "CHANNEL_ERROR") {
        onError();
      }
    },
  );

  return {
    unsubscribe: async () => {
      await transport.removeChannel(channel);
    },
  };
}
