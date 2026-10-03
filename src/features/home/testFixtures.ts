import type { FitnessSummaryProjectionV2, LocalDataSnapshot, SyncableEntity, Task } from "../../types";

export const entity: SyncableEntity = {
  id: "entity-1",
  createdAt: "2026-10-01T15:00:00.000Z",
  updatedAt: "2026-10-02T01:00:00.000Z",
  deletedAt: null,
  deviceId: "device-1",
  isBackfilled: false,
  backfilledAt: null,
  backfillReason: null,
};

export function emptySnapshot(): LocalDataSnapshot {
  return {
    notes: [], tasks: [], workoutRecords: [], fitnessSummaryProjections: [],
    mealRecords: [], weightRecords: [], devices: [], projects: [],
    projectMilestones: [], projectActions: [], projectIdeas: [], projectHistory: [],
    workstreams: [], workstreamProjects: [], workstreamMilestones: [], workstreamActions: [],
    workstreamActionProjects: [], workstreamActionDependencies: [], knowledgeDocuments: [],
  };
}

export function task(overrides: Partial<Task> = {}): Task {
  return { ...entity, id: "task-1", text: "오늘 할 일", isDone: false, orderIndex: 0, dueDate: "2026-10-02", dueTime: null, plannedDate: "2026-10-02", ...overrides };
}

export function projection(overrides: Partial<FitnessSummaryProjectionV2> = {}): FitnessSummaryProjectionV2 {
  return {
    ...entity, id: "projection-1", sourceFitnessSessionId: "fitness-session-1", date: "2026-10-02",
    completionStatus: "completed", chestSets: 5, backSets: 0, legsSets: 0, shouldersSets: 0,
    absSets: 0, tricepsSets: 0, bicepsSets: 0, totalDurationSeconds: 1800, cardioDurationSeconds: null,
    contractVersion: 2, ...overrides,
  };
}
