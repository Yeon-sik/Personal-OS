import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MobileLayoutContext } from "../../app/MobileLayoutContext";
import { WindowsDesktopContext } from "../../app/WindowsDesktopContext";
import { task } from "../home/testFixtures";
import { formatLocalDate } from "../fitness/fitnessDate";
import { ChecklistPanel } from "./ChecklistPanel";

let renderer: ReactTestRenderer | undefined;
afterEach(() => { act(() => renderer?.unmount()); vi.unstubAllGlobals(); });

describe("task pointer ordering", () => {
  it("saves a desktop deadline with its date/time through the existing action", () => {
    const onAdd = vi.fn();
    act(() => { renderer = create(<WindowsDesktopContext.Provider value><ChecklistPanel tasks={[]} onAdd={onAdd} onDelete={vi.fn()} onReorder={vi.fn()} onToggle={vi.fn()} onUpdatePlannedDate={vi.fn()} onUpdateSchedule={vi.fn()} onUpdateText={vi.fn()} /></WindowsDesktopContext.Provider>); });
    expect(renderer!.root.findAllByType("form")).toHaveLength(0);
    act(() => renderer!.root.findByProps({ "aria-label": "오늘 할 일 입력 열기" }).props.onClick());
    act(() => renderer!.root.findAllByType("button").find((node) => node.children.join("") === "기한 내 할 일")!.props.onClick());
    act(() => renderer!.root.findByProps({ id: "task-draft" }).props.onChange({ target: { value: "보고서 제출" } }));
    act(() => renderer!.root.findByProps({ "aria-label": "추가할 할 일 마감일" }).props.onChange({ target: { value: "2026-11-01" } }));
    act(() => renderer!.root.findByProps({ "aria-label": "추가할 할 일 마감 시간" }).props.onChange({ target: { value: "13:00" } }));
    expect(renderer!.root.findByProps({ type: "submit" }).props.disabled).toBe(false);
    act(() => renderer!.root.findByType("form").props.onSubmit({ preventDefault: vi.fn() }));
    expect(onAdd).toHaveBeenCalledExactlyOnceWith("보고서 제출", "2026-11-01", "13:00", null);
    expect(renderer!.root.findAllByType("form")).toHaveLength(0);
  });

  it("cancels interrupted drags without saving a new order and still commits pointerup", () => {
    const listeners = new Map<string, (event?: unknown) => void>();
    vi.stubGlobal("window", {
      addEventListener: (name: string, handler: (event?: unknown) => void) => listeners.set(name, handler),
      removeEventListener: (name: string, handler: (event?: unknown) => void) => { if (listeners.get(name) === handler) listeners.delete(name); },
    });
    vi.stubGlobal("document", {
      body: { style: { userSelect: "text" } },
      elementFromPoint: () => ({ closest: () => ({ dataset: { taskRowId: "b" }, getBoundingClientRect: () => ({ top: 100, height: 100 }) }) }),
    });
    const reorder = vi.fn();
    const today = formatLocalDate();
    act(() => { renderer = create(<MobileLayoutContext.Provider value><ChecklistPanel tasks={[task({ id: "a", text: "첫 항목", plannedDate: today }), task({ id: "b", text: "다음 항목", plannedDate: today })]} onAdd={vi.fn()} onDelete={vi.fn()} onReorder={reorder} onToggle={vi.fn()} onUpdatePlannedDate={vi.fn()} onUpdateSchedule={vi.fn()} onUpdateText={vi.fn()} /></MobileLayoutContext.Provider>); });
    const start = () => {
      act(() => renderer!.root.findByProps({ "aria-label": "첫 항목 드래그로 순서 변경" }).props.onPointerDown({ button: 0, preventDefault: vi.fn() }));
      act(() => listeners.get("pointermove")?.({ clientX: 50, clientY: 120, preventDefault: vi.fn() }));
    };
    start();
    act(() => listeners.get("pointercancel")?.());
    expect(reorder).not.toHaveBeenCalled();
    expect(listeners.has("pointermove")).toBe(false);
    expect(document.body.style.userSelect).toBe("text");
    start();
    const preventDefault = vi.fn();
    act(() => listeners.get("keydown")?.({ key: "Escape", preventDefault }));
    expect(reorder).not.toHaveBeenCalled();
    expect(preventDefault).toHaveBeenCalledOnce();
    expect(listeners.has("pointermove")).toBe(false);
    start();
    act(() => listeners.get("pointerup")?.());
    expect(reorder).toHaveBeenCalledExactlyOnceWith("a", "b", "before");
  });
});
