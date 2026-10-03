import { parseFitnessNutritionSummary } from "../../features/fitness-summary/fitnessNutritionContract";
import type {
  Device,
  LocalDataSnapshot,
  MealRecord,
  Note,
  Project,
  ProjectAction,
  ProjectHistory,
  ProjectIdea,
  ProjectMilestone,
  Task,
  WeightRecord,
  FitnessSummaryProjectionV2,
  KnowledgeDocument,
  KnowledgeDocumentType,
  LegacyWorkoutRecordV1,
  WorkoutType,
  Workstream,
  WorkstreamAction,
  WorkstreamActionDependency,
  WorkstreamActionProject,
  WorkstreamMilestone,
  WorkstreamProject,
} from "../../types";
import { normalizeEntityAuditFields } from "../dataTrust/backfillMetadata";
import { normalizeProjectGitHubIdentity } from "../dataTrust/projectGitHubIdentity";
import { createEmptySnapshot, type StorageAdapter } from "./storageAdapter";

const STORAGE_KEY = "localsyncmemo:snapshot:v1";

interface StoredEnvelope {
  version: 1;
  snapshot: LocalDataSnapshot;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isNullableString(value: unknown): value is string | null {
  return typeof value === "string" || value === null;
}

function isOptionalNullableString(
  value: unknown,
): value is string | null | undefined {
  return value === undefined || isNullableString(value);
}

function isSyncableEntity(value: Record<string, unknown>): boolean {
  return (
    typeof value.id === "string" &&
    typeof value.updatedAt === "string" &&
    isNullableString(value.deletedAt) &&
    typeof value.deviceId === "string"
  );
}

function getNormalizedSyncFields(value: Record<string, unknown>) {
  const updatedAt = value.updatedAt as string;

  return {
    ...normalizeEntityAuditFields(value, updatedAt),
    updatedAt,
    deletedAt: value.deletedAt as string | null,
    deviceId: value.deviceId as string,
  };
}

function getNormalizedScopedFields(value: Record<string, unknown>) {
  const sourceApp: "os" | "fitness" =
    value.sourceApp === "fitness" ? "fitness" : "os";
  const scope: "os" | "fitness" | "both" =
    value.scope === "os" || value.scope === "fitness" || value.scope === "both"
      ? value.scope
      : "both";
  const metadata = isRecord(value.metadata) ? value.metadata : {};

  return {
    sourceApp,
    scope,
    metadata,
  };
}

function isOneOf<T extends string>(value: unknown, values: readonly T[]): value is T {
  return typeof value === "string" && values.includes(value as T);
}

const PROJECT_STATUSES = ["PLANNED", "ACTIVE", "COMPLETED"] as const;
const WORKSTREAM_STATUSES = ["PLANNED", "ACTIVE", "COMPLETED"] as const;
const MILESTONE_STATUSES = ["PLANNED", "IN_PROGRESS", "COMPLETED"] as const;
const ACTION_TYPES = ["NEXT", "LATER", "BLOCKED"] as const;
const ACTION_STATUSES = ["OPEN", "DONE"] as const;
const HISTORY_TYPES = ["STATUS_CHANGE", "MILESTONE", "RELEASE", "NOTE"] as const;
const KNOWLEDGE_DOCUMENT_TYPES = [
  "IDEA",
  "PLAN",
  "DESIGN",
  "RESEARCH",
  "NOTE",
] as const;

function normalizeProject(value: unknown): Project | null {
  if (
    !isRecord(value) ||
    !isSyncableEntity(value) ||
    typeof value.name !== "string" ||
    !isOptionalNullableString(value.description) ||
    !isOneOf(value.status, PROJECT_STATUSES) ||
    typeof value.currentSummary !== "string" ||
    typeof value.targetSummary !== "string" ||
    !isOptionalNullableString(value.repository) ||
    !isOptionalNullableString(value.branch) ||
    !isOptionalNullableString(value.githubRepositoryId) ||
    !isOptionalNullableString(value.githubOwner) ||
    !isOptionalNullableString(value.githubRepo) ||
    !isOptionalNullableString(value.lastVerifiedCommit) ||
    !isOptionalNullableString(value.lastVerifiedAt)
  ) {
    return null;
  }

  const githubIdentity = normalizeProjectGitHubIdentity(
    value.githubRepositoryId as string | null | undefined,
    value.githubOwner as string | null | undefined,
    value.githubRepo as string | null | undefined,
  );

  return {
    id: value.id as string,
    name: value.name as string,
    description: (value.description as string | null | undefined) ?? "",
    repository: (value.repository as string | null | undefined) ?? null,
    branch: (value.branch as string | null | undefined) ?? null,
    ...githubIdentity,
    status: value.status as (typeof PROJECT_STATUSES)[number],
    currentSummary: value.currentSummary as string,
    targetSummary: value.targetSummary as string,
    lastVerifiedCommit:
      (value.lastVerifiedCommit as string | null | undefined) ?? null,
    lastVerifiedAt: (value.lastVerifiedAt as string | null | undefined) ?? null,
    ...getNormalizedSyncFields(value),
  };
}

function normalizeProjectMilestone(value: unknown): ProjectMilestone | null {
  if (
    !isRecord(value) ||
    !isSyncableEntity(value) ||
    typeof value.projectId !== "string" ||
    typeof value.title !== "string" ||
    !isOneOf(value.status, MILESTONE_STATUSES)
  ) {
    return null;
  }

  return {
    id: value.id as string,
    projectId: value.projectId as string,
    title: value.title as string,
    status: value.status as (typeof MILESTONE_STATUSES)[number],
    ...getNormalizedSyncFields(value),
  };
}

function normalizeProjectAction(value: unknown): ProjectAction | null {
  if (
    !isRecord(value) ||
    !isSyncableEntity(value) ||
    typeof value.projectId !== "string" ||
    typeof value.title !== "string" ||
    !isOneOf(value.type, ACTION_TYPES) ||
    !isOneOf(value.status, ACTION_STATUSES)
  ) {
    return null;
  }

  return {
    id: value.id as string,
    projectId: value.projectId as string,
    title: value.title as string,
    type: value.type as (typeof ACTION_TYPES)[number],
    status: value.status as (typeof ACTION_STATUSES)[number],
    ...getNormalizedSyncFields(value),
  };
}

function normalizeProjectIdea(value: unknown): ProjectIdea | null {
  if (
    !isRecord(value) ||
    !isSyncableEntity(value) ||
    typeof value.projectId !== "string" ||
    typeof value.title !== "string"
  ) {
    return null;
  }

  return {
    id: value.id as string,
    projectId: value.projectId as string,
    title: value.title as string,
    ...getNormalizedSyncFields(value),
  };
}

function normalizeProjectHistory(value: unknown): ProjectHistory | null {
  if (
    !isRecord(value) ||
    !isSyncableEntity(value) ||
    typeof value.projectId !== "string" ||
    !isOneOf(value.type, HISTORY_TYPES) ||
    typeof value.summary !== "string" ||
    typeof value.occurredAt !== "string" ||
    !isOptionalNullableString(value.githubRef)
  ) {
    return null;
  }

  return {
    id: value.id as string,
    projectId: value.projectId as string,
    type: value.type as (typeof HISTORY_TYPES)[number],
    summary: value.summary as string,
    occurredAt: value.occurredAt as string,
    githubRef: (value.githubRef as string | null | undefined) ?? null,
    ...getNormalizedSyncFields(value),
  };
}

function normalizeWorkstream(value: unknown): Workstream | null {
  if (
    !isRecord(value) ||
    !isSyncableEntity(value) ||
    typeof value.name !== "string" ||
    !isOneOf(value.status, WORKSTREAM_STATUSES)
  ) {
    return null;
  }

  return {
    id: value.id as string,
    name: value.name,
    status: value.status as (typeof WORKSTREAM_STATUSES)[number],
    ...getNormalizedSyncFields(value),
  };
}

function normalizeWorkstreamProject(value: unknown): WorkstreamProject | null {
  if (
    !isRecord(value) ||
    !isSyncableEntity(value) ||
    typeof value.workstreamId !== "string" ||
    typeof value.projectId !== "string"
  ) {
    return null;
  }

  return {
    id: value.id as string,
    workstreamId: value.workstreamId,
    projectId: value.projectId,
    ...getNormalizedSyncFields(value),
  };
}

function normalizeWorkstreamMilestone(
  value: unknown,
): WorkstreamMilestone | null {
  if (
    !isRecord(value) ||
    !isSyncableEntity(value) ||
    typeof value.workstreamId !== "string" ||
    typeof value.title !== "string" ||
    !isOneOf(value.status, MILESTONE_STATUSES)
  ) {
    return null;
  }

  return {
    id: value.id as string,
    workstreamId: value.workstreamId,
    title: value.title,
    status: value.status as (typeof MILESTONE_STATUSES)[number],
    ...getNormalizedSyncFields(value),
  };
}

function normalizeWorkstreamAction(value: unknown): WorkstreamAction | null {
  if (
    !isRecord(value) ||
    !isSyncableEntity(value) ||
    typeof value.workstreamId !== "string" ||
    typeof value.title !== "string" ||
    !isOneOf(value.type, ACTION_TYPES) ||
    !isOneOf(value.status, ACTION_STATUSES)
  ) {
    return null;
  }

  return {
    id: value.id as string,
    workstreamId: value.workstreamId,
    title: value.title,
    type: value.type as (typeof ACTION_TYPES)[number],
    status: value.status as (typeof ACTION_STATUSES)[number],
    ...getNormalizedSyncFields(value),
  };
}

function normalizeWorkstreamActionProject(
  value: unknown,
): WorkstreamActionProject | null {
  if (
    !isRecord(value) ||
    !isSyncableEntity(value) ||
    typeof value.actionId !== "string" ||
    typeof value.projectId !== "string"
  ) {
    return null;
  }

  return {
    id: value.id as string,
    actionId: value.actionId,
    projectId: value.projectId,
    ...getNormalizedSyncFields(value),
  };
}

function normalizeWorkstreamActionDependency(
  value: unknown,
): WorkstreamActionDependency | null {
  if (
    !isRecord(value) ||
    !isSyncableEntity(value) ||
    typeof value.actionId !== "string" ||
    typeof value.dependsOnActionId !== "string"
  ) {
    return null;
  }

  return {
    id: value.id as string,
    actionId: value.actionId,
    dependsOnActionId: value.dependsOnActionId,
    ...getNormalizedSyncFields(value),
  };
}

function normalizeKnowledgeDocument(value: unknown): KnowledgeDocument | null {
  if (
    !isRecord(value) ||
    !isSyncableEntity(value) ||
    typeof value.title !== "string" ||
    !isOneOf(value.type, KNOWLEDGE_DOCUMENT_TYPES) ||
    !isOptionalNullableString(value.projectId) ||
    !isOptionalNullableString(value.workstreamId) ||
    typeof value.relativePath !== "string" ||
    (value.projectId !== null &&
      value.projectId !== undefined &&
      value.workstreamId !== null &&
      value.workstreamId !== undefined)
  ) {
    return null;
  }

  return {
    id: value.id as string,
    title: value.title,
    type: value.type as KnowledgeDocumentType,
    projectId: (value.projectId as string | null | undefined) ?? null,
    workstreamId: (value.workstreamId as string | null | undefined) ?? null,
    relativePath: value.relativePath,
    ...getNormalizedSyncFields(value),
  };
}

function normalizeNote(value: unknown): Note | null {
  if (
    !isRecord(value) ||
    !isSyncableEntity(value) ||
    typeof value.title !== "string" ||
    typeof value.content !== "string"
  ) {
    return null;
  }

  return {
    id: value.id as string,
    title: value.title,
    content: value.content,
    ...getNormalizedSyncFields(value),
  };
}

function normalizeTask(value: unknown): Task | null {
  if (
    !isRecord(value) ||
    !isSyncableEntity(value) ||
    typeof value.text !== "string" ||
    typeof value.isDone !== "boolean" ||
    typeof value.orderIndex !== "number"
  ) {
    return null;
  }

  const dueDate = isNullableString(value.dueDate) ? value.dueDate : null;
  const dueTime = isNullableString(value.dueTime) ? value.dueTime : null;
  const plannedDate = isNullableString(value.plannedDate)
    ? value.plannedDate
    : null;
  return {
    id: value.id as string,
    text: value.text,
    isDone: value.isDone,
    orderIndex: value.orderIndex,
    dueDate,
    dueTime,
    plannedDate,
    ...getNormalizedSyncFields(value),
  };
}

function normalizeWorkoutRecord(value: unknown): LegacyWorkoutRecordV1 | null {
  if (
    !isRecord(value) ||
    !isSyncableEntity(value) ||
    typeof value.date !== "string" ||
    typeof value.category !== "string" ||
    typeof value.exerciseName !== "string"
  ) {
    return null;
  }

  const workoutType: WorkoutType =
    value.workoutType === "cardio" || value.workoutType === "other"
      ? value.workoutType
      : "strength";

  return {
    id: value.id as string,
    date: value.date,
    workoutType,
    category: value.category,
    exerciseName: value.exerciseName,
    durationSeconds:
      workoutType === "cardio" && typeof value.durationSeconds === "number"
        ? value.durationSeconds
        : workoutType === "cardio" && typeof value.durationMinutes === "number"
          ? value.durationMinutes * 60
          : null,
    averageHeartRate:
      workoutType === "cardio" && typeof value.averageHeartRate === "number"
        ? value.averageHeartRate
        : null,
    ...getNormalizedScopedFields(value),
    ...getNormalizedSyncFields(value),
  };
}

function normalizeNonNegativeInteger(value: unknown): number | null {
  return typeof value === "number" && Number.isInteger(value) && value >= 0
    ? value
    : null;
}

function normalizeFitnessSummaryProjection(
  value: unknown,
): FitnessSummaryProjectionV2 | null {
  if (
    !isRecord(value) ||
    !isSyncableEntity(value) ||
    typeof value.sourceFitnessSessionId !== "string" ||
    !value.sourceFitnessSessionId.trim() ||
    typeof value.date !== "string" ||
    value.completionStatus !== "completed" ||
    value.contractVersion !== 2
  ) {
    return null;
  }

  const counts = {
    chestSets: normalizeNonNegativeInteger(value.chestSets),
    backSets: normalizeNonNegativeInteger(value.backSets),
    legsSets: normalizeNonNegativeInteger(value.legsSets),
    shouldersSets: normalizeNonNegativeInteger(value.shouldersSets),
    absSets: normalizeNonNegativeInteger(value.absSets),
    tricepsSets: normalizeNonNegativeInteger(value.tricepsSets),
    bicepsSets: normalizeNonNegativeInteger(value.bicepsSets),
  };
  if (Object.values(counts).some((count) => count === null)) {
    return null;
  }

  const optionalSeconds = (candidate: unknown): number | null =>
    candidate === null || candidate === undefined
      ? null
      : normalizeNonNegativeInteger(candidate);
  const totalDurationSeconds = optionalSeconds(value.totalDurationSeconds);
  const cardioDurationSeconds = optionalSeconds(value.cardioDurationSeconds);
  if (
    value.totalDurationSeconds !== null &&
    value.totalDurationSeconds !== undefined &&
    totalDurationSeconds === null
  ) {
    return null;
  }
  if (
    value.cardioDurationSeconds !== null &&
    value.cardioDurationSeconds !== undefined &&
    cardioDurationSeconds === null
  ) {
    return null;
  }

  return {
    id: value.id as string,
    sourceFitnessSessionId: value.sourceFitnessSessionId,
    date: value.date,
    completionStatus: "completed",
    ...counts,
    totalDurationSeconds,
    cardioDurationSeconds,
    contractVersion: 2,
    ...getNormalizedSyncFields(value),
  } as FitnessSummaryProjectionV2;
}

function normalizeMealRecord(value: unknown): MealRecord | null {
  if (
    !isRecord(value) ||
    !isSyncableEntity(value) ||
    typeof value.date !== "string" ||
    typeof value.menu !== "string" ||
    typeof value.calories !== "number" ||
    typeof value.proteinGrams !== "number"
  ) {
    return null;
  }

  return {
    id: value.id as string,
    date: value.date,
    menu: value.menu,
    calories: value.calories,
    proteinGrams: value.proteinGrams,
    carbsGrams: typeof value.carbsGrams === "number" ? value.carbsGrams : null,
    fatGrams: typeof value.fatGrams === "number" ? value.fatGrams : null,
    ...getNormalizedScopedFields(value),
    ...getNormalizedSyncFields(value),
  };
}

function normalizeWeightRecord(value: unknown): WeightRecord | null {
  if (
    !isRecord(value) ||
    !isSyncableEntity(value) ||
    typeof value.date !== "string" ||
    typeof value.weightKg !== "number"
  ) {
    return null;
  }

  return {
    id: value.id as string,
    date: value.date,
    weightKg: value.weightKg,
    ...getNormalizedScopedFields(value),
    ...getNormalizedSyncFields(value),
  };
}

function isDevice(value: unknown): value is Device {
  return (
    isRecord(value) &&
    typeof value.id === "string" &&
    typeof value.name === "string" &&
    typeof value.lastSeenAt === "string" &&
    (typeof value.appVersion === "string" ||
      value.appVersion === null ||
      value.appVersion === undefined)
  );
}

function normalizeArray<T>(
  value: unknown,
  normalize: (item: unknown) => T | null,
): T[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.flatMap((item) => {
    const normalized = normalize(item);
    return normalized ? [normalized] : [];
  });
}

function normalizeSnapshot(value: unknown): LocalDataSnapshot {
  if (!isRecord(value)) {
    return createEmptySnapshot();
  }

  const notes = normalizeArray(value.notes, normalizeNote);
  const tasks = normalizeArray(value.tasks, normalizeTask);
  const workoutRecords = normalizeArray(
    value.workoutRecords,
    normalizeWorkoutRecord,
  );
  const fitnessSharedWorkoutRecords = normalizeArray(
    value.fitnessSharedWorkoutRecords,
    normalizeWorkoutRecord,
  );
  const fitnessSummaryProjections = normalizeArray(
    value.fitnessSummaryProjections,
    normalizeFitnessSummaryProjection,
  );
  const fitnessWeightRecords = normalizeArray(value.fitnessWeightRecords, normalizeWeightRecord);
  const mealRecords = normalizeArray(value.mealRecords, normalizeMealRecord);
  const weightRecords = normalizeArray(
    value.weightRecords,
    normalizeWeightRecord,
  );
  const devices = Array.isArray(value.devices)
    ? value.devices.filter(isDevice)
    : [];
  const projects = normalizeArray(value.projects, normalizeProject);
  const projectMilestones = normalizeArray(
    value.projectMilestones,
    normalizeProjectMilestone,
  );
  const projectActions = normalizeArray(value.projectActions, normalizeProjectAction);
  const projectIdeas = normalizeArray(value.projectIdeas, normalizeProjectIdea);
  const projectHistory = normalizeArray(value.projectHistory, normalizeProjectHistory);
  const workstreams = normalizeArray(value.workstreams, normalizeWorkstream);
  const workstreamProjects = normalizeArray(
    value.workstreamProjects,
    normalizeWorkstreamProject,
  );
  const workstreamMilestones = normalizeArray(
    value.workstreamMilestones,
    normalizeWorkstreamMilestone,
  );
  const workstreamActions = normalizeArray(
    value.workstreamActions,
    normalizeWorkstreamAction,
  );
  const workstreamActionProjects = normalizeArray(
    value.workstreamActionProjects,
    normalizeWorkstreamActionProject,
  );
  const workstreamActionDependencies = normalizeArray(
    value.workstreamActionDependencies,
    normalizeWorkstreamActionDependency,
  );
  const knowledgeDocuments = normalizeArray(
    value.knowledgeDocuments,
    normalizeKnowledgeDocument,
  );

  return {
    notes,
    tasks,
    workoutRecords,
    fitnessSharedWorkoutRecords,
    fitnessSummaryProjections,
    fitnessNutritionSummaries: Array.isArray(value.fitnessNutritionSummaries)
      ? normalizeArray(value.fitnessNutritionSummaries, (row) => {
          try { return parseFitnessNutritionSummary(row); } catch { return null; }
        })
      : undefined,
    fitnessWeightRecords,
    mealRecords,
    weightRecords,
    devices,
    projects,
    projectMilestones,
    projectActions,
    projectIdeas,
    projectHistory,
    workstreams,
    workstreamProjects,
    workstreamMilestones,
    workstreamActions,
    workstreamActionProjects,
    workstreamActionDependencies,
    knowledgeDocuments,
  };
}

function parseStoredValue(rawValue: string): LocalDataSnapshot {
  const parsed = JSON.parse(rawValue) as unknown;

  if (isRecord(parsed) && parsed.version === 1 && "snapshot" in parsed) {
    return normalizeSnapshot(parsed.snapshot);
  }

  return normalizeSnapshot(parsed);
}

export class LocalStorageAdapter implements StorageAdapter {
  async load(): Promise<LocalDataSnapshot> {
    if (typeof window === "undefined") {
      return createEmptySnapshot();
    }

    const rawValue = window.localStorage.getItem(STORAGE_KEY);

    if (!rawValue) {
      return createEmptySnapshot();
    }

    try {
      return parseStoredValue(rawValue);
    } catch {
      throw new Error("저장된 로컬 데이터를 읽을 수 없습니다.");
    }
  }

  async save(snapshot: LocalDataSnapshot): Promise<void> {
    if (typeof window === "undefined") {
      return;
    }

    try {
      const envelope: StoredEnvelope = {
        version: 1,
        snapshot,
      };

      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(envelope));
    } catch {
      throw new Error("로컬 저장소에 변경사항을 저장하지 못했습니다.");
    }
  }
}

export const localStorageAdapter = new LocalStorageAdapter();
