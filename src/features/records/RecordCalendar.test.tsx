import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { afterEach, describe, expect, it, vi } from "vitest";
import { WindowsDesktopContext } from "../../app/WindowsDesktopContext";
import { MobileLayoutContext } from "../../app/MobileLayoutContext";
import { RecordCalendar } from "./RecordCalendar";
import type { CalendarMarkers } from "./recordAggregation";

const selectedDate = "2026-10-02";
const markerByDate: CalendarMarkers = {
  [selectedDate]: {
    weights: true, meals: true, workouts: true, notes: true,
    tasks: { dueCount: 2, activeCount: 3, plannedCount: 2, completedPlannedCount: 2, allPlannedDone: true },
  },
  "2026-10-03": {
    weights: false, meals: false, workouts: false, notes: false,
    tasks: { dueCount: 0, activeCount: 3, plannedCount: 2, completedPlannedCount: 1, allPlannedDone: false },
  },
};
let renderer: ReactTestRenderer | undefined;
afterEach(() => { act(() => renderer?.unmount()); });

function renderCalendar(windows = true, mobile = false) {
  const onSelectDate = vi.fn();
  const onVisibleMonthChange = vi.fn();
  act(() => {
    renderer = create(<WindowsDesktopContext.Provider value={windows}><MobileLayoutContext.Provider value={mobile}><RecordCalendar
      selectedDate={selectedDate} visibleMonth={selectedDate} markerByDate={markerByDate} financeByDate={{}}
      onSelectDate={onSelectDate} onVisibleMonthChange={onVisibleMonthChange}
    /></MobileLayoutContext.Provider></WindowsDesktopContext.Provider>);
  });
  const days = renderer!.root.findAllByType("button").filter((button) => button.findAllByProps({ "data-calendar-stack": "true" }).length > 0);
  return { days, onSelectDate, onVisibleMonthChange };
}

describe("calendar stack identity", () => {
  it("preserves all six layers and exposes date, record types and selection on mobile", () => {
    const { days, onSelectDate } = renderCalendar(false, true);
    expect(days[1].props["aria-pressed"]).toBe(true);
    expect(days[1].props["aria-label"]).toContain("할 일 2개 마감");
    expect(days[1].findByProps({ "data-calendar-stack": "true" }).findAll((node) => typeof node.props["data-record-layer"] === "string").map((node) => node.props["data-record-layer"]))
      .toEqual(["weights", "meals", "workouts", "tasks", "planned-done", "notes"]);
    act(() => days[2].props.onClick());
    expect(onSelectDate).toHaveBeenCalledWith("2026-10-03");
    expect(renderer!.root.findAllByProps({ "aria-label": "달력 표시 범례" })).toHaveLength(1);
  });
  it("keeps six fixed record layers, their order and original colors on Windows", () => {
    const { days, onSelectDate } = renderCalendar();
    const day = days[1];
    const stack = day.findByProps({ "data-calendar-stack": "true" });
    const layers = stack.findAll((node) => typeof node.props["data-record-layer"] === "string");
    expect(layers.map((layer) => layer.props["data-record-layer"]))
      .toEqual(["weights", "meals", "workouts", "tasks", "planned-done", "notes"]);
    expect(layers.map((layer) => layer.props.title))
      .toEqual(["체중", "식단", "운동", "할 일 2개 마감", "오늘 할 일 2/2 완료", "메모"]);
    const expectedColors = ["bg-emerald-500", "bg-yellow-400", "bg-red-500", "bg-sky-400", "bg-[#FF00FF]", "bg-white"];
    layers.forEach((layer, index) => expect(layer.props.className).toContain(expectedColors[index]));
    expect(day.props["aria-pressed"]).toBe(true);
    expect(day.props["aria-label"]).toContain("할 일 2개 마감");
    act(() => day.props.onClick());
    expect(onSelectDate).toHaveBeenCalledWith(selectedDate);
  });

  it("preserves empty slots and distinguishes active tasks from completed planned tasks", () => {
    const { days } = renderCalendar();
    const emptyLayers = days[3].findByProps({ "data-calendar-stack": "true" })
      .findAll((node) => typeof node.props["data-record-layer"] === "string");
    expect(emptyLayers).toHaveLength(6);
    emptyLayers.forEach((layer) => {
      expect(layer.props.title).toBeUndefined();
      expect(layer.props.className).toContain("bg-transparent");
    });
    const activeDay = days[2];
    const taskLayer = activeDay.findByProps({ "data-record-layer": "tasks" });
    expect(taskLayer.props.title).toBe("진행 중인 할 일 3개");
    expect(taskLayer.findAllByType("span").some((node) => node.children.join("") === "x3")).toBe(true);
    expect(activeDay.findByProps({ "data-record-layer": "planned-done" }).props.className).toContain("bg-transparent");
  });

  it("retains the same six-layer presentation outside the Windows context", () => {
    const { days } = renderCalendar(false);
    expect(days).toHaveLength(31);
    expect(days[1].findByProps({ "data-calendar-stack": "true" }).findAll((node) => typeof node.props["data-record-layer"] === "string"))
      .toHaveLength(6);
    expect(days[1].props["aria-label"]).toBeUndefined();
  });
});
