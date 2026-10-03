import { describe, expect, it } from "vitest";
import type {
  FitnessSummaryProjectionV2,
  LegacyWorkoutRecordV1,
  LocalDataSnapshot,
  MealRecord,
  WeightRecord,
} from "../../types";
import { getFitnessSummary } from "./fitnessSummary";
import { formatSharedWorkoutLabels } from "./sharedWorkoutSummaries";
import type { FitnessNutritionSummaryV1 } from "./fitnessNutritionContract";

const auditFields = {
  createdAt: "2026-07-08T01:00:00.000Z",
  updatedAt: "2026-07-08T01:00:00.000Z",
  deletedAt: null,
  deviceId: "device-a",
  isBackfilled: false,
  backfilledAt: null,
  backfillReason: null,
} as const;

const projection: FitnessSummaryProjectionV2 = {
  ...auditFields,
  id: "workout-1",
  sourceFitnessSessionId: "workout-1",
  date: "2026-07-08",
  completionStatus: "completed",
  chestSets: 14,
  backSets: 0,
  legsSets: 0,
  shouldersSets: 0,
  absSets: 0,
  tricepsSets: 0,
  bicepsSets: 0,
  totalDurationSeconds: 3_600,
  cardioDurationSeconds: null,
  contractVersion: 2,
};

const legacyWorkout: LegacyWorkoutRecordV1 = {
  ...auditFields,
  id: "legacy-workout-detail",
  date: "2026-07-08",
  workoutType: "strength",
  category: "chest",
  exerciseName: "Bench press",
  durationSeconds: 3600,
  averageHeartRate: null,
  sourceApp: "fitness",
  scope: "fitness",
  metadata: {},
  contractVersion: 1,
};
const previousProjection: FitnessSummaryProjectionV2 = {
  ...projection,
  id: "workout-2",
  sourceFitnessSessionId: "workout-2",
  date: "2026-07-05",
  chestSets: 0,
  backSets: 8,
};

const meal: MealRecord = {
  ...auditFields,
  id: "meal-1",
  date: "2026-07-08",
  menu: "chicken salad",
  calories: 500,
  proteinGrams: 40,
  carbsGrams: null,
  fatGrams: null,
};

const nutritionSummary: FitnessNutritionSummaryV1 = {
  id: "2026-07-08",
  date: "2026-07-08",
  contractVersion: 1,
  mealCount: 2,
  calories: 1600,
  carbsGrams: null,
  proteinGrams: 80,
  fatGrams: 50,
  updatedAt: "2026-07-08T12:00:00.000Z",
};
const latestWeight: WeightRecord = {
  ...auditFields,
  id: "weight-1",
  date: "2026-07-08",
  weightKg: 72,
};

const previousWeight: WeightRecord = {
  ...latestWeight,
  id: "weight-2",
  date: "2026-07-01",
  weightKg: 73.5,
};

function snapshot(
  overrides: Partial<LocalDataSnapshot> = {},
): LocalDataSnapshot {
  return {
    notes: [],
    tasks: [],
    workoutRecords: [],
    fitnessSummaryProjections: [],
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

describe("getFitnessSummary", () => {
  it("summarizes only the Fitness-owned Summary Projection v2", () => {
    const summary = getFitnessSummary(
      snapshot({
        fitnessSummaryProjections: [previousProjection, projection],
        mealRecords: [meal],
        fitnessNutritionSummaries: [nutritionSummary],
        weightRecords: [previousWeight, latestWeight],
      }),
      "2026-07-08",
    );

    expect(summary.todayHasWorkout).toBe(true);
    expect(summary.weeklyWorkoutCount).toBe(2);
    expect(summary.weeklyStrengthSetSummaries).toEqual([
      "가슴 운동 14세트",
      "등 운동 8세트",
    ]);
    expect(summary.recentWorkouts).toEqual([projection, previousProjection]);
    expect(summary.latestWeightKg).toBe(72);
    expect(summary.weightDeltaKg).toBe(-1.5);
    expect(summary.todayHasMeal).toBe(true);
    expect(summary.latestMeal).toBeNull();
    expect(summary.latestNutritionSummary).toEqual(nutritionSummary);
    expect(summary.connection.status).toBe("summary_projection_v2");
    expect(summary.connection.linkedCount).toBe(2);
    expect(summary.connection.quickRecordOnlyCount).toBe(0);
    expect(summary.connection.possibleMismatchCount).toBe(0);
  });

  it("does not infer a live meal from the local legacy meal archive", () => {
    const summary = getFitnessSummary(snapshot({ mealRecords: [meal] }), "2026-07-08");

    expect(summary.todayHasMeal).toBe(false);
    expect(summary.latestMeal).toBeNull();
    expect(summary.latestNutritionSummary).toBeNull();
  });

  it("does not treat archived raw workout rows as a live Fitness workout", () => {
    const summary = getFitnessSummary(snapshot({ workoutRecords: [legacyWorkout] }), "2026-07-08");

    expect(summary.todayHasWorkout).toBe(false);
    expect(summary.recentWorkouts).toEqual([]);
  });

  it("shows a completed shared legacy category without inventing set counts", () => {
    const shared = {
      ...legacyWorkout,
      id: "legacy-legs",
      category: "하체",
      scope: "both" as const,
      metadata: { status: "completed" },
    };
    const summary = getFitnessSummary(snapshot({ fitnessSharedWorkoutRecords: [shared] }), "2026-07-08");

    expect(summary.todayHasWorkout).toBe(true);
    expect(summary.weeklyWorkoutCount).toBe(1);
    expect(summary.weeklyStrengthSetSummaries).toEqual([]);
    expect(summary.recentWorkouts).toEqual([shared]);
    expect(formatSharedWorkoutLabels(summary.recentWorkouts[0])).toEqual(["하체 운동"]);
    expect(summary.connection.status).toBe("legacy_shared_workouts");
  });

  it("prefers v2 for the same session and honors its tombstone", () => {
    const shared = {
      ...legacyWorkout,
      id: projection.sourceFitnessSessionId,
      category: "하체",
      scope: "both" as const,
      metadata: { status: "completed" },
    };
    const active = getFitnessSummary(
      snapshot({ fitnessSharedWorkoutRecords: [shared], fitnessSummaryProjections: [projection] }),
      "2026-07-08",
    );
    const deleted = getFitnessSummary(
      snapshot({ fitnessSharedWorkoutRecords: [shared], fitnessSummaryProjections: [
        { ...projection, deletedAt: "2026-07-09T00:00:00.000Z" },
      ] }),
      "2026-07-08",
    );

    expect(active.weeklyWorkoutCount).toBe(1);
    expect(active.recentWorkouts).toEqual([projection]);
    expect(deleted.recentWorkouts).toEqual([]);
  });

  it("reports no projection when the v2 read model is empty", () => {
    const summary = getFitnessSummary(snapshot(), "2026-07-08");

    expect(summary.todayHasWorkout).toBe(false);
    expect(summary.connection.status).toBe("no_fitness_records");
    expect(summary.connection.possibleMismatchCount).toBe(0);
  });
});
