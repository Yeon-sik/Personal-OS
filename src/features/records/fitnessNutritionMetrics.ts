import type { FitnessNutritionSummaryV1 } from "../fitness-summary/fitnessNutritionContract";
import type { DateRange } from "./recordAggregation";

export interface FitnessNutritionMetrics {
  averageDailyCalories: number | null;
  averageDailyProteinGrams: number | null;
  daysWithCalories: number;
  daysWithProtein: number;
  summaryDays: number;
  totalMealCount: number;
}

export function getFitnessNutritionMetrics(
  summaries: FitnessNutritionSummaryV1[],
  range: DateRange,
): FitnessNutritionMetrics {
  const ranged = summaries.filter(
    (summary) => summary.date >= range.startDate && summary.date <= range.endDate,
  );
  const knownCalories = ranged.flatMap((summary) =>
    summary.calories === null ? [] : [summary.calories],
  );
  const knownProtein = ranged.flatMap((summary) =>
    summary.proteinGrams === null ? [] : [summary.proteinGrams],
  );

  return {
    averageDailyCalories: knownCalories.length
      ? knownCalories.reduce((total, value) => total + value, 0) / knownCalories.length
      : null,
    averageDailyProteinGrams: knownProtein.length
      ? knownProtein.reduce((total, value) => total + value, 0) / knownProtein.length
      : null,
    daysWithCalories: knownCalories.length,
    daysWithProtein: knownProtein.length,
    summaryDays: ranged.length,
    totalMealCount: ranged.reduce((total, summary) => total + summary.mealCount, 0),
  };
}
