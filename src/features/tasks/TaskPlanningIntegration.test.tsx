import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { describe, expect, it, vi } from "vitest";
import { emptySnapshot, task } from "../home/testFixtures";
import { ScheduleTimeline } from "../records/ScheduleTimeline";
import { HomePanel } from "../home/HomePanel";
import { timelineLayout, type TimelineEntry } from "../records/scheduleTimelineModel";

describe("task planning presentation integration", () => {
  it("renders a one-hour event as one hour of the desktop day grid", () => {
    const event = task({ text: "시간표 검증", kind: "EVENT", plannedDate: null, dueDate: null, eventStartDate: "2026-11-07", eventEndDate: "2026-11-07", eventStartTime: "09:00", eventEndTime: "10:00", timeZone: "Asia/Seoul" });
    let renderer!: ReactTestRenderer;
    act(() => { renderer = create(<ScheduleTimeline tasks={[event]} view="day" selectedDate="2026-11-07" onSelectDate={vi.fn()} onOpenTask={vi.fn()} />); });
    const block = renderer.root.findAllByType("button").find(button => button.props.style?.height);
    expect(block?.props.style.top).toBe("37.5%");
    expect(parseFloat(block?.props.style.height)).toBeCloseTo(100 / 24);
    expect(block?.props.style.width).toBe("100%");
    act(() => renderer.unmount());
  });
  it("counts actual Seoul completion dates independently of plan dates and legacy done flags", () => {
    const snapshot = emptySnapshot();
    snapshot.tasks = [
      task({ id: "old-plan", plannedDate: "2026-10-01", isDone: true, completedAt: "2026-10-01T15:30:00Z" }),
      task({ id: "old-completion", plannedDate: "2026-10-02", isDone: true, completedAt: "2026-10-01T14:30:00Z" }),
      task({ id: "legacy", plannedDate: "2026-10-02", isDone: true }),
      task({ id: "skip", plannedDate: "2026-10-02", isDone: false, skippedAt: "2026-10-02T00:30:00Z" }),
      task({ id: "tombstone", isDone: true, completedAt: "2026-10-02T00:30:00Z", deletedAt: "2026-10-02T00:35:00Z" }),
    ];
    let renderer!: ReactTestRenderer;
    act(() => { renderer = create(<HomePanel snapshot={snapshot} today="2026-10-02" syncStatus={{ mode: "local-only", label: "", detail: "", isOnline: false, lastSyncedAt: null, isConfigured: false }} onOpenRecords={vi.fn()} onOpenProjects={vi.fn()} onQuickCapture={vi.fn()} />); });
    expect(renderer.root.findAllByType("div").filter(entry => entry.props.className?.includes("text-sm font-semibold tabular-nums text-white")).map(entry => entry.children.join(""))).toEqual(["0개", "1개", "기록 없음", "0개"]);
    act(() => renderer.unmount());
  });
  it("uses consistent lanes for chain overlaps and visible point markers", () => {
    const entry = (id: string, start: number, end: number | null): TimelineEntry => ({ task: task({ id }), roles: ["EVENT"], startMinute: start, endMinute: end, conflictIds: [] });
    const placed = timelineLayout([entry("a", 600, 660), entry("b", 630, 720), entry("c", 670, 730), entry("d", 800, null), entry("e", 800, null)]);
    expect(placed.map(p => [p.entry.task.id, p.lane, p.lanes])).toEqual([["a", 0, 2], ["b", 1, 2], ["c", 0, 2], ["d", 0, 2], ["e", 1, 2]]);
    expect(placed[3].visualEnd).toBe(855);
    expect(placed.every(p => p.entry.conflictIds.length === 0)).toBe(true);
  });
});
