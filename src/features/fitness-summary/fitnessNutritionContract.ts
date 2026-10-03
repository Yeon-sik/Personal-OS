/** Fitness-owned, daily read model. Never contains meal IDs, menus or items. */
export interface FitnessNutritionSummaryV1 {
  id: string;
  date: string;
  contractVersion: 1;
  mealCount: number;
  calories: number | null;
  carbsGrams: number | null;
  proteinGrams: number | null;
  fatGrams: number | null;
  updatedAt: string;
}

function metric(value: unknown): value is number | null {
  return value === null || (typeof value === "number" && Number.isFinite(value) && value >= 0);
}

/** Reject incompatible/invalid data and strip unexpected source-record fields. */
export function parseFitnessNutritionSummary(value: unknown): FitnessNutritionSummaryV1 {
  if (!value || typeof value !== "object") throw new Error("식단 요약 계약이 올바르지 않습니다.");
  const row = value as Record<string, unknown>;
  if (row.contractVersion !== 1 || typeof row.id !== "string" ||
      typeof row.date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(row.date) ||
      row.id !== row.date || new Date(`${row.date}T00:00:00Z`).toISOString().slice(0, 10) !== row.date ||
      typeof row.updatedAt !== "string" || !Number.isFinite(Date.parse(row.updatedAt)) ||
      typeof row.mealCount !== "number" || !Number.isSafeInteger(row.mealCount) || row.mealCount < 1 ||
      !metric(row.calories) || !metric(row.carbsGrams) || !metric(row.proteinGrams) || !metric(row.fatGrams)) {
    throw new Error("지원하지 않거나 잘못된 Fitness 식단 요약입니다.");
  }
  return {
    id: row.id, date: row.date, contractVersion: 1, mealCount: row.mealCount,
    calories: row.calories, carbsGrams: row.carbsGrams,
    proteinGrams: row.proteinGrams, fatGrams: row.fatGrams, updatedAt: row.updatedAt,
  };
}

export function fitnessNutritionSummaryFromRow(value: unknown): FitnessNutritionSummaryV1 {
  const row = value as Record<string, unknown>;
  return parseFitnessNutritionSummary({
    id: row?.id, date: row?.date, contractVersion: row?.contract_version,
    mealCount: row?.meal_count, calories: row?.calories, carbsGrams: row?.carbs_grams,
    proteinGrams: row?.protein_grams, fatGrams: row?.fat_grams, updatedAt: row?.updated_at,
  });
}
