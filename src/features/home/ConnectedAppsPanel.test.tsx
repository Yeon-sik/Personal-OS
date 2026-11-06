import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ConnectedAppsPanel, type ConnectedAppsPanelProps } from "./ConnectedAppsPanel";
import { emptySnapshot, entity, projection } from "./testFixtures";

let renderer: ReactTestRenderer | undefined;
beforeEach(() => {
  vi.useFakeTimers();
  vi.stubGlobal("window", { setInterval, clearInterval, addEventListener: vi.fn(), removeEventListener: vi.fn() });
  vi.stubGlobal("document", { visibilityState: "visible", addEventListener: vi.fn(), removeEventListener: vi.fn() });
});
afterEach(() => { act(() => renderer?.unmount()); renderer = undefined; vi.unstubAllGlobals(); vi.useRealTimers(); });
function props(): ConnectedAppsPanelProps {
  return {
    snapshot: emptySnapshot(), enabled: true, scopeKey: "account-a", today: "2026-11-06",
    syncStatus: { mode: "synced", label: "", detail: "", isOnline: true, lastSyncedAt: null, isConfigured: true,
      fitnessReadModels: { workout: { state: "empty", detail: "" }, nutrition: { state: "empty", detail: "" }, weight: { state: "empty", detail: "" } } },
    loadFinanceDailySummaries: vi.fn(async () => []), onOpenRecords: vi.fn(), onOpenSettings: vi.fn(), onSync: vi.fn(async () => {}), isSyncing: false,
  };
}
async function render(value: ConnectedAppsPanelProps) { await act(async () => { renderer = create(<ConnectedAppsPanel {...value} />); }); }
const text = () => JSON.stringify(renderer!.toJSON());

describe("connected app summaries", () => {
  it("totals only this month's received rows through today and opens the source screen", async () => {
    const value = props();
    value.loadFinanceDailySummaries = vi.fn(async () => [
      { date: "2026-11-01", incomeKrw: 1000, expenseKrw: 200, netKrw: 800, entryCount: 2 },
      { date: "2026-11-06", incomeKrw: 0, expenseKrw: 100, netKrw: -100, entryCount: 1 },
      { date: "2026-11-20", incomeKrw: 9999, expenseKrw: 0, netKrw: 9999, entryCount: 1 },
    ]);
    await render(value);
    expect(value.loadFinanceDailySummaries).toHaveBeenCalledWith("2026-11-01", "2026-11-30");
    expect(text()).toContain("1,000원"); expect(text()).toContain("300원"); expect(text()).toContain("700원"); expect(text()).not.toContain("9,999원");
    act(() => renderer!.root.findAllByType("button").find(button => button.children.join("") === "날짜별 현금 흐름 보기")!.props.onClick());
    expect(value.onOpenRecords).toHaveBeenCalledWith("all", "2026-11-06");
  });

  it("uses shared Fitness summaries, preserves unknown nutrition and ignores legacy archived weights", async () => {
    const value = props();
    value.snapshot.fitnessSummaryProjections = [projection({ date: "2026-11-06" })];
    value.snapshot.weightRecords = [{ ...entity, date: "2026-11-06", weightKg: 999, sourceApp: "fitness", scope: "both", contractVersion: 1 }];
    value.snapshot.fitnessWeightRecords = [];
    value.snapshot.fitnessNutritionSummaries = [{ id: "2026-11-06", date: "2026-11-06", contractVersion: 1, mealCount: 1, calories: null, proteinGrams: 20, carbsGrams: null, fatGrams: null, updatedAt: entity.updatedAt }];
    await render(value);
    expect(text()).toContain("최근 7일 공유된 완료 운동 1회");
    expect(text()).toContain("미확인 kcal"); expect(text()).not.toContain("999 kg");
  });

  it("distinguishes failures, empty successful reads, cached offline state and signed-out state", async () => {
    const value = props();
    value.snapshot.fitnessNutritionSummaries = [{ id: "2026-11-06", date: "2026-11-06", contractVersion: 1, mealCount: 1, calories: null, proteinGrams: null, carbsGrams: null, fatGrams: null, updatedAt: entity.updatedAt }];
    value.syncStatus.fitnessReadModels!.nutrition = { state: "error", detail: "private diagnostics" };
    await render(value);
    expect(text()).toContain("조회 실패 · 저장된 요약");
    expect(text()).toContain("조회 완료 · 이번 달 확정 내역 없음");
    expect(text()).not.toContain("private diagnostics");
    await act(async () => renderer!.update(<ConnectedAppsPanel {...value} syncStatus={{ ...value.syncStatus, isOnline: false, mode: "offline" }} />));
    expect(text()).toContain("오프라인 · 저장된 요약");
    await act(async () => renderer!.update(<ConnectedAppsPanel {...value} enabled={false} />));
    expect(text()).toContain("로그인 필요"); expect(text()).not.toContain("마지막 조회");
  });
  it("does not treat unread empty facade arrays as a received cache", async () => {
    const value = props();
    value.syncStatus.fitnessReadModels = undefined;
    value.syncStatus.mode = "syncing";
    value.snapshot.fitnessSharedWorkoutRecords = [];
    value.snapshot.fitnessWeightRecords = [];
    await render(value);
    expect(text()).toContain("조회 대기");
    expect(text()).not.toContain("저장된 요약");
    expect(text()).not.toContain("공유된 체중 없음");
  });
});
