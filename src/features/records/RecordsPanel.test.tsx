import { act, create, type ReactTestInstance, type ReactTestRenderer } from "react-test-renderer";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { LocalDataSnapshot, Task } from "../../types";
import type { FitnessNutritionSummaryV1 } from "../fitness-summary/fitnessNutritionContract";
import type { SyncStatus } from "../../lib/sync/syncTypes";
import type { CalendarMarkers } from "./recordAggregation";
import { QuickActionOverlay } from "../command-center/quickActions/QuickActionOverlay";
import { RecordCalendar } from "./RecordCalendar";
import { RecordsPanel } from "./RecordsPanel";
import { SelectedDateRecords } from "./components/SelectedDateRecords";
import { RecordsOverview } from "./components/RecordsOverview";

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

function renderPanel(selectedDate = today, snapshotOverride: LocalDataSnapshot = snapshot) {
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
      <RecordsPanel
        selectedDate={selectedDate}
        snapshot={snapshotOverride}
        syncStatus={syncStatus}
        financeEnabled={false}
        {...callbacks}
      />,
    );
  });
  renderers.push(renderer);
  return { renderer, callbacks };
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
  it("keeps the six-rail calendar, Plan markers, date selection, and task completion", () => {
    const { renderer, callbacks } = renderPanel();
    const section = renderer.root.findByType("section");
    expect(section.children[0]).toBe(renderer.root.findByType(RecordCalendar));
    const calendar = renderer.root.findByType(RecordCalendar);
    expect(calendar.props.markerByDate[today].tasks).toMatchObject({
      dueCount: 1,
      plannedCount: 1,
      completedPlannedCount: 1,
    });
    expect(textContent(calendar)).toContain("✓1/1");
    expect(textContent(calendar)).toContain("!1");

    act(() => calendar.props.onSelectDate("2026-10-03"));
    expect(callbacks.onSelectDate).toHaveBeenCalledWith("2026-10-03");

    act(() => {
      renderer.root.findByProps({ "aria-label": "할 일 완료 전환" }).props.onChange();
    });
    expect(callbacks.onToggleTask).toHaveBeenCalledWith(task.id);
    expect(callbacks.loadFinanceDailySummaries).not.toHaveBeenCalled();
  });

  it("renders Project and Training counts in the stack and notes outside it", () => {
    const markerByDate: CalendarMarkers = {
      [today]: {
        notes: true,
        tasks: {
          dueCount: 0,
          plannedCount: 0,
          completedPlannedCount: 0,
        },
        progressStack: {
          project: 2,
          training: 3,
          learning: 0,
          routine: 0,
          reservedOne: 0,
          reservedTwo: 0,
        },
      },
    };
    let renderer!: ReactTestRenderer;
    act(() => {
      renderer = create(
        <RecordCalendar
          markerByDate={markerByDate}
          financeByDate={{}}
          selectedDate={today}
          visibleMonth={today}
          onSelectDate={vi.fn()}
          onVisibleMonthChange={vi.fn()}
        />,
      );
    });
    renderers.push(renderer);

    const calendar = renderer.root.findByType(RecordCalendar);
    const selectedCell = calendar.findAllByType("button").find((button) =>
      String(button.props.className).includes("border-teal-600"),
    );
    expect(selectedCell).toBeDefined();

    const stack = selectedCell?.findByProps({
      className: "grid min-h-[42px] flex-1 w-full grid-rows-6 gap-0 overflow-hidden",
    });
    expect(stack?.children).toHaveLength(6);
    expect(textContent(stack!)).toBe("x2x3");
    expect(stack?.findByProps({ title: "프로젝트 2건" })).toBeDefined();
    expect(stack?.findByProps({ title: "운동 3건" })).toBeDefined();
    expect(selectedCell?.findByProps({ title: "메모 있음" })).toBeDefined();
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
