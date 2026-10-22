import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { describe, expect, it, vi } from "vitest";
import { WindowsDesktopContext } from "../../app/WindowsDesktopContext";
import { HomePanel } from "./HomePanel";
import { emptySnapshot, task } from "./testFixtures";

describe("Windows home workflow", () => {
  it("preserves calendar, tasks, projects, capture and fitness entry points", () => {
    const records = vi.fn();
    const projects = vi.fn();
    const capture = vi.fn();
    const snapshot = emptySnapshot();
    snapshot.tasks = [task({ text: "오늘의 첫 작업" })];
    let renderer!: ReactTestRenderer;
    act(() => { renderer = create(<WindowsDesktopContext.Provider value><HomePanel snapshot={snapshot} today="2026-10-02" syncStatus={{ mode: "local-only", label: "", detail: "", isOnline: false, isConfigured: false, lastSyncedAt: null }} onOpenRecords={records} onOpenProjects={projects} onQuickCapture={capture} /></WindowsDesktopContext.Provider>); });
    const actions = renderer.root.findByProps({ "aria-label": "빠른 이동과 행동" }).findAllByType("button");
    for (const action of actions) act(() => action.props.onClick());
    expect(records).toHaveBeenCalledWith("all", "2026-10-02");
    expect(records).toHaveBeenCalledWith("tasks");
    expect(projects).toHaveBeenCalledOnce();
    expect(capture).toHaveBeenCalledOnce();
    const health = renderer.root.findAllByType("button").find((button) => button.findAllByType("strong").some((strong) => strong.children.join("").startsWith("건강 ·")));
    act(() => health!.props.onClick());
    expect(records).toHaveBeenCalledWith("fitness", "2026-10-02");
    expect(renderer.root.findByType("ul").findByType("li").findAllByType("span")[1].children).toContain("오늘의 첫 작업");
    const days = renderer.root.findAllByType("button").filter((button) => button.props["data-activity-date"]);
    expect(days.filter((day) => day.props.tabIndex === 0)).toHaveLength(1);
    expect(days.filter((day) => day.props.tabIndex === 0)[0].props["data-activity-date"]).toBe("2026-10-02");
    act(() => days[days.length - 1].props.onKeyDown({ key: "ArrowLeft", preventDefault: vi.fn() }));
    expect(renderer.root.findAllByType("button").find((button) => button.props["data-activity-date"] && button.props.tabIndex === 0)!.props["data-activity-date"]).toBe("2026-09-25");
    act(() => renderer.unmount());
  });
});
