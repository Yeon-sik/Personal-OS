import type {
  Device,
  DevActionStatus,
  DevActionType,
  DevHistoryType,
  DevMilestoneStatus,
  DevProjectStatus,
  DevWorkstreamStatus,
  FitnessSummaryProjectionV2,
  KnowledgeDocument,
  KnowledgeDocumentType,
  LegacyWorkoutRecordV1,
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
  Workstream,
  WorkstreamAction,
  WorkstreamActionDependency,
  WorkstreamActionProject,
  WorkstreamMilestone,
  WorkstreamProject,
} from "../../../types";

export const TEST_TIME = "2026-08-01T00:00:00.000Z";

const auditFields = {
  createdAt: TEST_TIME,
  updatedAt: TEST_TIME,
  deletedAt: null,
  deviceId: "device-a",
  isBackfilled: false,
  backfilledAt: null,
  backfillReason: null,
} as const;

export function makeNote(overrides: Partial<Note> = {}): Note {
  return {
    ...auditFields,
    id: "note-1",
    title: "Title",
    content: "Content",
    ...overrides,
  };
}

export function makeTask(overrides: Partial<Task> = {}): Task {
  return {
    ...auditFields,
    id: "task-1",
    text: "Task",
    isDone: false,
    orderIndex: 0,
    dueDate: null,
    dueTime: null,
    plannedDate: null,
    ...overrides,
  };
}

export function makeWorkoutRecord(
  overrides: Partial<LegacyWorkoutRecordV1> = {},
): LegacyWorkoutRecordV1 {
  return {
    ...auditFields,
    id: "workout-1",
    date: "2026-08-01",
    workoutType: "strength",
    category: "웨이트",
    exerciseName: "Squat",
    durationSeconds: 1800,
    averageHeartRate: 120,
    sourceApp: "os",
    scope: "both",
    metadata: { sets: 3 },
    contractVersion: 1,
    ...overrides,
  };
}

export function makeFitnessSummaryProjection(
  overrides: Partial<FitnessSummaryProjectionV2> = {},
): FitnessSummaryProjectionV2 {
  return {
    ...auditFields,
    id: "workout-1",
    sourceFitnessSessionId: "workout-1",
    date: "2026-08-01",
    completionStatus: "completed",
    chestSets: 14,
    backSets: 8,
    legsSets: 0,
    shouldersSets: 0,
    absSets: 0,
    tricepsSets: 0,
    bicepsSets: 0,
    totalDurationSeconds: 3600,
    cardioDurationSeconds: null,
    contractVersion: 2,
    ...overrides,
  };
}

export function makeMealRecord(
  overrides: Partial<MealRecord> = {},
): MealRecord {
  return {
    ...auditFields,
    id: "meal-1",
    date: "2026-08-01",
    menu: "Lunch",
    calories: 600,
    proteinGrams: 40,
    carbsGrams: 70,
    fatGrams: 20,
    sourceApp: "fitness",
    scope: "fitness",
    metadata: { source: "manual" },
    contractVersion: 1,
    ...overrides,
  };
}

export function makeWeightRecord(
  overrides: Partial<WeightRecord> = {},
): WeightRecord {
  return {
    ...auditFields,
    id: "weight-1",
    date: "2026-08-01",
    weightKg: 75.5,
    sourceApp: "os",
    scope: "both",
    metadata: {},
    contractVersion: 1,
    ...overrides,
  };
}

export function makeDevice(overrides: Partial<Device> = {}): Device {
  return {
    id: "device-a",
    name: "Desktop",
    lastSeenAt: TEST_TIME,
    appVersion: "1.0.0",
    ...overrides,
  };
}

export function makeProject(overrides: Partial<Project> = {}): Project {
  return {
    ...auditFields,
    id: "project-1",
    name: "Project",
    description: "Description",
    repository: "https://github.com/example/project",
    branch: "main",
    githubRepositoryId: "12345",
    githubOwner: "example",
    githubRepo: "project",
    status: "ACTIVE" satisfies DevProjectStatus,
    currentSummary: "Current",
    targetSummary: "Target",
    lastVerifiedCommit: null,
    lastVerifiedAt: null,
    ...overrides,
  };
}

export function makeKnowledgeDocument(
  overrides: Partial<KnowledgeDocument> = {},
): KnowledgeDocument {
  return {
    ...auditFields,
    id: "knowledge-document-1",
    title: "Document",
    type: "PLAN" satisfies KnowledgeDocumentType,
    projectId: "project-1",
    workstreamId: null,
    relativePath: "Projects/Project/Plans/Document.md",
    ...overrides,
  };
}

export function makeProjectMilestone(
  overrides: Partial<ProjectMilestone> = {},
): ProjectMilestone {
  return {
    ...auditFields,
    id: "milestone-1",
    projectId: "project-1",
    title: "Milestone",
    status: "PLANNED" satisfies DevMilestoneStatus,
    ...overrides,
  };
}

export function makeProjectAction(
  overrides: Partial<ProjectAction> = {},
): ProjectAction {
  return {
    ...auditFields,
    id: "action-1",
    projectId: "project-1",
    title: "Action",
    type: "NEXT" satisfies DevActionType,
    status: "OPEN" satisfies DevActionStatus,
    ...overrides,
  };
}

export function makeProjectIdea(overrides: Partial<ProjectIdea> = {}): ProjectIdea {
  return {
    ...auditFields,
    id: "idea-1",
    projectId: "project-1",
    title: "Idea",
    ...overrides,
  };
}

export function makeProjectHistory(
  overrides: Partial<ProjectHistory> = {},
): ProjectHistory {
  return {
    ...auditFields,
    id: "history-1",
    projectId: "project-1",
    type: "NOTE" satisfies DevHistoryType,
    summary: "History",
    occurredAt: TEST_TIME,
    githubRef: null,
    ...overrides,
  };
}

export function makeWorkstream(
  overrides: Partial<Workstream> = {},
): Workstream {
  return {
    ...auditFields,
    id: "workstream-1",
    name: "Workstream",
    status: "ACTIVE" satisfies DevWorkstreamStatus,
    ...overrides,
  };
}

export function makeWorkstreamProject(
  overrides: Partial<WorkstreamProject> = {},
): WorkstreamProject {
  return {
    ...auditFields,
    id: "workstream-1:project-1",
    workstreamId: "workstream-1",
    projectId: "project-1",
    ...overrides,
  };
}

export function makeWorkstreamMilestone(
  overrides: Partial<WorkstreamMilestone> = {},
): WorkstreamMilestone {
  return {
    ...auditFields,
    id: "workstream-milestone-1",
    workstreamId: "workstream-1",
    title: "Workstream milestone",
    status: "PLANNED" satisfies DevMilestoneStatus,
    ...overrides,
  };
}

export function makeWorkstreamAction(
  overrides: Partial<WorkstreamAction> = {},
): WorkstreamAction {
  return {
    ...auditFields,
    id: "workstream-action-1",
    workstreamId: "workstream-1",
    title: "Workstream action",
    type: "NEXT" satisfies DevActionType,
    status: "OPEN" satisfies DevActionStatus,
    ...overrides,
  };
}

export function makeWorkstreamActionProject(
  overrides: Partial<WorkstreamActionProject> = {},
): WorkstreamActionProject {
  return {
    ...auditFields,
    id: "workstream-action-1:project-1",
    actionId: "workstream-action-1",
    projectId: "project-1",
    ...overrides,
  };
}

export function makeWorkstreamActionDependency(
  overrides: Partial<WorkstreamActionDependency> = {},
): WorkstreamActionDependency {
  return {
    ...auditFields,
    id: "workstream-action-1:workstream-action-2",
    actionId: "workstream-action-1",
    dependsOnActionId: "workstream-action-2",
    ...overrides,
  };
}

export function makeSnapshot(
  overrides: Partial<LocalDataSnapshot> = {},
): LocalDataSnapshot {
  return {
    notes: [],
    tasks: [],
    workoutRecords: [],
    fitnessSummaryProjections: [],
    fitnessWeightRecords: [],
    mealRecords: [],
    weightRecords: [],
    devices: [],
    projects: [],
    projectMilestones: [],
    projectActions: [],
    projectIdeas: [],
    projectHistory: [],
    workstreams: [],
    workstreamProjects: [],
    workstreamMilestones: [],
    workstreamActions: [],
    workstreamActionProjects: [],
    workstreamActionDependencies: [],
    knowledgeDocuments: [],
    ...overrides,
  };
}
