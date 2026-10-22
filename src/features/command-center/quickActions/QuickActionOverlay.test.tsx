import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MobileLayoutContext } from "../../../app/MobileLayoutContext";
import { QuickActionOverlay } from "./QuickActionOverlay";

let renderer: ReactTestRenderer | undefined;
afterEach(() => { act(() => renderer?.unmount()); });

describe("dated quick action input", () => {
  it("lets IME consume Escape and Enter without closing the sheet or submitting a partial task", () => {
    const onClose = vi.fn();
    const onAddTask = vi.fn();
    act(() => { renderer = create(<MobileLayoutContext.Provider value><QuickActionOverlay selectedDate="2026-10-23" onAddTask={onAddTask} onAddNote={vi.fn()} onClose={onClose} /></MobileLayoutContext.Provider>); });
    const field = () => renderer!.root.findByProps({ "aria-label": "추가할 할 일" });
    act(() => field().props.onChange({ target: { value: "완성할 한글" } }));
    const preventClose = vi.fn();
    act(() => renderer!.root.findByProps({ role: "dialog" }).props.onKeyDown({ key: "Escape", nativeEvent: { isComposing: true }, preventDefault: preventClose }));
    expect(onClose).not.toHaveBeenCalled();
    expect(preventClose).not.toHaveBeenCalled();
    const preventSubmit = vi.fn();
    act(() => field().props.onKeyDown?.({ key: "Enter", nativeEvent: { isComposing: true }, preventDefault: preventSubmit }));
    expect(preventSubmit).toHaveBeenCalledOnce();
    expect(onAddTask).not.toHaveBeenCalled();
    expect(field().props.value).toBe("완성할 한글");
    const normalEnter = vi.fn();
    act(() => field().props.onKeyDown?.({ key: "Enter", nativeEvent: { isComposing: false }, preventDefault: normalEnter }));
    expect(normalEnter).not.toHaveBeenCalled();
    act(() => renderer!.root.findByType("form").props.onSubmit({ preventDefault: vi.fn() }));
    expect(onAddTask).toHaveBeenCalledExactlyOnceWith("완성할 한글", null, null, "2026-10-23", undefined);
    expect(field().props.value).toBe("");
    act(() => renderer!.root.findByProps({ role: "dialog" }).props.onKeyDown({ key: "Escape", nativeEvent: { isComposing: false }, preventDefault: vi.fn() }));
    expect(onClose).toHaveBeenCalledOnce();
  });
});
