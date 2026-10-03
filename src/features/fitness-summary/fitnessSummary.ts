import type {
  FitnessSummaryProjectionV2,
  LocalDataSnapshot,
  MealRecord,
  WeightRecord,
} from "../../types";
import { formatLocalDate, isWithinDateRange, parseDateInput } from "../fitness/fitnessDate";
import { formatSharedWorkoutLabels, getVisibleSharedWorkouts, isFitnessSummaryProjectionV2, type SharedWorkoutSummary } from "./sharedWorkoutSummaries";

export interface FitnessSummary {
  todayHasWorkout: boolean;
  recentWorkouts: SharedWorkoutSummary[];
  weeklyWorkoutCount: number;
  weeklyStrengthSetSummaries: string[];
  latestWeightKg: number | null;
  previousWeightKg: number | null;
  weightDeltaKg: number | null;
  latestMeal: MealRecord | null;
  todayHasMeal: boolean;
  latestNutritionSummary: import("./fitnessNutritionContract").FitnessNutritionSummaryV1 | null;
  connection: FitnessConnectionSummary;
}

export type FitnessConnectionStatus =
  | "no_fitness_records"
  | "legacy_shared_workouts"
  | "summary_projection_v2";

export interface FitnessConnectionSummary {
  status: FitnessConnectionStatus;
  linkedCount: number;
  quickRecordOnlyCount: number;
  possibleMismatchCount: number;
  message: string;
}

const STRENGTH_PARTS: Array<{
  key: keyof Pick<
    FitnessSummaryProjectionV2,
    | "chestSets"
    | "backSets"
    | "legsSets"
    | "shouldersSets"
    | "absSets"
    | "tricepsSets"
    | "bicepsSets"
  >;
  label: string;
}> = [
  { key: "chestSets", label: "가슴" },
  { key: "backSets", label: "등" },
  { key: "legsSets", label: "하체" },
  { key: "shouldersSets", label: "어깨" },
  { key: "absSets", label: "복부" },
  { key: "tricepsSets", label: "삼두" },
  { key: "bicepsSets", label: "이두" },
];

function isVisibleLegacyRecord(entity: {
  deletedAt: string | null;
  scope?: string;
  sourceApp?: string;
}): boolean {
  return entity.deletedAt === null && entity.scope !== "fitness" && entity.sourceApp !== "fitness";
}

function sortByDateDescThenUpdatedDesc<T extends { date: string; updatedAt: string }>(
  records: T[],
): T[] {
  return [...records].sort((first, second) => {
    if (first.date !== second.date) {
      return second.date.localeCompare(first.date);
    }

    return second.updatedAt.localeCompare(first.updatedAt);
  });
}

function getLastSevenDayRange(today: string): { startDate: string; endDate: string } {
  const end = parseDateInput(today);
  const start = new Date(end);
  start.setDate(start.getDate() - 6);

  return {
    startDate: formatLocalDate(start),
    endDate: today,
  };
}

/**
 * Converts the v2 projection into the only workout labels Personal OS may
 * display. Exercise identity and per-set values never enter this formatter.
 */
export function formatFitnessProjectionLabels(
  projection: FitnessSummaryProjectionV2,
): string[] {
  return formatSharedWorkoutLabels(projection);
}

function getWeeklyStrengthSetSummaries(
  projections: FitnessSummaryProjectionV2[],
): string[] {
  const totals = new Map<(typeof STRENGTH_PARTS)[number]["key"], number>();

  for (const projection of projections) {
    for (const { key } of STRENGTH_PARTS) {
      const count = projection[key];
      if (count > 0) {
        totals.set(key, (totals.get(key) ?? 0) + count);
      }
    }
  }

  return [...totals.entries()]
    .sort((first, second) => {
      if (first[1] !== second[1]) {
        return second[1] - first[1];
      }
      return first[0].localeCompare(second[0]);
    })
    .map(([key, count]) => {
      const label = STRENGTH_PARTS.find((part) => part.key === key)?.label ?? "기타";
      return `${label} 운동 ${count}세트`;
    });
}

function getConnectionSummary(
  visibleWorkouts: SharedWorkoutSummary[],
): FitnessConnectionSummary {
  const hiddenInProgressFitnessRecords = 0;

  if (visibleWorkouts.length === 0) {
    return {
      status: "no_fitness_records",
      linkedCount: 0,
      quickRecordOnlyCount: 0,
      possibleMismatchCount: hiddenInProgressFitnessRecords,
      message: "Personal OS에 표시할 Summary Projection v2가 없습니다.",
    };
  }

  const v2Count = visibleWorkouts.filter(isFitnessSummaryProjectionV2).length;
  if (v2Count === 0) {
    return {
      status: "legacy_shared_workouts",
      linkedCount: visibleWorkouts.length,
      quickRecordOnlyCount: 0,
      possibleMismatchCount: 0,
      message: "Fitness가 공유한 기존 완료 운동의 범주만 표시합니다. 세트 수는 v2 요약이 수신되면 표시됩니다.",
    };
  }

  return {
    status: "summary_projection_v2",
    linkedCount: visibleWorkouts.length,
    quickRecordOnlyCount: 0,
    possibleMismatchCount: hiddenInProgressFitnessRecords,
    message:
      "FitnessApp의 v2 요약을 우선 표시하며, 아직 v2가 없는 기존 공유 운동은 범주만 표시합니다.",
  };
}

export function getFitnessSummary(
  snapshot: LocalDataSnapshot,
  today = formatLocalDate(),
): FitnessSummary {
  const visibleWorkouts = sortByDateDescThenUpdatedDesc(
    getVisibleSharedWorkouts(snapshot),
  );
  const visibleWeights = sortByDateDescThenUpdatedDesc(
    (snapshot.fitnessWeightRecords ?? snapshot.weightRecords.filter(isVisibleLegacyRecord))
      .filter((record) => record.deletedAt === null),
  );
  const nutritionSummaries = (snapshot.fitnessNutritionSummaries ?? []).filter((summary) => summary.date <= today).sort((first, second) => second.date.localeCompare(first.date));
  const latestNutritionSummary = nutritionSummaries[0] ?? null;
  const weekRange = getLastSevenDayRange(today);
  const weeklyWorkouts = visibleWorkouts.filter((record) =>
    isWithinDateRange(record.date, weekRange.startDate, weekRange.endDate),
  );
  const latestWeight = visibleWeights[0] ?? null;
  const previousWeight = visibleWeights[1] ?? null;

  return {
    todayHasWorkout: visibleWorkouts.some((record) => record.date === today),
    recentWorkouts: visibleWorkouts.slice(0, 3),
    weeklyWorkoutCount: weeklyWorkouts.length,
    weeklyStrengthSetSummaries: getWeeklyStrengthSetSummaries(
      weeklyWorkouts.filter(isFitnessSummaryProjectionV2),
    ),
    latestWeightKg: latestWeight?.weightKg ?? null,
    previousWeightKg: previousWeight?.weightKg ?? null,
    weightDeltaKg:
      latestWeight && previousWeight
        ? latestWeight.weightKg - previousWeight.weightKg
        : null,
    latestMeal: null,
    latestNutritionSummary,
    todayHasMeal: nutritionSummaries.some((record) => record.date === today),
    connection: getConnectionSummary(visibleWorkouts),
  };
}
