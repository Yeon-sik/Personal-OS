import type { FitnessNutritionSummaryV1 } from "../features/fitness-summary/fitnessNutritionContract";
import type { LocalSyncState } from "../lib/sync/syncState";

export type EntityId = string;
export type ISODateString = string;

export interface BackfillMetadata {
  isBackfilled: boolean;
  backfilledAt: ISODateString | null;
  backfillReason: string | null;
}

export type BackfillInput = Partial<BackfillMetadata>;

export interface SyncableEntity extends BackfillMetadata {
  id: EntityId;
  createdAt: ISODateString;
  updatedAt: ISODateString;
  deletedAt: ISODateString | null;
  deviceId: EntityId;
}

export interface Note extends SyncableEntity {
  title: string;
  content: string;
}

export interface Task extends SyncableEntity {
  text: string;
  isDone: boolean;
  orderIndex: number;
  dueDate: string | null;
  dueTime: string | null;
  plannedDate: string | null;
}

export type WorkoutType = "strength" | "cardio" | "other";
export type SourceApp = "os" | "fitness";
export type RecordScope = "os" | "fitness" | "both";
export type FitnessRecordContractVersion = 1;
export type FitnessSummaryProjectionContractVersion = 2;
export type FitnessSummaryCompletionStatus = "completed";

export interface ScopedRecordFields {
  sourceApp?: SourceApp;
  scope?: RecordScope;
  metadata?: Record<string, unknown>;
  contractVersion?: FitnessRecordContractVersion;
}

/**
 * Safe workout shape for Personal OS features. It intentionally contains no
 * exercise identity or per-set values.
 */
export interface WorkoutRecord extends SyncableEntity, ScopedRecordFields {
  date: string;
  workoutType: WorkoutType;
  category: string;
  durationSeconds: number | null;
  averageHeartRate: number | null;
}

/**
 * Frozen Fitness Record Contract v1 reader shape. This remains available only
 * for legacy storage/sync compatibility; category-only display is allowed
 * when the Fitness-owned v2 projection has not been published yet.
 */
export interface LegacyWorkoutRecordV1 extends WorkoutRecord {
  exerciseName: string;
}

/**
 * Cross-app read model owned and produced by FitnessApp. Do not add exercise,
 * set, load, repetition, RPE/RIR, or other detailed Fitness fields here.
 */
export interface FitnessSummaryProjectionV2 extends SyncableEntity {
  sourceFitnessSessionId: EntityId;
  date: string;
  completionStatus: FitnessSummaryCompletionStatus;
  chestSets: number;
  backSets: number;
  legsSets: number;
  shouldersSets: number;
  absSets: number;
  tricepsSets: number;
  bicepsSets: number;
  totalDurationSeconds: number | null;
  cardioDurationSeconds: number | null;
  contractVersion: FitnessSummaryProjectionContractVersion;
}

export interface MealRecord extends SyncableEntity, ScopedRecordFields {
  date: string;
  menu: string;
  calories: number;
  proteinGrams: number;
  carbsGrams: number | null;
  fatGrams: number | null;
}

export interface WeightRecord extends SyncableEntity, ScopedRecordFields {
  date: string;
  weightKg: number;
}

export type DevProjectStatus = "PLANNED" | "ACTIVE" | "COMPLETED";
export type DevWorkstreamStatus = "PLANNED" | "ACTIVE" | "COMPLETED";
export type DevMilestoneStatus = "PLANNED" | "IN_PROGRESS" | "COMPLETED";
export type DevActionType = "NEXT" | "LATER" | "BLOCKED";
export type DevActionStatus = "OPEN" | "DONE";
export type DevHistoryType =
  | "STATUS_CHANGE"
  | "MILESTONE"
  | "RELEASE"
  | "NOTE";
export type KnowledgeDocumentType =
  | "IDEA"
  | "PLAN"
  | "DESIGN"
  | "RESEARCH"
  | "NOTE";

/** Project operating state owned by the Dev Control bounded context. */
export interface Project extends SyncableEntity {
  name: string;
  description: string;
  repository: string | null;
  branch: string | null;
  /** Canonical GitHub repository identity. GitHub remains the source of truth. */
  githubRepositoryId: string | null;
  githubOwner: string | null;
  githubRepo: string | null;
  status: DevProjectStatus;
  currentSummary: string;
  targetSummary: string;
  lastVerifiedCommit: string | null;
  lastVerifiedAt: ISODateString | null;
}

export interface ProjectMilestone extends SyncableEntity {
  projectId: EntityId;
  title: string;
  status: DevMilestoneStatus;
}

export interface ProjectAction extends SyncableEntity {
  projectId: EntityId;
  title: string;
  type: DevActionType;
  status: DevActionStatus;
}

export interface ProjectIdea extends SyncableEntity {
  projectId: EntityId;
  title: string;
}

export interface ProjectHistory extends SyncableEntity {
  projectId: EntityId;
  type: DevHistoryType;
  summary: string;
  occurredAt: ISODateString;
  githubRef: string | null;
}

/** A cross-project feature or release unit. Project remains its own entity. */
export interface Workstream extends SyncableEntity {
  name: string;
  status: DevWorkstreamStatus;
}

/** Stable, tombstoned N:M link between a Workstream and a Project. */
export interface WorkstreamProject extends SyncableEntity {
  workstreamId: EntityId;
  projectId: EntityId;
}

export interface WorkstreamMilestone extends SyncableEntity {
  workstreamId: EntityId;
  title: string;
  status: DevMilestoneStatus;
}

export interface WorkstreamAction extends SyncableEntity {
  workstreamId: EntityId;
  title: string;
  type: DevActionType;
  status: DevActionStatus;
}

/** A Workstream Action's optional 0..N impacted Project references. */
export interface WorkstreamActionProject extends SyncableEntity {
  actionId: EntityId;
  projectId: EntityId;
}

export interface WorkstreamActionDependency extends SyncableEntity {
  actionId: EntityId;
  dependsOnActionId: EntityId;
}

/** Registry metadata for a Markdown document owned by the Knowledge Vault. */
export interface KnowledgeDocument extends SyncableEntity {
  title: string;
  type: KnowledgeDocumentType;
  projectId: EntityId | null;
  workstreamId: EntityId | null;
  /** Vault-relative POSIX path. Markdown body is intentionally not stored here. */
  relativePath: string;
}

export interface Device {
  id: EntityId;
  name: string;
  lastSeenAt: ISODateString;
  appVersion?: string | null;
}

export interface LocalDataSnapshot {
  /** Rows, dirty revisions and pull cursor are persisted in one local envelope. */
  syncState?: LocalSyncState;
  notes: Note[];
  tasks: Task[];
  /** Frozen v1 source rows retained only as a local compatibility archive. */
  workoutRecords: LegacyWorkoutRecordV1[];
  /** Authenticated Fitness-owned v1 read model, separate from local archives. */
  fitnessSharedWorkoutRecords?: LegacyWorkoutRecordV1[];
  fitnessSummaryProjections: FitnessSummaryProjectionV2[];
  /** Absent in old caches; full owner-view reads replace this collection. */
  fitnessNutritionSummaries?: FitnessNutritionSummaryV1[];
  /** Fresh, read-only compatibility pull; legacy local weights remain in weightRecords. */
  fitnessWeightRecords?: WeightRecord[];
  /** Legacy meal/weight source rows are local archives, not live OS read models. */
  mealRecords: MealRecord[];
  weightRecords: WeightRecord[];
  devices: Device[];
  projects: Project[];
  projectMilestones: ProjectMilestone[];
  projectActions: ProjectAction[];
  projectIdeas: ProjectIdea[];
  projectHistory: ProjectHistory[];
  workstreams: Workstream[];
  workstreamProjects: WorkstreamProject[];
  workstreamMilestones: WorkstreamMilestone[];
  workstreamActions: WorkstreamAction[];
  workstreamActionProjects: WorkstreamActionProject[];
  workstreamActionDependencies: WorkstreamActionDependency[];
  knowledgeDocuments: KnowledgeDocument[];
}
