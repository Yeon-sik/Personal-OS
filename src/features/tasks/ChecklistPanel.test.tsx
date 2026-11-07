import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { describe, expect, it, vi } from "vitest";
import { ChecklistPanel } from "./ChecklistPanel";
import { ChecklistTaskRow } from "./components/ChecklistTaskRow";
import { task } from "../home/testFixtures";

describe("ChecklistPanel planning views", () => {
  it("combines filters, groups actual completions and keeps completion cancellation wired", () => {
    const toggle = vi.fn();
    let renderer!: ReactTestRenderer;
    act(() => { renderer = create(<ChecklistPanel tasks={[
      task({ id: "open", text: "자료 찾기", category: "학교" }),
      task({ id: "completed", text: "과제 제출", category: "학교", isDone: true, completedAt: "2026-11-06T16:00:00Z", plannedDate: "2026-10-01" }),
      task({ id: "old", text: "예전 완료", isDone: true }),
    ]} onAdd={vi.fn()} onDelete={vi.fn()} onReorder={vi.fn()} onToggle={toggle} onUpdatePlannedDate={vi.fn()} onUpdateSchedule={vi.fn()} onUpdateText={vi.fn()} />); });
    expect(renderer.root.findAllByType(ChecklistTaskRow).map(row => row.props.task.id)).toEqual(["open"]);
    act(() => renderer.root.findByProps({ "aria-label": "할 일 상태 필터" }).props.onChange({ target: { value: "completed" } }));
    expect(JSON.stringify(renderer.toJSON())).toContain("2026-11-07");
    expect(JSON.stringify(renderer.toJSON())).toContain("완료 날짜 미상");
    act(() => renderer.root.findByProps({ "aria-label": "할 일 검색" }).props.onChange({ target: { value: "과제" } }));
    act(() => renderer.root.findByProps({ "aria-label": "할 일 분류 필터" }).props.onChange({ target: { value: "학교" } }));
    const row = renderer.root.findByType(ChecklistTaskRow);
    expect(row.props.task.id).toBe("completed");
    act(() => row.findByProps({ "aria-label": "완료 여부" }).props.onChange());
    expect(toggle).toHaveBeenCalledWith("completed");
    act(() => renderer.unmount());
  });
});
