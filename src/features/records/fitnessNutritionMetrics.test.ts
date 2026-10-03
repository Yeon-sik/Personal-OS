import { describe, expect, it } from "vitest";
import { getFitnessNutritionMetrics } from "./fitnessNutritionMetrics";

const summaries = [
  {
    id: "2026-09-01", date: "2026-09-01", contractVersion: 1 as const,
    mealCount: 3, calories: 1800, carbsGrams: 200, proteinGrams: 90,
    fatGrams: null, updatedAt: "2026-09-01T23:00:00Z",
  },
  {
    id: "2026-09-02", date: "2026-09-02", contractVersion: 1 as const,
    mealCount: 1, calories: null, carbsGrams: null, proteinGrams: null,
    fatGrams: null, updatedAt: "2026-09-02T23:00:00Z",
  },
];

describe("Fitness daily nutrition metrics", () => {
  it("labels daily sums separately and excludes unknown nutrients from averages", () => {
    expect(getFitnessNutritionMetrics(summaries, {
      startDate: "2026-09-01", endDate: "2026-09-30",
    })).toEqual({
      averageDailyCalories: 1800,
      averageDailyProteinGrams: 90,
      daysWithCalories: 1,
      daysWithProtein: 1,
      summaryDays: 2,
      totalMealCount: 4,
    });
  });
});
