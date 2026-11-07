import type { ReactNode } from "react";
import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ActionDetailDialog } from "./ActionDetailDialog";
import type { ActionActions } from "./useActionActions";
import { task } from "../home/testFixtures";

vi.mock("./ActionDialog", () => ({
  ActionDialog: ({ children, onClose }: { children: ReactNode; onClose: () => void }) => <section><button aria-label="일정 창 닫기" onClick={onClose}>닫기</button>{children}</section>,
  actionButtonClass: "button", actionInputClass: "input",
}));

afterEach(() => vi.unstubAllGlobals());

function actions(): ActionActions {
  return { updateAction: vi.fn(), importActions: vi.fn(), resolveActionConflict: vi.fn(), adoptLocalActions: vi.fn(), restoreAction: vi.fn() };
}

describe("ActionDetailDialog atomic planning edits", () => {
  it("saves edited schedule and checklist details in one revision-checked action", async () => {
    const api = actions();
    const independentSave = vi.fn();
    let renderer!: ReactTestRenderer;
    const original = task();
    act(() => { renderer = create(<ActionDetailDialog task={original} actions={api} onClose={vi.fn()} onDelete={vi.fn()} onUpdateDetails={independentSave} />); });
    const planned = renderer.root.findAllByType("label").find(label => label.children.includes("내가 처리할 계획일"))!.findByType("input");
    act(() => planned.props.onChange({ target: { value: "2026-11-08" } }));
    act(() => renderer.root.findByType("textarea").props.onChange({ target: { value: "자료 링크와 준비물" } }));
    await act(async () => renderer.root.findByType("form").props.onSubmit({ preventDefault: vi.fn() }));
    expect(api.updateAction).toHaveBeenCalledExactlyOnceWith(original.id, original.updatedAt, expect.objectContaining({ plannedDate: "2026-11-08", description: "자료 링크와 준비물" }), false);
    expect(independentSave).not.toHaveBeenCalled();
    act(() => renderer.unmount());
  });

  it("combines unsaved description and completion in the same action instead of discarding edits", async () => {
    const api = actions();
    const close = vi.fn();
    let renderer!: ReactTestRenderer;
    const original = task();
    act(() => { renderer = create(<ActionDetailDialog task={original} actions={api} onClose={close} onDelete={vi.fn()} onUpdateDetails={vi.fn()} onToggle={vi.fn()} />); });
    act(() => renderer.root.findByType("textarea").props.onChange({ target: { value: "완료하며 남긴 메모" } }));
    await act(async () => renderer.root.findAllByType("button").find(button => button.children.includes("완료 처리"))!.props.onClick());
    expect(api.updateAction).toHaveBeenCalledExactlyOnceWith(original.id, original.updatedAt, expect.objectContaining({ description: "완료하며 남긴 메모", isDone: true }), false);
    expect(close).toHaveBeenCalledOnce();
    act(() => renderer.unmount());
  });

  it("blocks a skip and form submission while invalid recurrence edits remain", () => {
    const api = actions();
    let renderer!: ReactTestRenderer;
    act(() => { renderer = create(<ActionDetailDialog task={task({ recurrence: { frequency: "DAILY", interval: 1, anchorDate: "2026-11-07" } })} actions={api} onClose={vi.fn()} onDelete={vi.fn()} onUpdateDetails={vi.fn()} onSkipOccurrence={vi.fn()} />); });
    const interval = renderer.root.findByProps({ type: "number" });
    act(() => interval.props.onChange({ target: { value: "0" } }));
    expect(renderer.root.findAllByType("button").find(button => button.children.includes("이번 회차 건너뛰기"))!.props.disabled).toBe(true);
    act(() => renderer.root.findByType("form").props.onSubmit({ preventDefault: vi.fn() }));
    expect(api.updateAction).not.toHaveBeenCalled();
    act(() => renderer.unmount());
  });
});

describe("ActionDetailDialog draft recovery", () => {
  it("guards closing and reloads both schedule and details with the latest revision", async () => {
    const confirm = vi.fn(() => false);
    vi.stubGlobal("window", { confirm });
    const api = actions();
    const close = vi.fn();
    const original = task();
    const props = { actions: api, onClose: close, onDelete: vi.fn(), onUpdateDetails: vi.fn() };
    let renderer!: ReactTestRenderer;
    act(() => { renderer = create(<ActionDetailDialog task={original} {...props} />); });
    act(() => renderer.root.findByType("textarea").props.onChange({ target: { value: "내 편집" } }));
    act(() => renderer.root.findByProps({ "aria-label": "일정 창 닫기" }).props.onClick());
    expect(close).not.toHaveBeenCalled();
    const latest = { ...original, description: "서버 설명", plannedDate: "2026-11-09", updatedAt: "2026-11-07T01:00:00.000Z" };
    act(() => renderer.update(<ActionDetailDialog task={latest} {...props} />));
    act(() => renderer.root.findByType("form").props.onSubmit({ preventDefault: vi.fn() }));
    expect(api.updateAction).not.toHaveBeenCalled();
    expect(renderer.root.findByType("textarea").props.value).toBe("내 편집");
    act(() => renderer.root.findAllByType("button").find(button => button.children.includes("내 편집 버리고 최신 내용 불러오기"))!.props.onClick());
    expect(renderer.root.findByType("textarea").props.value).toBe("서버 설명");
    const planned = renderer.root.findAllByType("label").find(label => label.children.includes("내가 처리할 계획일"))!.findByType("input");
    expect(planned.props.value).toBe("2026-11-09");
    await act(async () => renderer.root.findByType("form").props.onSubmit({ preventDefault: vi.fn() }));
    expect(api.updateAction).toHaveBeenCalledExactlyOnceWith(original.id, latest.updatedAt, expect.objectContaining({ description: "서버 설명", plannedDate: "2026-11-09" }), false);
    act(() => renderer.root.findByProps({ "aria-label": "일정 창 닫기" }).props.onClick());
    expect(close).toHaveBeenCalledOnce();
    expect(confirm).toHaveBeenCalledOnce();
    act(() => renderer.unmount());
  });

  it("does not submit or complete while an unadded checklist step is being typed", () => {
    const api = actions();
    let renderer!: ReactTestRenderer;
    act(() => { renderer = create(<ActionDetailDialog task={task()} actions={api} onClose={vi.fn()} onDelete={vi.fn()} onUpdateDetails={vi.fn()} onToggle={vi.fn()} />); });
    act(() => renderer.root.findByProps({ "aria-label": "새 하위 항목" }).props.onChange({ target: { value: "작성 중인 단계" } }));
    expect(renderer.root.findAllByType("button").find(button => button.children.includes("완료 처리"))!.props.disabled).toBe(true);
    act(() => renderer.root.findByType("form").props.onSubmit({ preventDefault: vi.fn() }));
    expect(api.updateAction).not.toHaveBeenCalled();
    act(() => renderer.root.findByProps({ "aria-label": "하위 항목 추가" }).props.onClick());
    expect(renderer.root.findAllByType("button").find(button => button.children.includes("완료 처리"))!.props.disabled).toBe(false);
    act(() => renderer.unmount());
  });
});
