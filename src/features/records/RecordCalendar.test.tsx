import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { afterEach, describe, expect, it, vi } from "vitest";
import { RecordCalendar } from "./RecordCalendar";
import type { CalendarTaskMarker } from "./recordAggregation";

const renderers: ReactTestRenderer[] = [];
afterEach(() => { for (const renderer of renderers.splice(0)) act(() => renderer.unmount()); });

function renderCalendar(changes: Partial<CalendarTaskMarker>) {
  const onSelectDate = vi.fn();
  const tasks: CalendarTaskMarker = { dueCount: 0, activeCount: 0, plannedCount: 0, completedPlannedCount: 0, allPlannedDone: false, ...changes };
  let renderer!: ReactTestRenderer;
  act(() => { renderer = create(<RecordCalendar markerByDate={{ "2026-11-07": { tasks, notes: false, workouts: false, meals: false, weights: false } }} financeByDate={{}} selectedDate="2026-11-07" visibleMonth="2026-11-01" onSelectDate={onSelectDate} onVisibleMonthChange={vi.fn()} />); });
  renderers.push(renderer);
  const day = renderer.root.findAllByType("button").find(button => String(button.props["aria-label"]).startsWith("2026-11-07"))!;
  const badges = day.findAll(node => String(node.props.title).startsWith("일정 합계"));
  return { renderer, day, badges, onSelectDate };
}

describe("calendar schedule count badges", () => {
  it("counts confirmed and candidate schedules once, without adding deadline subtotals", () => {
    const { day, badges, onSelectDate } = renderCalendar({ confirmedCount: 2, candidateCount: 1, activeCount: 2, dueCount: 1 });
    expect(badges).toHaveLength(1);
    expect(badges[0].children).toEqual(["3"]);
    expect(badges[0].props.title).toBe("일정 합계 3개 · 확정 일정 2개 · 후보 1개 · 마감 1개");
    expect(day.props["aria-label"]).toBe("2026-11-07 · 일정 2개 · 후보 1개");
    act(() => day.props.onClick());
    expect(onSelectDate).toHaveBeenCalledWith("2026-11-07");
  });

  it("keeps exact large and candidate-only counts available when the visual badge is capped", () => {
    const { badges, day } = renderCalendar({ confirmedCount: 0, candidateCount: 123 });
    expect(badges[0].children).toEqual(["99+"]);
    expect(badges[0].props.title).toContain("일정 합계 123개");
    expect(day.props["aria-label"]).toContain("후보 123개");
  });

  it("omits zero badges and supports markers saved before confirmed counts existed", () => {
    expect(renderCalendar({}).badges).toHaveLength(0);
    const { badges, day } = renderCalendar({ activeCount: 4, dueCount: 2 });
    expect(badges[0].children).toEqual(["4"]);
    expect(day.props["aria-label"]).toContain("일정 4개");
  });
});
