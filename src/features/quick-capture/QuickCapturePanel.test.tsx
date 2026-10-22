import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { afterEach, describe, expect, it, vi } from "vitest";
import { WindowsDesktopContext } from "../../app/WindowsDesktopContext";
import { QuickCapturePanel } from "./QuickCapturePanel";
import { MobileLayoutContext } from "../../app/MobileLayoutContext";

let renderer: ReactTestRenderer | undefined;
afterEach(() => { act(() => renderer?.unmount()); vi.unstubAllGlobals(); });

describe("Windows quick capture keyboard behavior", () => {
  it.each([false, true])("does not close or save while an IME consumes Escape or Enter (mobile: %s)", (mobile) => {
    vi.stubGlobal("document", { activeElement: null });
    vi.stubGlobal("HTMLElement", class {});
    vi.stubGlobal("window", { requestAnimationFrame: vi.fn().mockReturnValue(1), cancelAnimationFrame: vi.fn() });
    const onClose = vi.fn();
    const onSave = vi.fn();
    const preventDefault = vi.fn();
    act(() => { renderer = create(<MobileLayoutContext.Provider value={mobile}><WindowsDesktopContext.Provider value={!mobile}><QuickCapturePanel isOpen mode="task" shortcutStatus={{ supported: false, registered: false, shortcut: "Ctrl+K", error: null }} onClose={onClose} onModeChange={vi.fn()} onSave={onSave} /></WindowsDesktopContext.Provider></MobileLayoutContext.Provider>); });
    for (const key of ["Escape", "Enter"]) {
      act(() => renderer!.root.findByProps({ role: "dialog" }).props.onKeyDown({ key, ctrlKey: true, nativeEvent: { isComposing: true }, preventDefault }));
    }
    expect(onClose).not.toHaveBeenCalled();
    expect(onSave).not.toHaveBeenCalled();
    expect(preventDefault).not.toHaveBeenCalled();
    act(() => renderer!.root.findByProps({ role: "dialog" }).props.onKeyDown({ key: "Escape", nativeEvent: { isComposing: false }, preventDefault }));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("focuses the input, exposes validation, and restores the opening control on close", () => {
    class FocusTarget { isConnected = true; focus = vi.fn(); }
    const opener = new FocusTarget();
    const input = new FocusTarget();
    vi.stubGlobal("HTMLElement", FocusTarget);
    vi.stubGlobal("document", { activeElement: opener });
    vi.stubGlobal("window", { requestAnimationFrame: (callback: () => void) => { callback(); return 1; }, cancelAnimationFrame: vi.fn() });
    const onSave = vi.fn().mockReturnValue(false);
    const onClose = vi.fn();
    const panel = (isOpen: boolean) => <WindowsDesktopContext.Provider value><QuickCapturePanel isOpen={isOpen} mode="task" shortcutStatus={{ supported: false, registered: false, shortcut: "Ctrl+K", error: null }} onClose={onClose} onModeChange={vi.fn()} onSave={onSave} /></WindowsDesktopContext.Provider>;
    act(() => { renderer = create(panel(true), { createNodeMock: (element) => element.type === "textarea" ? input : null }); });
    expect(input.focus).toHaveBeenCalledOnce();
    const keyDown = (target: unknown, key = "Enter") => act(() => renderer!.root.findByProps({ role: "dialog" }).props.onKeyDown({ key, target, shiftKey: false, nativeEvent: { isComposing: false }, preventDefault: vi.fn() }));
    keyDown({ tagName: "BUTTON" });
    expect(onSave).not.toHaveBeenCalled();
    keyDown(input);
    expect(onSave).toHaveBeenCalledWith("", "task");
    expect(renderer!.root.findByType("textarea").props["aria-invalid"]).toBe(true);
    expect(renderer!.root.findByProps({ role: "alert" }).children).toContain("입력 내용을 확인하세요.");
    keyDown(input, "Escape");
    expect(onClose).toHaveBeenCalledOnce();
    act(() => renderer!.update(panel(false)));
    expect(opener.focus).toHaveBeenCalledOnce();
  });
});

describe("mobile quick capture", () => {
  it("keeps Enter as newline, avoids composing submissions, preserves failed drafts, and saves explicitly", () => {
    class FocusTarget { isConnected = true; focus = vi.fn(); }
    const opener = new FocusTarget();
    const input = new FocusTarget();
    vi.stubGlobal("HTMLElement", FocusTarget);
    vi.stubGlobal("document", { activeElement: opener });
    vi.stubGlobal("window", { requestAnimationFrame: (callback: () => void) => { callback(); return 1; }, cancelAnimationFrame: vi.fn() });
    const onSave = vi.fn().mockReturnValue(false);
    const onClose = vi.fn();
    const panel = (isOpen: boolean) => <MobileLayoutContext.Provider value><QuickCapturePanel isOpen={isOpen} mode="memo" shortcutStatus={{ supported: false, registered: false, shortcut: "Ctrl+K", error: null }} onClose={onClose} onModeChange={vi.fn()} onSave={onSave} /></MobileLayoutContext.Provider>;
    act(() => { renderer = create(panel(true), { createNodeMock: (element) => element.type === "textarea" ? input : null }); });
    const field = () => renderer!.root.findByType("textarea");
    act(() => field().props.onChange({ target: { value: "첫 줄\n두 번째 줄" } }));
    const preventDefault = vi.fn();
    const key = (ctrlKey = false, isComposing = false, target: unknown = input) => act(() => renderer!.root.findByProps({ role: "dialog" }).props.onKeyDown({ key: "Enter", target, ctrlKey, shiftKey: false, nativeEvent: { isComposing }, preventDefault }));
    key(); key(true, true); key(true, false, { tagName: "BUTTON" });
    expect(onSave).not.toHaveBeenCalled();
    expect(preventDefault).not.toHaveBeenCalled();
    const save = () => renderer!.root.findAllByType("button").find((node) => node.findAllByType("span").some((span) => span.children.join("") === "저장"))!;
    act(() => save().props.onClick());
    expect(onSave).toHaveBeenCalledWith("첫 줄\n두 번째 줄", "memo");
    expect(field().props.value).toBe("첫 줄\n두 번째 줄");
    expect(field().props["aria-invalid"]).toBe(true);
    expect(renderer!.root.findByProps({ role: "alert" }).props.id).toBe(field().props["aria-describedby"]);
    act(() => renderer!.update(panel(false)));
    expect(opener.focus).toHaveBeenCalledOnce();
    act(() => renderer!.update(panel(true)));
    expect(field().props.value).toBe("첫 줄\n두 번째 줄");
    onSave.mockReturnValue(true);
    key(true);
    expect(onSave).toHaveBeenCalledTimes(2);
    expect(field().props.value).toBe("");
  });
});
