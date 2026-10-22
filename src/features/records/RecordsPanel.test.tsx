import { act, create, type ReactTestInstance, type ReactTestRenderer } from "react-test-renderer";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { LocalDataSnapshot, Task } from "../../types";
import type { FitnessNutritionSummaryV1 } from "../fitness-summary/fitnessNutritionContract";
import type { SyncStatus } from "../../lib/sync/syncTypes";
import { QuickActionOverlay } from "../command-center/quickActions/QuickActionOverlay";
import { RecordCalendar } from "./RecordCalendar";
import { RecordsPanel } from "./RecordsPanel";
import { SelectedDateRecords } from "./components/SelectedDateRecords";
import { RecordsOverview } from "./components/RecordsOverview";
import { WindowsDesktopContext } from "../../app/WindowsDesktopContext";
import { MobileLayoutContext } from "../../app/MobileLayoutContext";

// The overlay's document focus trap is covered by its own tests; here we verify
// that calendar/date actions still open it with the existing write callbacks.
vi.mock("../command-center/quickActions/QuickActionOverlay", () => ({
  QuickActionOverlay: () => null,
}));

const today = "2026-10-02";
const task: Task = {
  id: "task-today",
  text: "프로젝트 계획 확인",
  isDone: true,
  orderIndex: 0,
  dueDate: today,
  dueTime: null,
  plannedDate: today,
  createdAt: "2026-10-02T03:00:00.000Z",
  updatedAt: "2026-10-02T03:00:00.000Z",
  deletedAt: null,
  deviceId: "device-a",
  isBackfilled: false,
  backfilledAt: null,
  backfillReason: null,
};

const snapshot: LocalDataSnapshot = {
  notes: [],
  tasks: [task],
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
};

const syncStatus: SyncStatus = {
  mode: "local-only",
  label: "로컬 저장",
  detail: "",
  isOnline: false,
  lastSyncedAt: null,
  isConfigured: false,
};

const fitnessNutritionSummary: FitnessNutritionSummaryV1 = {
  id: today,
  date: today,
  contractVersion: 1,
  mealCount: 2,
  calories: 1200,
  carbsGrams: 100,
  proteinGrams: 80,
  fatGrams: 40,
  updatedAt: "2026-10-02T18:00:00.000Z",
};

const renderers: ReactTestRenderer[] = [];

function renderPanel(selectedDate = today, snapshotOverride: LocalDataSnapshot = snapshot, windows = false, mobile = false) {
  const selectedTarget = { scrollIntoView: vi.fn(), focus: vi.fn() };
  const callbacks = {
    loadFinanceDailySummaries: vi.fn(async () => []),
    onAddNoteForDate: vi.fn(),
    onAddTask: vi.fn(),
    onDeleteNote: vi.fn(),
    onDeleteTask: vi.fn(),
    onSelectDate: vi.fn(),
    onToggleTask: vi.fn(),
  };
  let renderer!: ReactTestRenderer;
  act(() => {
    renderer = create(
      <WindowsDesktopContext.Provider value={windows}><MobileLayoutContext.Provider value={mobile}><RecordsPanel
        selectedDate={selectedDate}
        snapshot={snapshotOverride}
        syncStatus={syncStatus}
        financeEnabled={false}
        {...callbacks}
      /></MobileLayoutContext.Provider></WindowsDesktopContext.Provider>,
      { createNodeMock: (element) => element.props["aria-label"] === "선택 날짜 기록" ? selectedTarget : null },
    );
  });
  renderers.push(renderer);
  return { renderer, callbacks, selectedTarget };
}

function textContent(instance: ReactTestInstance): string {
  return instance.children
    .map((child) => typeof child === "string" ? child : textContent(child))
    .join("");
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date(2026, 9, 2, 12));
  vi.stubGlobal("window", {
    confirm: vi.fn(() => true),
    setTimeout,
  });
});

afterEach(() => {
  for (const renderer of renderers.splice(0)) {
    act(() => renderer.unmount());
  }
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("RecordsPanel calendar-first record hub", () => {
  it("connects mobile date selection to its records without automatic focus or duplicate legends", () => {
    const { renderer, callbacks, selectedTarget } = renderPanel(today, snapshot, false, true);
    expect(renderer.root.findAllByProps({ "aria-label": "달력 표시 범례" })).toHaveLength(1);
    act(() => renderer.root.findByType(RecordCalendar).props.onSelectDate("2026-10-03"));
    expect(callbacks.onSelectDate).toHaveBeenCalledWith("2026-10-03");
    expect(selectedTarget.focus).not.toHaveBeenCalled();
    const jump = renderer.root.findAllByType("button").find((node) => node.children.join("") === "기록 보기")!;
    act(() => jump.props.onClick());
    expect(selectedTarget.scrollIntoView).toHaveBeenCalledWith({ block: "start" });
    expect(selectedTarget.focus).toHaveBeenCalledWith({ preventScroll: true });
    act(() => renderer.root.findByProps({ "aria-label": `${task.text} 완료 전환` }).props.onChange());
    expect(callbacks.onToggleTask).toHaveBeenCalledWith(task.id);
    const overview = renderer.root.findByType(RecordsOverview);
    const picker = overview.findAllByType("select").find((node) => node.findAllByType("option").some((option) => textContent(option).includes("완료 1/1")))!;
    const option = picker.findAllByType("option").find((node) => textContent(node).includes("완료 1/1"))!;
    act(() => picker.props.onChange({ target: { value: String(option.props.value) } }));
    expect(textContent(overview)).toContain(task.text);
  });
  it("connects the Windows calendar to selected records without moving focus on date selection", () => {
    const { renderer, callbacks, selectedTarget } = renderPanel(today, snapshot, true);
    expect(renderer.root.findAllByProps({ "aria-label": "달력 표시 범례" })).toHaveLength(1);
    const calendar = renderer.root.findByType(RecordCalendar);
    act(() => calendar.props.onSelectDate("2026-10-03"));
    expect(callbacks.onSelectDate).toHaveBeenCalledWith("2026-10-03");
    expect(selectedTarget.focus).not.toHaveBeenCalled();
    const jump = renderer.root.findAllByType("button").find((button) => button.children.join("") === "기록 보기")!;
    expect(jump.props["aria-controls"]).toBe(renderer.root.findByProps({ "aria-label": "선택 날짜 기록" }).props.id);
    act(() => jump.props.onClick());
    expect(selectedTarget.scrollIntoView).toHaveBeenCalledWith({ block: "start" });
    expect(selectedTarget.focus).toHaveBeenCalledWith({ preventScroll: true });
    act(() => renderer.root.findByProps({ "aria-label": "할 일 완료 전환" }).props.onChange());
    expect(callbacks.onToggleTask).toHaveBeenCalledWith(task.id);
  });

  it("keeps the existing stacked calendar first, date selection, and task completion", () => {
    const { renderer, callbacks } = renderPanel();
    const section = renderer.root.findByType("section");
    expect(section.children[0]).toBe(renderer.root.findByType(RecordCalendar));
    const calendar = renderer.root.findByType(RecordCalendar);
    expect(calendar.props.markerByDate[today].tasks.allPlannedDone).toBe(true);

    act(() => calendar.props.onSelectDate("2026-10-03"));
    expect(callbacks.onSelectDate).toHaveBeenCalledWith("2026-10-03");

    act(() => {
      renderer.root.findByProps({ "aria-label": "할 일 완료 전환" }).props.onChange();
    });
    expect(callbacks.onToggleTask).toHaveBeenCalledWith(task.id);
    expect(callbacks.loadFinanceDailySummaries).not.toHaveBeenCalled();
  });

  it("opens the existing Quick Action with the selected day and write callbacks", () => {
    const { renderer, callbacks } = renderPanel();
    const source = { focus: vi.fn() } as unknown as HTMLElement;
    act(() => {
      renderer.root.findByType(SelectedDateRecords).props.onOpenQuickAction(today, source);
    });
    const overlay = renderer.root.findByType(QuickActionOverlay);
    expect(overlay.props.selectedDate).toBe(today);
    expect(overlay.props.isBackfill).toBe(false);
    expect(overlay.props.onAddNote).toBe(callbacks.onAddNoteForDate);
    expect(overlay.props.onAddTask).toBe(callbacks.onAddTask);

    act(() => overlay.props.onClose());
    expect(renderer.root.findAllByType(QuickActionOverlay)).toHaveLength(0);
    act(() => { vi.runOnlyPendingTimers(); });
    expect(source.focus).toHaveBeenCalledTimes(1);
  });

  it("shows the Fitness daily nutrition summary in selected-date records", () => {
    const { renderer } = renderPanel(today, {
      ...snapshot,
      fitnessNutritionSummaries: [fitnessNutritionSummary],
    });
    expect(renderer.root.findByType(SelectedDateRecords).props.records.fitnessNutritionSummary)
      .toEqual(fitnessNutritionSummary);
    const rendered = textContent(renderer.root.findByType(SelectedDateRecords));

    expect(rendered).toContain("Fitness 식단 2회 요약");
    expect(rendered).toContain("1,200 kcal");
    expect(rendered).toContain("개별 메뉴와 원본 식사 정보는 Fitness App에서 확인하세요.");
  });

  it("retains the past-date confirmation and backfill mode", () => {
    const { renderer } = renderPanel("2026-10-01");
    const source = { focus: vi.fn() } as unknown as HTMLElement;
    const selected = renderer.root.findByType(SelectedDateRecords);
    vi.mocked(window.confirm).mockReturnValueOnce(false);
    act(() => selected.props.onOpenBackfillAction(source));
    expect(renderer.root.findAllByType(QuickActionOverlay)).toHaveLength(0);

    act(() => selected.props.onOpenBackfillAction(source));
    expect(window.confirm).toHaveBeenCalledTimes(2);
    expect(renderer.root.findByType(QuickActionOverlay).props.isBackfill).toBe(true);
    expect(renderer.root.findByType(QuickActionOverlay).props.selectedDate).toBe("2026-10-01");
  });

  it("puts collapsed month charts after date records and preserves point details", () => {
    const { renderer } = renderPanel();
    const overview = renderer.root.findByType(RecordsOverview);
    const details = overview.findByType("details");
    expect(details.props.open).toBeUndefined();
    expect(overview.findByType("summary").findAllByType("span")[0].children).toEqual(["월간 흐름"]);
    expect(JSON.stringify(renderer.toJSON())).not.toContain("오늘의 지휘판");

    const section = renderer.root.findByType("section");
    const dateRecords = renderer.root.findByType(SelectedDateRecords);
    expect(section.children.indexOf(overview)).toBeGreaterThan(section.children.indexOf(dateRecords));
    const taskPoint = overview.findAllByType("button").find(
      (button) => String(button.props["aria-label"]).includes("완료 1/1"),
    );
    expect(taskPoint).toBeDefined();
    expect(overview.findAllByType("p").some(
      (paragraph) => paragraph.children.join("").includes(task.text),
    )).toBe(false);
    act(() => taskPoint?.props.onFocus());
    expect(overview.findAllByType("p").some(
      (paragraph) => paragraph.children.join("").includes(task.text),
    )).toBe(true);
  });
});
