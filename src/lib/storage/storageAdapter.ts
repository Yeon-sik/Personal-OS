import type { LocalDataSnapshot } from "../../types";

// 저장소 구현을 교체하기 위한 최소 인터페이스다.
// 현재는 localStorage를 쓰지만 IndexedDB/SQLite 어댑터로 확장할 수 있다.
export interface StorageAdapter {
  load(): Promise<LocalDataSnapshot>;
  save(snapshot: LocalDataSnapshot): Promise<void>;
}

// 데이터가 없거나 손상되었을 때 앱이 빈 상태로 시작할 수 있게 한다.
export function createEmptySnapshot(): LocalDataSnapshot {
  return {
    notes: [],
    tasks: [],
    workoutRecords: [],
    fitnessSharedWorkoutRecords: [],
    fitnessSummaryProjections: [],
    fitnessNutritionSummaries: [],
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
  };
}
