import { createRef } from "react";
import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MobileLayoutContext } from "../../../app/MobileLayoutContext";
import { TaskDraftForm } from "./TaskDraftForm";

let renderer: ReactTestRenderer | undefined;
afterEach(() => { act(() => renderer?.unmount()); });
describe("mobile task entry", () => {
  it("keeps the closed desktop form out of Tab order and submits a visible draft with Enter", () => {
    const save = vi.fn();
    const panel = (visible: boolean) => <TaskDraftForm draft="키보드로 입력" draftDueDate="2026-11-01" draftDueTime="13:00" draftMode="deadline" inputRef={createRef<HTMLInputElement>()} isVisible={visible} onBlur={vi.fn()} onDraftChange={vi.fn()} onDraftDueDateChange={vi.fn()} onDraftDueTimeChange={vi.fn()} onDraftModeChange={vi.fn()} onSubmitDraft={save} />;
    act(() => { renderer = create(panel(false)); });
    expect(renderer!.root.findAllByType("input")).toHaveLength(0);
    expect(renderer!.root.findAllByType("button")).toHaveLength(0);
    act(() => renderer!.update(panel(true)));
    // A real submit control also enables implicit Enter submission with date/time fields.
    expect(renderer!.root.findByProps({ type: "submit" }).props.disabled).toBe(false);
    const preventDefault = vi.fn();
    act(() => renderer!.root.findByProps({ id: "task-draft" }).props.onKeyDown?.({ key: "Enter", nativeEvent: { isComposing: true }, preventDefault }));
    expect(preventDefault).toHaveBeenCalledOnce();
    expect(save).not.toHaveBeenCalled();
    act(() => renderer!.root.findByType("form").props.onSubmit({ preventDefault: vi.fn() }));
    expect(save).toHaveBeenCalledOnce();
  });

  it("removes hidden form controls from navigation and offers visible save and IME-safe Enter", () => {
    const save = vi.fn();
    const panel = (visible: boolean, draft = "다음 할 일") => <MobileLayoutContext.Provider value><TaskDraftForm
      draft={draft} draftDueDate="" draftDueTime="" draftMode="today" inputRef={createRef<HTMLInputElement>()} isVisible={visible}
      onBlur={vi.fn()} onDraftChange={vi.fn()} onDraftDueDateChange={vi.fn()} onDraftDueTimeChange={vi.fn()} onDraftModeChange={vi.fn()} onSubmitDraft={save}
    /></MobileLayoutContext.Provider>;
    act(() => { renderer = create(panel(false)); });
    expect(renderer!.root.findAllByType("input")).toHaveLength(0);
    act(() => renderer!.update(panel(true)));
    expect(renderer!.root.findByProps({ type: "submit" }).props.disabled).toBe(false);
    const preventDefault = vi.fn();
    act(() => renderer!.root.findByType("input").props.onKeyDown({ key: "Enter", nativeEvent: { isComposing: true }, preventDefault }));
    expect(preventDefault).toHaveBeenCalledOnce();
    expect(save).not.toHaveBeenCalled();
    act(() => renderer!.root.findByType("form").props.onSubmit({ preventDefault: vi.fn() }));
    expect(save).toHaveBeenCalledOnce();
    act(() => renderer!.update(panel(true, "   ")));
    expect(renderer!.root.findByProps({ type: "submit" }).props.disabled).toBe(true);
    act(() => renderer!.root.findByType("form").props.onSubmit({ preventDefault: vi.fn() }));
    expect(save).toHaveBeenCalledOnce();
  });
});
