import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { describe, expect, it, vi } from "vitest";
import { TaskDetailsEditor } from "./TaskDetailsEditor";
import { task } from "../../home/testFixtures";

describe("TaskDetailsEditor", () => {
  it("saves a description, category and completed checklist step without changing task completion", async () => {
    const save = vi.fn();
    let renderer!: ReactTestRenderer;
    act(() => { renderer = create(<TaskDetailsEditor task={task()} onSave={save} />); });
    act(() => renderer.root.findByType("textarea").props.onChange({ target: { value: "참고 https://example.com" } }));
    act(() => renderer.root.findAllByType("select")[0].props.onChange({ target: { value: "학교" } }));
    act(() => renderer.root.findByProps({ "aria-label": "새 하위 항목" }).props.onChange({ target: { value: "초안 작성" } }));
    act(() => renderer.root.findByProps({ "aria-label": "하위 항목 추가" }).props.onClick());
    act(() => renderer.root.findByProps({ "aria-label": "1번 하위 항목 완료" }).props.onChange({ target: { checked: true } }));
    await act(async () => renderer.root.findAllByType("button").find(button => button.children.includes("세부 내용 저장"))!.props.onClick());
    expect(save).toHaveBeenCalledWith("task-1", expect.objectContaining({ description: "참고 https://example.com", category: "학교", checklist: [{ id: expect.any(String), text: "초안 작성", isDone: true }], recurrence: null }));
    expect(save.mock.calls[0][1]).not.toHaveProperty("isDone");
    act(() => renderer.unmount());
  });

  it("requires a valid recurrence anchor and exposes save errors without losing the draft", async () => {
    const save = vi.fn().mockRejectedValue(new Error("저장 공간 부족"));
    let renderer!: ReactTestRenderer;
    act(() => { renderer = create(<TaskDetailsEditor task={task({ plannedDate: null, dueDate: null })} onSave={save} />); });
    act(() => renderer.root.findAllByType("select")[1].props.onChange({ target: { value: "MONTHLY" } }));
    let saveButton = renderer.root.findAllByType("button").find(button => button.children.includes("세부 내용 저장"))!;
    expect(saveButton.props.disabled).toBe(true);
    act(() => renderer.root.findByProps({ type: "date" }).props.onChange({ target: { value: "2026-01-31" } }));
    saveButton = renderer.root.findAllByType("button").find(button => button.children.includes("세부 내용 저장"))!;
    expect(saveButton.props.disabled).toBe(false);
    await act(async () => saveButton.props.onClick());
    expect(renderer.root.findByProps({ role: "alert" }).children.join("")).toContain("저장 공간 부족");
    expect(renderer.root.findByProps({ type: "date" }).props.value).toBe("2026-01-31");
    act(() => renderer.unmount());
  });

  it("preserves an unsaved description and blocks overwriting a remote update", () => {
    const save = vi.fn();
    const original = task();
    let renderer!: ReactTestRenderer;
    act(() => { renderer = create(<TaskDetailsEditor task={original} onSave={save} />); });
    act(() => renderer.root.findByType("textarea").props.onChange({ target: { value: "내 편집" } }));
    act(() => renderer.update(<TaskDetailsEditor task={{ ...original, description: "다른 기기 편집", updatedAt: "2026-11-07T01:00:00Z" }} onSave={save} />));
    expect(renderer.root.findByType("textarea").props.value).toBe("내 편집");
    expect(renderer.root.findAllByType("button").find(button => button.children.includes("세부 내용 저장"))!.props.disabled).toBe(true);
    expect(JSON.stringify(renderer.toJSON())).toContain("다른 화면이나 기기에서");
    act(() => renderer.unmount());
  });

  it("requires saving edits before skipping a recurrence and reports successful skip", async () => {
    const skip = vi.fn();
    let renderer!: ReactTestRenderer;
    act(() => { renderer = create(<TaskDetailsEditor task={task({ recurrence: { frequency: "WEEKLY", interval: 1, anchorDate: "2026-11-07" } })} onSave={vi.fn()} onSkipOccurrence={skip} />); });
    await act(async () => renderer.root.findAllByType("button").find(button => button.children.includes("이번 회차 건너뛰기"))!.props.onClick());
    expect(skip).toHaveBeenCalledWith("task-1");
    act(() => renderer.root.findByType("textarea").props.onChange({ target: { value: "미저장" } }));
    expect(renderer.root.findAllByType("button").find(button => button.children.includes("이번 회차 건너뛰기"))!.props.disabled).toBe(true);
    act(() => renderer.unmount());
  });
});
