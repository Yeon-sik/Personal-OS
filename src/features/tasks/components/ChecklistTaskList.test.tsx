import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { describe, expect, it, vi } from "vitest";
import { WindowsDesktopContext } from "../../../app/WindowsDesktopContext";
import { task } from "../../home/testFixtures";
import { ChecklistTaskList } from "./ChecklistTaskList";
import type { Task } from "../../../types";

const first = task({ id: "a", text: "첫 항목" });
const second = task({ id: "b", text: "둘째 항목" });
function list(items: Task[], onReorder = vi.fn(), windows = true) {
  return <WindowsDesktopContext.Provider value={windows}><ChecklistTaskList
    items={items} today="2026-10-02" emptyText="" dragOverPlacement="before" dragOverTaskId={null} draggedTaskId={null}
    onReorder={onReorder} onPointerDown={vi.fn()} onDelete={vi.fn()} onToggle={vi.fn()}
    onUpdatePlannedDate={vi.fn()} onUpdateSchedule={vi.fn()} onUpdateText={vi.fn()}
  /></WindowsDesktopContext.Provider>;
}

describe("Windows keyboard task ordering", () => {
  it("uses the existing reorder callback and does not move past a list boundary", () => {
    const reorder = vi.fn();
    let renderer!: ReactTestRenderer;
    act(() => { renderer = create(<WindowsDesktopContext.Provider value><ChecklistTaskList items={[task({ id: "a", text: "첫 항목" }), task({ id: "b", text: "둘째 항목" })]} today="2026-10-02" emptyText="" dragOverPlacement="before" dragOverTaskId={null} draggedTaskId={null} onReorder={reorder} onPointerDown={vi.fn()} onDelete={vi.fn()} onToggle={vi.fn()} onUpdatePlannedDate={vi.fn()} onUpdateSchedule={vi.fn()} onUpdateText={vi.fn()} /></WindowsDesktopContext.Provider>); });
    const handle = renderer.root.findByProps({ "aria-label": "첫 항목 순서 변경 (위·아래 방향키)" });
    act(() => handle.props.onKeyDown({ key: "ArrowUp", preventDefault: vi.fn() }));
    expect(reorder).not.toHaveBeenCalled();
    act(() => handle.props.onKeyDown({ key: "ArrowDown", preventDefault: vi.fn() }));
    expect(reorder).toHaveBeenCalledWith("a", "b", "after");
    act(() => renderer.unmount());
  });

  it("offers click-only moves, announces position, and keeps focus on the moved row at a boundary", () => {
    const reorder = vi.fn();
    const handleFocus = vi.fn();
    const trigger = { isConnected: true, disabled: false, focus: vi.fn(), closest: () => ({ querySelector: () => ({ focus: handleFocus }) }) };
    let renderer!: ReactTestRenderer;
    act(() => { renderer = create(list([first, second], reorder)); });
    const control = (label: string) => renderer.root.findByProps({ "aria-label": label });
    expect(control("첫 항목 위로 이동").props.disabled).toBe(true);
    expect(control("둘째 항목 아래로 이동").props.disabled).toBe(true);
    act(() => control("첫 항목 아래로 이동").props.onClick({ currentTarget: trigger }));
    expect(reorder).toHaveBeenCalledExactlyOnceWith("a", "b", "after");
    expect(renderer.root.findByProps({ role: "status" }).children.join("")).toContain("2개 중 2번째");

    // The existing action returns the new order; the clicked arrow is now disabled.
    trigger.disabled = true;
    act(() => renderer.update(list([second, first], reorder)));
    expect(control("첫 항목 아래로 이동").props.disabled).toBe(true);
    expect(handleFocus).toHaveBeenCalledOnce();
    expect(control("첫 항목 순서 변경 (위·아래 방향키)").props.onPointerDown).toBeTypeOf("function");
    act(() => renderer.unmount());
  });

  it("retains the compact editor's existing controls outside Windows", () => {
    let renderer!: ReactTestRenderer;
    act(() => { renderer = create(list([first, second], vi.fn(), false)); });
    expect(renderer.root.findAllByProps({ "aria-label": "첫 항목 위로 이동" })).toHaveLength(0);
    expect(renderer.root.findByProps({ "aria-label": "첫 항목 순서 변경" }).props.onKeyDown).toBeUndefined();
    expect(renderer.root.findByProps({ "aria-label": "첫 항목 마감일" }).props.value).toBe(first.dueDate ?? "");
    act(() => renderer.unmount());
  });
});
