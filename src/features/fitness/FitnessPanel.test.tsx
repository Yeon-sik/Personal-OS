import { act, create, type ReactTestInstance, type ReactTestRenderer } from "react-test-renderer";
import { afterEach, describe, expect, it } from "vitest";
import type { WeightRecord } from "../../types";
import type { SyncStatus } from "../../lib/sync/syncTypes";
import type { FitnessNutritionSummaryV1 } from "../fitness-summary/fitnessNutritionContract";
import { FitnessPanel } from "./FitnessPanel";

const syncStatus: SyncStatus = {
  mode: "synced",
  label: "동기화 완료",
  detail: "",
  isOnline: true,
  lastSyncedAt: "2026-10-03T00:00:00.000Z",
  isConfigured: true,
};

const nutritionSummary: FitnessNutritionSummaryV1 = {
  id: "2026-06-09",
  date: "2026-06-09",
  contractVersion: 1,
  mealCount: 2,
  calories: 1200,
  carbsGrams: 100,
  proteinGrams: 80,
  fatGrams: 40,
  updatedAt: "2026-06-09T18:00:00.000Z",
};

const weightRecord: WeightRecord = {
  id: "fitness-weight-1",
  createdAt: "2026-06-09T07:00:00.000Z",
  date: "2026-06-09",
  weightKg: 70.5,
  isBackfilled: false,
  backfilledAt: null,
  backfillReason: null,
  updatedAt: "2026-06-09T07:00:00.000Z",
  deletedAt: null,
  deviceId: "fitness-device",
};

const renderers: ReactTestRenderer[] = [];

function textContent(instance: ReactTestInstance): string {
  return instance.children
    .map((child) => typeof child === "string" ? child : textContent(child))
    .join("");
}

afterEach(() => {
  for (const renderer of renderers.splice(0)) {
    act(() => renderer.unmount());
  }
});

describe("FitnessPanel", () => {
  it("shows recent Fitness weight and falls back to the latest nutrition summary", () => {
    let renderer!: ReactTestRenderer;
    act(() => {
      renderer = create(
        <FitnessPanel
          fitnessSummaryProjections={[]}
          fitnessSharedWorkoutRecords={[]}
          nutritionSummaries={[nutritionSummary]}
          fitnessWeightRecords={[weightRecord]}
          syncStatus={syncStatus}
          selectedDate="2026-10-03"
        />,
      );
    });
    renderers.push(renderer);
    const renderedText = textContent(renderer.root);

    expect(renderedText).toContain("최근 체중 기록");
    expect(renderedText).toContain("70.5 kg");
    expect(renderedText).toContain("2026-06-09 식단 요약");
    expect(renderedText).toContain("가장 최근 기록을 표시합니다.");
  });

  it("does not present cached Fitness weight as current before a successful sync", () => {
    let renderer!: ReactTestRenderer;
    act(() => {
      renderer = create(
        <FitnessPanel
          fitnessSummaryProjections={[]}
          fitnessSharedWorkoutRecords={[]}
          nutritionSummaries={[]}
          fitnessWeightRecords={[weightRecord]}
          syncStatus={{ ...syncStatus, mode: "offline" }}
          selectedDate="2026-10-03"
        />,
      );
    });
    renderers.push(renderer);
    const renderedText = textContent(renderer.root);

    expect(renderedText).toContain("동기화가 완료되면 Fitness 체중 기록을 표시합니다.");
    expect(renderedText).not.toContain("70.5 kg");
  });
});
