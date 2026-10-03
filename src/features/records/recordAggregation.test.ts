import { describe, expect, it } from "vitest";
import { makeWorkoutRecord } from "../../lib/sync/supabase/testFixtures";
import type {
  FitnessSummaryProjectionV2,
  LocalDataSnapshot,
  MealRecord,
  Task,
  WeightRecord,
} from "../../types";
import {
  getCalendarMarkers,
  getDashboardStats,
  getNutritionSeries,
  getProductivitySeries,
  getRecordsForDate,
  getWeightRecordsForDisplay,
} from "./recordAggregation";

const liveWorkout: FitnessSummaryProjectionV2 = {
  id: "workout-live",
  createdAt: "2026-06-09T00:00:00.000Z",
  updatedAt: "2026-06-09T00:00:00.000Z",
  deletedAt: null,
  deviceId: "device-a",
  isBackfilled: false,
  backfilledAt: null,
  backfillReason: null,
  sourceFitnessSessionId: "workout-live",
  date: "2026-06-09",
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

const deletedWorkout: FitnessSummaryProjectionV2 = {
  ...liveWorkout,
  id: "workout-deleted",
  deletedAt: "2026-06-09T00:00:01.000Z",
};

const liveMeal: MealRecord = {
  id: "meal-live",
  createdAt: "2026-06-09T00:00:00.000Z",
  date: "2026-06-09",
  menu: "salad",
  calories: 600,
  proteinGrams: 40,
  carbsGrams: 50,
  fatGrams: 20,
  isBackfilled: false,
  backfilledAt: null,
  backfillReason: null,
  updatedAt: "2026-06-09T00:00:00.000Z",
  deletedAt: null,
  deviceId: "device-a",
};

const deletedMeal: MealRecord = {
  ...liveMeal,
  id: "meal-deleted",
  calories: 1000,
  proteinGrams: 100,
  deletedAt: "2026-06-09T00:00:01.000Z",
};

const liveWeight: WeightRecord = {
  id: "weight-live",
  createdAt: "2026-06-09T00:00:00.000Z",
  date: "2026-06-09",
  weightKg: 72,
  isBackfilled: false,
  backfilledAt: null,
  backfillReason: null,
  updatedAt: "2026-06-09T00:00:00.000Z",
  deletedAt: null,
  deviceId: "device-a",
};

const deletedWeight: WeightRecord = {
  ...liveWeight,
  id: "weight-deleted",
  weightKg: 80,
  deletedAt: "2026-06-09T00:00:01.000Z",
};

const directTask: Task = {
  id: "task-direct",
  createdAt: "2026-06-09T00:00:00.000Z",
  text: "direct",
  isDone: true,
  orderIndex: 0,
  dueDate: "2026-06-09",
  dueTime: null,
  plannedDate: "2026-06-09",
  isBackfilled: false,
  backfilledAt: null,
  backfillReason: null,
  updatedAt: "2026-06-09T00:00:00.000Z",
  deletedAt: null,
  deviceId: "device-a",
};

const backfilledTask: Task = {
  ...directTask,
  id: "task-backfilled",
  text: "backfilled",
  isBackfilled: true,
  backfilledAt: "2026-06-10T00:00:00.000Z",
  backfillReason: "test",
};

const snapshot: LocalDataSnapshot = {
  notes: [],
  tasks: [],
  workoutRecords: [],
  fitnessSummaryProjections: [liveWorkout, deletedWorkout],
  mealRecords: [liveMeal, deletedMeal],
  weightRecords: [liveWeight, deletedWeight],
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

describe("recordAggregation", () => {
  it("excludes tombstones from selected date records", () => {
    const records = getRecordsForDate(snapshot, "2026-06-09");

    expect(records.workoutRecords).toHaveLength(1);
    expect(records.mealRecords).toHaveLength(1);
    expect(records.weightRecords).toHaveLength(1);
    expect(records.workoutRecords[0].id).toBe("workout-live");
  });

  it("shows completed Summary Projection v2 rows", () => {
    const sharedWorkout: FitnessSummaryProjectionV2 = {
      ...liveWorkout,
      id: "fitness-shared",
      sourceFitnessSessionId: "fitness-shared",
    };
    const connectedSnapshot = {
      ...snapshot,
      workoutRecords: [],
      fitnessSummaryProjections: [sharedWorkout],
    };

    const records = getRecordsForDate(connectedSnapshot, "2026-06-09");
    const markers = getCalendarMarkers(connectedSnapshot, "2026-06-09");

    expect(records.workoutRecords.map((record) => record.id)).toEqual([
      "fitness-shared",
    ]);
    expect(markers["2026-06-09"]?.workouts).toBe(true);
  });

  it("marks and lists only completed shared Fitness v1 workouts", () => {
    const shared = makeWorkoutRecord({
      id: "legacy-legs",
      date: "2026-06-09",
      sourceApp: "fitness",
      scope: "both",
      category: "하체",
      metadata: { status: "completed" },
    });
    const inProgress = makeWorkoutRecord({
      ...shared,
      id: "in-progress",
      scope: "fitness",
      metadata: { status: "in_progress" },
    });
    const removed = makeWorkoutRecord({
      ...shared,
      id: "removed",
      deletedAt: "2026-06-10T00:00:00.000Z",
    });
    const legacySnapshot = {
      ...snapshot,
      fitnessSharedWorkoutRecords: [shared, inProgress, removed],
      fitnessSummaryProjections: [],
    };

    expect(getRecordsForDate(legacySnapshot, "2026-06-09").workoutRecords)
      .toEqual([shared]);
    expect(getCalendarMarkers(legacySnapshot, "2026-06-09")["2026-06-09"]?.workouts)
      .toBe(true);
  });

  it("excludes tombstones from dashboard stats", () => {
    const stats = getDashboardStats(snapshot, {
      startDate: "2026-06-01",
      endDate: "2026-06-30",
    });

    expect(stats.averageCalories).toBe(600);
    expect(stats.averageProteinGrams).toBe(40);
    expect(stats.latestWeightKg).toBe(72);
  });

  it("includes backfilled behavior records but excludes backfilled tasks from productivity", () => {
    const stats = getDashboardStats(
      {
        ...snapshot,
        tasks: [directTask, backfilledTask],
        mealRecords: [
          liveMeal,
          {
            ...liveMeal,
            id: "meal-backfilled",
            calories: 800,
            proteinGrams: 60,
            isBackfilled: true,
            backfilledAt: "2026-06-10T00:00:00.000Z",
            backfillReason: "test",
          },
        ],
      },
      {
        startDate: "2026-06-01",
        endDate: "2026-06-30",
      },
    );

    expect(stats.completedTasks).toBe(1);
    expect(stats.totalTasks).toBe(1);
    expect(stats.backfilledTaskCount).toBe(1);
    expect(stats.averageCalories).toBe(700);
    expect(stats.backfilledMealCount).toBe(1);
    expect(stats.totalBackfilledCount).toBe(2);
  });

  it("excludes zero meal nutrition values from averages", () => {
    const zeroMeal: MealRecord = {
      ...liveMeal,
      id: "meal-zero",
      calories: 0,
      proteinGrams: 0,
    };
    const stats = getDashboardStats(
      {
        ...snapshot,
        mealRecords: [liveMeal, zeroMeal],
      },
      {
        startDate: "2026-06-01",
        endDate: "2026-06-30",
      },
    );
    const series = getNutritionSeries([liveMeal, zeroMeal], {
      startDate: "2026-06-09",
      endDate: "2026-06-09",
    });

    expect(stats.averageCalories).toBe(600);
    expect(stats.averageProteinGrams).toBe(40);
    expect(series[0].averageCalories).toBe(600);
    expect(series[0].averageProteinGrams).toBe(40);
  });

  it("keeps Fitness meal details out of OS date records even when the legacy scope is both", () => {
    const fitnessMeal = {
      ...liveMeal,
      sourceApp: "fitness" as const,
      scope: "both" as const,
      menu: "private Fitness meal detail",
    };
    const records = getRecordsForDate(
      { ...snapshot, mealRecords: [fitnessMeal] },
      "2026-06-09",
    );

    expect(records.mealRecords).toEqual([]);
  });

  it("does not present cached weights as current until a remote pull succeeds", () => {
    expect(getWeightRecordsForDisplay([liveWeight], { mode: "offline" })).toEqual([]);
    expect(getWeightRecordsForDisplay([liveWeight], { mode: "error" })).toEqual([]);
    expect(getWeightRecordsForDisplay([liveWeight], { mode: "synced" })).toEqual([liveWeight]);
  });
  it("does not create markers for tombstone-only dates", () => {
    const markers = getCalendarMarkers(
      {
        ...snapshot,
        workoutRecords: [],
        fitnessSummaryProjections: [deletedWorkout],
        mealRecords: [deletedMeal],
        weightRecords: [deletedWeight],
      },
      "2026-06-09",
    );

    expect(markers["2026-06-09"]).toBeUndefined();
  });

  it("shows scheduled tasks across dates before the due date", () => {
    const scheduledTask: Task = {
      ...directTask,
      id: "task-scheduled",
      text: "scheduled",
      isDone: false,
      createdAt: "2026-06-07T00:00:00.000Z",
      updatedAt: "2026-06-07T00:00:00.000Z",
      dueDate: "2026-06-09",
    };
    const markers = getCalendarMarkers(
      {
        ...snapshot,
        tasks: [scheduledTask],
      },
      "2026-06-09",
    );

    expect(markers["2026-06-07"]?.tasks.activeCount).toBe(1);
    expect(markers["2026-06-07"]?.tasks.dueCount).toBe(0);
    expect(markers["2026-06-08"]?.tasks.activeCount).toBe(1);
    expect(markers["2026-06-08"]?.tasks.dueCount).toBe(0);
    expect(markers["2026-06-09"]?.tasks.activeCount).toBe(1);
    expect(markers["2026-06-09"]?.tasks.dueCount).toBe(1);
  });

  it("includes still-active scheduled tasks in earlier date records", () => {
    const scheduledTask: Task = {
      ...directTask,
      id: "task-scheduled",
      text: "scheduled",
      isDone: false,
      createdAt: "2026-06-07T00:00:00.000Z",
      updatedAt: "2026-06-07T00:00:00.000Z",
      dueDate: "2026-06-09",
    };
    const records = getRecordsForDate(
      {
        ...snapshot,
        tasks: [scheduledTask],
      },
      "2026-06-08",
    );

    expect(records.tasks).toHaveLength(1);
    expect(records.tasks[0].id).toBe("task-scheduled");
  });

  it("counts multiple active tasks as multiple calendar dots before the due date", () => {
    const firstTask: Task = {
      ...directTask,
      id: "task-scheduled-1",
      isDone: false,
      createdAt: "2026-06-07T00:00:00.000Z",
      updatedAt: "2026-06-07T00:00:00.000Z",
      dueDate: "2026-06-09",
    };
    const secondTask: Task = {
      ...directTask,
      id: "task-scheduled-2",
      isDone: false,
      createdAt: "2026-06-08T00:00:00.000Z",
      updatedAt: "2026-06-08T00:00:00.000Z",
      dueDate: "2026-06-10",
    };
    const markers = getCalendarMarkers(
      {
        ...snapshot,
        tasks: [firstTask, secondTask],
      },
      "2026-06-09",
    );

    expect(markers["2026-06-08"]?.tasks.activeCount).toBe(2);
    expect(markers["2026-06-08"]?.tasks.dueCount).toBe(0);
    expect(markers["2026-06-09"]?.tasks.activeCount).toBe(2);
    expect(markers["2026-06-09"]?.tasks.dueCount).toBe(1);
  });

  it("uses planned dates for productivity and marks fully completed planned days", () => {
    const plannedDone: Task = {
      ...directTask,
      id: "task-planned-done",
      dueDate: "2026-06-20",
      plannedDate: "2026-06-11",
      isDone: true,
    };
    const plannedOpen: Task = {
      ...directTask,
      id: "task-planned-open",
      dueDate: "2026-06-11",
      plannedDate: "2026-06-12",
      isDone: false,
    };
    const unplannedDue: Task = {
      ...directTask,
      id: "task-unplanned-due",
      dueDate: "2026-06-11",
      plannedDate: null,
      isDone: true,
    };
    const taskSnapshot = {
      ...snapshot,
      tasks: [plannedDone, plannedOpen, unplannedDue],
    };
    const stats = getDashboardStats(taskSnapshot, {
      startDate: "2026-06-01",
      endDate: "2026-06-30",
    });
    const series = getProductivitySeries(taskSnapshot.tasks, {
      startDate: "2026-06-01",
      endDate: "2026-06-30",
    });
    const markers = getCalendarMarkers(taskSnapshot, "2026-06-01");

    expect(stats.completedTasks).toBe(1);
    expect(stats.totalTasks).toBe(2);
    expect(stats.productivityScore).toBe(50);
    expect(series.map((point) => point.date)).toEqual([
      "2026-06-11",
      "2026-06-12",
    ]);
    expect(markers["2026-06-11"]?.tasks.allPlannedDone).toBe(true);
    expect(markers["2026-06-12"]?.tasks.allPlannedDone).toBe(false);
  });
});
