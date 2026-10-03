import type {
  Device,
  FitnessSummaryProjectionV2,
  KnowledgeDocument,
  KnowledgeDocumentType,
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
  WorkoutType,
  Workstream,
  WorkstreamAction,
  WorkstreamActionDependency,
  WorkstreamActionProject,
  WorkstreamMilestone,
  WorkstreamProject,
} from "../../../types";
import { normalizeProjectGitHubIdentity } from "../../dataTrust/projectGitHubIdentity";
import type {
  DeviceRow,
  EntityAuditRow,
  MealRecordRow,
  NoteRow,
  TaskRow,
  WeightRecordRow,
  WorkoutRecordRow,
  FitnessSummaryProjectionV2Row,
  ProjectActionRow,
  ProjectHistoryRow,
  ProjectIdeaRow,
  ProjectMilestoneRow,
  ProjectRow,
  WorkstreamActionDependencyRow,
  WorkstreamActionProjectRow,
  WorkstreamActionRow,
  WorkstreamMilestoneRow,
  WorkstreamProjectRow,
  WorkstreamRow,
  KnowledgeDocumentRow,
} from "./rows";

export function auditFieldsFromRow(
  row: EntityAuditRow,
  fallbackUpdatedAt: string,
) {
  const isBackfilled = row.is_backfilled === true;
  const createdAt = row.created_at ?? fallbackUpdatedAt;

  return {
    createdAt,
    isBackfilled,
    backfilledAt: isBackfilled ? row.backfilled_at ?? createdAt : null,
    backfillReason: isBackfilled ? row.backfill_reason ?? null : null,
  };
}

export function auditFieldsToRow(entity: {
  createdAt: string;
  isBackfilled: boolean;
  backfilledAt: string | null;
  backfillReason: string | null;
}): Required<EntityAuditRow> {
  return {
    created_at: entity.createdAt,
    is_backfilled: entity.isBackfilled,
    backfilled_at: entity.backfilledAt,
    backfill_reason: entity.backfillReason,
  };
}

export function noteFromRow(row: NoteRow): Note {
  return {
    ...auditFieldsFromRow(row, row.updated_at),
    id: row.id,
    title: row.title,
    content: row.content,
    updatedAt: row.updated_at,
    deletedAt: row.deleted_at,
    deviceId: row.device_id,
  };
}

export function taskFromRow(row: TaskRow): Task {
  return {
    ...auditFieldsFromRow(row, row.updated_at),
    id: row.id,
    text: row.text,
    isDone: row.is_done,
    orderIndex: row.order_index,
    dueDate: row.due_date,
    dueTime: row.due_time ? row.due_time.slice(0, 5) : null,
    plannedDate: row.planned_date ?? null,
    updatedAt: row.updated_at,
    deletedAt: row.deleted_at,
    deviceId: row.device_id,
  };
}

export function normalizeWorkoutType(value: string): WorkoutType {
  return value === "cardio" || value === "other" ? value : "strength";
}

export function normalizeSourceApp(value?: string | null): "os" | "fitness" {
  return value === "fitness" ? "fitness" : "os";
}

export function normalizeScope(
  value?: string | null,
): "os" | "fitness" | "both" {
  if (value === "os" || value === "fitness" || value === "both") {
    return value;
  }
  return "both";
}

export function normalizeMetadata(
  value?: Record<string, unknown> | null,
): Record<string, unknown> {
  return value ?? {};
}

export function normalizeContractVersion(value?: number | null): 1 {
  return value === 1 ? value : 1;
}

export function workoutRecordFromRow(row: WorkoutRecordRow): LegacyWorkoutRecordV1 {
  return {
    ...auditFieldsFromRow(row, row.updated_at),
    id: row.id,
    date: row.date,
    workoutType: normalizeWorkoutType(row.workout_type),
    category: row.category,
    exerciseName: row.exercise_name,
    durationSeconds: row.duration_seconds ?? null,
    averageHeartRate: row.average_heart_rate ?? null,
    sourceApp: normalizeSourceApp(row.source_app),
    scope: normalizeScope(row.scope),
    metadata: normalizeMetadata(row.metadata),
    contractVersion: normalizeContractVersion(row.contract_version),
    updatedAt: row.updated_at,
    deletedAt: row.deleted_at,
    deviceId: row.device_id,
  };
}

export function fitnessSummaryProjectionV2FromRow(
  row: FitnessSummaryProjectionV2Row,
): FitnessSummaryProjectionV2 {
  if (row.contract_version !== 2 || row.completion_status !== "completed") {
    throw new Error("Unsupported Fitness workout summary contract.");
  }
  return {
    ...auditFieldsFromRow(row, row.updated_at),
    id: row.id,
    sourceFitnessSessionId: row.source_fitness_session_id,
    date: row.date,
    completionStatus: "completed",
    chestSets: row.chest_sets,
    backSets: row.back_sets,
    legsSets: row.legs_sets,
    shouldersSets: row.shoulders_sets,
    absSets: row.abs_sets,
    tricepsSets: row.triceps_sets,
    bicepsSets: row.biceps_sets,
    totalDurationSeconds: row.total_duration_seconds ?? null,
    cardioDurationSeconds: row.cardio_duration_seconds ?? null,
    contractVersion: 2,
    updatedAt: row.updated_at,
    deletedAt: row.deleted_at,
    deviceId: row.device_id,
  };
}

export function mealRecordFromRow(row: MealRecordRow): MealRecord {
  return {
    ...auditFieldsFromRow(row, row.updated_at),
    id: row.id,
    date: row.date,
    menu: row.menu,
    calories: row.calories,
    proteinGrams: row.protein_grams,
    carbsGrams: row.carbs_grams,
    fatGrams: row.fat_grams,
    sourceApp: normalizeSourceApp(row.source_app),
    scope: normalizeScope(row.scope),
    metadata: normalizeMetadata(row.metadata),
    contractVersion: normalizeContractVersion(row.contract_version),
    updatedAt: row.updated_at,
    deletedAt: row.deleted_at,
    deviceId: row.device_id,
  };
}

export function weightRecordFromRow(row: WeightRecordRow): WeightRecord {
  return {
    ...auditFieldsFromRow(row, row.updated_at),
    id: row.id,
    date: row.date,
    weightKg: row.weight_kg,
    sourceApp: normalizeSourceApp(row.source_app),
    scope: normalizeScope(row.scope),
    metadata: normalizeMetadata(row.metadata),
    contractVersion: normalizeContractVersion(row.contract_version),
    updatedAt: row.updated_at,
    deletedAt: row.deleted_at,
    deviceId: row.device_id,
  };
}

export function projectFromRow(row: ProjectRow): Project {
  const githubIdentity = normalizeProjectGitHubIdentity(
    row.github_repository_id,
    row.github_owner,
    row.github_repo,
  );
  return {
    ...auditFieldsFromRow(row, row.updated_at),
    id: row.id,
    name: row.name,
    description: row.description ?? "",
    repository: row.repository,
    branch: row.branch,
    ...githubIdentity,
    status: row.status,
    currentSummary: row.current_summary,
    targetSummary: row.target_summary,
    lastVerifiedCommit: row.last_verified_commit,
    lastVerifiedAt: row.last_verified_at,
    updatedAt: row.updated_at,
    deletedAt: row.deleted_at,
    deviceId: row.device_id,
  };
}

export function projectMilestoneFromRow(
  row: ProjectMilestoneRow,
): ProjectMilestone {
  return {
    ...auditFieldsFromRow(row, row.updated_at),
    id: row.id,
    projectId: row.project_id,
    title: row.title,
    status: row.status,
    updatedAt: row.updated_at,
    deletedAt: row.deleted_at,
    deviceId: row.device_id,
  };
}

export function projectActionFromRow(row: ProjectActionRow): ProjectAction {
  return {
    ...auditFieldsFromRow(row, row.updated_at),
    id: row.id,
    projectId: row.project_id,
    title: row.title,
    type: row.type,
    status: row.status,
    updatedAt: row.updated_at,
    deletedAt: row.deleted_at,
    deviceId: row.device_id,
  };
}

export function projectIdeaFromRow(row: ProjectIdeaRow): ProjectIdea {
  return {
    ...auditFieldsFromRow(row, row.updated_at),
    id: row.id,
    projectId: row.project_id,
    title: row.title,
    updatedAt: row.updated_at,
    deletedAt: row.deleted_at,
    deviceId: row.device_id,
  };
}

export function projectHistoryFromRow(row: ProjectHistoryRow): ProjectHistory {
  return {
    ...auditFieldsFromRow(row, row.updated_at),
    id: row.id,
    projectId: row.project_id,
    type: row.type,
    summary: row.summary,
    occurredAt: row.occurred_at,
    githubRef: row.github_ref,
    updatedAt: row.updated_at,
    deletedAt: row.deleted_at,
    deviceId: row.device_id,
  };
}

export function workstreamFromRow(row: WorkstreamRow): Workstream {
  return {
    ...auditFieldsFromRow(row, row.updated_at),
    id: row.id,
    name: row.name,
    status: row.status,
    updatedAt: row.updated_at,
    deletedAt: row.deleted_at,
    deviceId: row.device_id,
  };
}

export function workstreamProjectFromRow(
  row: WorkstreamProjectRow,
): WorkstreamProject {
  return {
    ...auditFieldsFromRow(row, row.updated_at),
    id: row.id,
    workstreamId: row.workstream_id,
    projectId: row.project_id,
    updatedAt: row.updated_at,
    deletedAt: row.deleted_at,
    deviceId: row.device_id,
  };
}

export function workstreamMilestoneFromRow(
  row: WorkstreamMilestoneRow,
): WorkstreamMilestone {
  return {
    ...auditFieldsFromRow(row, row.updated_at),
    id: row.id,
    workstreamId: row.workstream_id,
    title: row.title,
    status: row.status,
    updatedAt: row.updated_at,
    deletedAt: row.deleted_at,
    deviceId: row.device_id,
  };
}

export function workstreamActionFromRow(
  row: WorkstreamActionRow,
): WorkstreamAction {
  return {
    ...auditFieldsFromRow(row, row.updated_at),
    id: row.id,
    workstreamId: row.workstream_id,
    title: row.title,
    type: row.type,
    status: row.status,
    updatedAt: row.updated_at,
    deletedAt: row.deleted_at,
    deviceId: row.device_id,
  };
}

export function workstreamActionProjectFromRow(
  row: WorkstreamActionProjectRow,
): WorkstreamActionProject {
  return {
    ...auditFieldsFromRow(row, row.updated_at),
    id: row.id,
    actionId: row.action_id,
    projectId: row.project_id,
    updatedAt: row.updated_at,
    deletedAt: row.deleted_at,
    deviceId: row.device_id,
  };
}

export function workstreamActionDependencyFromRow(
  row: WorkstreamActionDependencyRow,
): WorkstreamActionDependency {
  return {
    ...auditFieldsFromRow(row, row.updated_at),
    id: row.id,
    actionId: row.action_id,
    dependsOnActionId: row.depends_on_action_id,
    updatedAt: row.updated_at,
    deletedAt: row.deleted_at,
    deviceId: row.device_id,
  };
}

export function knowledgeDocumentFromRow(
  row: KnowledgeDocumentRow,
): KnowledgeDocument {
  return {
    ...auditFieldsFromRow(row, row.updated_at),
    id: row.id,
    title: row.title,
    type: row.type as KnowledgeDocumentType,
    projectId: row.project_id,
    workstreamId: row.workstream_id,
    relativePath: row.relative_path,
    updatedAt: row.updated_at,
    deletedAt: row.deleted_at,
    deviceId: row.device_id,
  };
}

export function deviceFromRow(row: DeviceRow): Device {
  return {
    id: row.id,
    name: row.name,
    lastSeenAt: row.last_seen_at,
    appVersion: row.app_version,
  };
}

export function noteToRow(note: Note, userId: string): NoteRow {
  return {
    ...auditFieldsToRow(note),
    id: note.id,
    user_id: userId,
    title: note.title,
    content: note.content,
    updated_at: note.updatedAt,
    deleted_at: note.deletedAt,
    device_id: note.deviceId,
  };
}

export function taskToRow(task: Task, userId: string): TaskRow {
  return {
    ...auditFieldsToRow(task),
    id: task.id,
    user_id: userId,
    text: task.text,
    is_done: task.isDone,
    order_index: task.orderIndex,
    due_date: task.dueDate,
    due_time: task.dueTime,
    planned_date: task.plannedDate,
    updated_at: task.updatedAt,
    deleted_at: task.deletedAt,
    device_id: task.deviceId,
  };
}

export function workoutRecordToRow(
  record: LegacyWorkoutRecordV1,
  userId: string,
): WorkoutRecordRow {
  return {
    ...auditFieldsToRow(record),
    id: record.id,
    user_id: userId,
    date: record.date,
    workout_type: record.workoutType,
    category: record.category,
    exercise_name: record.exerciseName,
    duration_seconds: record.durationSeconds,
    average_heart_rate: record.averageHeartRate,
    source_app: record.sourceApp ?? "os",
    scope: record.scope ?? "both",
    metadata: record.metadata ?? {},
    contract_version: record.contractVersion ?? 1,
    updated_at: record.updatedAt,
    deleted_at: record.deletedAt,
    device_id: record.deviceId,
  };
}

export function mealRecordToRow(
  record: MealRecord,
  userId: string,
): MealRecordRow {
  return {
    ...auditFieldsToRow(record),
    id: record.id,
    user_id: userId,
    date: record.date,
    menu: record.menu,
    calories: record.calories,
    protein_grams: record.proteinGrams,
    carbs_grams: record.carbsGrams,
    fat_grams: record.fatGrams,
    source_app: record.sourceApp ?? "os",
    scope: record.scope ?? "both",
    metadata: record.metadata ?? {},
    contract_version: record.contractVersion ?? 1,
    updated_at: record.updatedAt,
    deleted_at: record.deletedAt,
    device_id: record.deviceId,
  };
}

export function weightRecordToRow(
  record: WeightRecord,
  userId: string,
): WeightRecordRow {
  return {
    ...auditFieldsToRow(record),
    id: record.id,
    user_id: userId,
    date: record.date,
    weight_kg: record.weightKg,
    source_app: record.sourceApp ?? "os",
    scope: record.scope ?? "both",
    metadata: record.metadata ?? {},
    contract_version: record.contractVersion ?? 1,
    updated_at: record.updatedAt,
    deleted_at: record.deletedAt,
    device_id: record.deviceId,
  };
}

export function projectToRow(project: Project, userId: string): ProjectRow {
  const githubIdentity = normalizeProjectGitHubIdentity(
    project.githubRepositoryId,
    project.githubOwner,
    project.githubRepo,
  );
  return {
    ...auditFieldsToRow(project),
    id: project.id,
    user_id: userId,
    name: project.name,
    description: project.description,
    repository: project.repository,
    branch: project.branch,
    github_repository_id: githubIdentity.githubRepositoryId,
    github_owner: githubIdentity.githubOwner,
    github_repo: githubIdentity.githubRepo,
    status: project.status,
    current_summary: project.currentSummary,
    target_summary: project.targetSummary,
    last_verified_commit: project.lastVerifiedCommit,
    last_verified_at: project.lastVerifiedAt,
    updated_at: project.updatedAt,
    deleted_at: project.deletedAt,
    device_id: project.deviceId,
  };
}

export function projectMilestoneToRow(
  milestone: ProjectMilestone,
  userId: string,
): ProjectMilestoneRow {
  return {
    ...auditFieldsToRow(milestone),
    id: milestone.id,
    user_id: userId,
    project_id: milestone.projectId,
    title: milestone.title,
    status: milestone.status,
    updated_at: milestone.updatedAt,
    deleted_at: milestone.deletedAt,
    device_id: milestone.deviceId,
  };
}

export function projectActionToRow(
  action: ProjectAction,
  userId: string,
): ProjectActionRow {
  return {
    ...auditFieldsToRow(action),
    id: action.id,
    user_id: userId,
    project_id: action.projectId,
    title: action.title,
    type: action.type,
    status: action.status,
    updated_at: action.updatedAt,
    deleted_at: action.deletedAt,
    device_id: action.deviceId,
  };
}

export function projectIdeaToRow(
  idea: ProjectIdea,
  userId: string,
): ProjectIdeaRow {
  return {
    ...auditFieldsToRow(idea),
    id: idea.id,
    user_id: userId,
    project_id: idea.projectId,
    title: idea.title,
    updated_at: idea.updatedAt,
    deleted_at: idea.deletedAt,
    device_id: idea.deviceId,
  };
}

export function projectHistoryToRow(
  history: ProjectHistory,
  userId: string,
): ProjectHistoryRow {
  return {
    ...auditFieldsToRow(history),
    id: history.id,
    user_id: userId,
    project_id: history.projectId,
    type: history.type,
    summary: history.summary,
    occurred_at: history.occurredAt,
    github_ref: history.githubRef,
    updated_at: history.updatedAt,
    deleted_at: history.deletedAt,
    device_id: history.deviceId,
  };
}

export function workstreamToRow(
  workstream: Workstream,
  userId: string,
): WorkstreamRow {
  return {
    ...auditFieldsToRow(workstream),
    id: workstream.id,
    user_id: userId,
    name: workstream.name,
    status: workstream.status,
    updated_at: workstream.updatedAt,
    deleted_at: workstream.deletedAt,
    device_id: workstream.deviceId,
  };
}

export function workstreamProjectToRow(
  link: WorkstreamProject,
  userId: string,
): WorkstreamProjectRow {
  return {
    ...auditFieldsToRow(link),
    id: link.id,
    user_id: userId,
    workstream_id: link.workstreamId,
    project_id: link.projectId,
    updated_at: link.updatedAt,
    deleted_at: link.deletedAt,
    device_id: link.deviceId,
  };
}

export function workstreamMilestoneToRow(
  milestone: WorkstreamMilestone,
  userId: string,
): WorkstreamMilestoneRow {
  return {
    ...auditFieldsToRow(milestone),
    id: milestone.id,
    user_id: userId,
    workstream_id: milestone.workstreamId,
    title: milestone.title,
    status: milestone.status,
    updated_at: milestone.updatedAt,
    deleted_at: milestone.deletedAt,
    device_id: milestone.deviceId,
  };
}

export function workstreamActionToRow(
  action: WorkstreamAction,
  userId: string,
): WorkstreamActionRow {
  return {
    ...auditFieldsToRow(action),
    id: action.id,
    user_id: userId,
    workstream_id: action.workstreamId,
    title: action.title,
    type: action.type,
    status: action.status,
    updated_at: action.updatedAt,
    deleted_at: action.deletedAt,
    device_id: action.deviceId,
  };
}

export function workstreamActionProjectToRow(
  link: WorkstreamActionProject,
  userId: string,
): WorkstreamActionProjectRow {
  return {
    ...auditFieldsToRow(link),
    id: link.id,
    user_id: userId,
    action_id: link.actionId,
    project_id: link.projectId,
    updated_at: link.updatedAt,
    deleted_at: link.deletedAt,
    device_id: link.deviceId,
  };
}

export function workstreamActionDependencyToRow(
  dependency: WorkstreamActionDependency,
  userId: string,
): WorkstreamActionDependencyRow {
  return {
    ...auditFieldsToRow(dependency),
    id: dependency.id,
    user_id: userId,
    action_id: dependency.actionId,
    depends_on_action_id: dependency.dependsOnActionId,
    updated_at: dependency.updatedAt,
    deleted_at: dependency.deletedAt,
    device_id: dependency.deviceId,
  };
}

export function knowledgeDocumentToRow(
  document: KnowledgeDocument,
  userId: string,
): KnowledgeDocumentRow {
  return {
    ...auditFieldsToRow(document),
    id: document.id,
    user_id: userId,
    title: document.title,
    type: document.type,
    project_id: document.projectId,
    workstream_id: document.workstreamId,
    relative_path: document.relativePath,
    updated_at: document.updatedAt,
    deleted_at: document.deletedAt,
    device_id: document.deviceId,
  };
}

export function deviceToRow(device: Device, userId: string): DeviceRow {
  return {
    id: device.id,
    user_id: userId,
    name: device.name,
    last_seen_at: device.lastSeenAt,
    app_version: device.appVersion ?? null,
  };
}
