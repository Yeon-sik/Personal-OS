import { describe, expect, it } from "vitest";
import { parseFitnessNutritionSummary } from "./fitnessNutritionContract";

const validSummary = {
  id: "2026-09-20",
  date: "2026-09-20",
  contractVersion: 1,
  mealCount: 2,
  calories: null,
  carbsGrams: 80,
  proteinGrams: 30,
  fatGrams: null,
  updatedAt: "2026-09-20T12:00:00.000Z",
};

describe("Fitness nutrition summary v1", () => {
  it("keeps unknown daily nutrients null and strips source meal details", () => {
    const summary = parseFitnessNutritionSummary({
      ...validSummary,
      mealId: "private-meal-id",
      menu: "private meal detail",
      items: [{ name: "private item" }],
    });

    expect(summary.calories).toBeNull();
    expect(summary.fatGrams).toBeNull();
    expect(summary).not.toHaveProperty("mealId");
    expect(summary).not.toHaveProperty("menu");
    expect(summary).not.toHaveProperty("items");
  });

  it.each([
    ["unsupported contract", { contractVersion: 2 }],
    ["impossible date", { date: "2026-02-30", id: "2026-02-30" }],
    ["negative metric", { proteinGrams: -1 }],
    ["non-finite metric", { calories: Number.NaN }],
  ])("rejects %s", (_label, override) => {
    expect(() => parseFitnessNutritionSummary({ ...validSummary, ...override })).toThrow();
  });
});
