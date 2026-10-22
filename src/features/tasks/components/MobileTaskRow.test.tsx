import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MobileLayoutContext } from "../../../app/MobileLayoutContext";
import { ChecklistTaskList } from "./ChecklistTaskList";
import { task } from "../../home/testFixtures";

let renderer: ReactTestRenderer | undefined;
afterEach(() => { act(() => renderer?.unmount()); });
describe("mobile task controls", () => {
  it("supports completion, schedule, planning, confirmed deletion and button ordering", () => {
    const items = [task({ id: "a", text: "첫 항목", dueDate: "2026-10-23", dueTime: "15:00" }), task({ id: "b", text: "둘째 항목" })];
    const actions = { onDelete: vi.fn(), onReorder: vi.fn(), onPointerDown: vi.fn(), onToggle: vi.fn(), onUpdateText: vi.fn(), onUpdateSchedule: vi.fn(), onUpdatePlannedDate: vi.fn() };
    act(() => { renderer = create(<MobileLayoutContext.Provider value><ChecklistTaskList items={items} today="2026-10-23" emptyText="" dragOverPlacement="before" dragOverTaskId={null} draggedTaskId={null} {...actions} /></MobileLayoutContext.Provider>); });
    const control = (label: string) => renderer!.root.findByProps({ "aria-label": label });
    expect(control("첫 항목 위로 이동").props.disabled).toBe(true);
    expect(control("둘째 항목 아래로 이동").props.disabled).toBe(true);
    act(() => control("첫 항목 아래로 이동").props.onClick({ currentTarget: { isConnected: false } }));
    expect(actions.onReorder).toHaveBeenCalledExactlyOnceWith("a", "b", "after");
    act(() => control("첫 항목 완료 여부").props.onChange());
    expect(actions.onToggle).toHaveBeenCalledWith("a");
    act(() => control("첫 항목 마감일").props.onChange({ target: { value: "" } }));
    expect(actions.onUpdateSchedule).toHaveBeenCalledWith("a", null, null);
    const row = renderer!.root.findByProps({ "data-task-row-id": "a" });
    act(() => row.findAllByType("button").find((node) => node.children.join("") === "오늘 할 일로 지정")!.props.onClick());
    expect(actions.onUpdatePlannedDate).toHaveBeenCalledWith("a", "2026-10-23");
    act(() => row.findByProps({ "aria-label": "할 일 삭제" }).props.onClick());
    expect(actions.onDelete).not.toHaveBeenCalled();
    act(() => row.findAllByType("button").find((node) => node.children.join("") === "삭제 확인")!.props.onClick());
    expect(actions.onDelete).toHaveBeenCalledWith("a");
    expect(control("첫 항목 드래그로 순서 변경").props.onPointerDown).toBeTypeOf("function");
  });
});
