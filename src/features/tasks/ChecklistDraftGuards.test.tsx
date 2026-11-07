import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ChecklistPanel } from "./ChecklistPanel";
import { TaskDetailsEditor } from "./components/TaskDetailsEditor";
import { formatLocalDate } from "../fitness/fitnessDate";
import { task } from "../home/testFixtures";

afterEach(() => vi.unstubAllGlobals());

function panelProps() {
  return { tasks: [task({ description: "저장된 설명", plannedDate: null })], onAdd: vi.fn(), onDelete: vi.fn(), onReorder: vi.fn(), onToggle: vi.fn(), onUpdatePlannedDate: vi.fn(), onUpdateSchedule: vi.fn(), onUpdateText: vi.fn(), onUpdateDetails: vi.fn() };
}

describe("checklist unsaved editing guards", () => {
  it("preserves drafts when collapse, completion, deletion, today movement and filters are cancelled", () => {
    const confirm = vi.fn(() => false);
    vi.stubGlobal("window", { confirm });
    const props = panelProps();
    let renderer!: ReactTestRenderer;
    act(() => { renderer = create(<ChecklistPanel {...props} />); });
    act(() => renderer.root.findByProps({ "aria-expanded": false }).props.onClick());
    act(() => renderer.root.findByType("textarea").props.onChange({ target: { value: "작성 중인 설명" } }));
    act(() => renderer.root.findByProps({ "aria-expanded": true }).props.onClick());
    act(() => renderer.root.findByProps({ "aria-label": "완료 여부" }).props.onChange());
    act(() => renderer.root.findByProps({ "aria-label": "할 일 삭제" }).props.onClick());
    act(() => renderer.root.findByProps({ "aria-label": "오늘 할 일로 지정" }).props.onClick());
    act(() => renderer.root.findByProps({ "aria-label": "할 일 검색" }).props.onChange({ target: { value: "다른 제목" } }));
    act(() => renderer.root.findByProps({ "aria-label": "할 일 상태 필터" }).props.onChange({ target: { value: "completed" } }));
    act(() => renderer.root.findByProps({ "aria-label": "할 일 분류 필터" }).props.onChange({ target: { value: "학교" } }));
    expect(confirm).toHaveBeenCalledTimes(7);
    expect(props.onToggle).not.toHaveBeenCalled();
    expect(props.onDelete).not.toHaveBeenCalled();
    expect(props.onUpdatePlannedDate).not.toHaveBeenCalled();
    expect(renderer.root.findByType("textarea").props.value).toBe("작성 중인 설명");
    expect(renderer.root.findByProps({ "aria-label": "할 일 검색" }).props.value).toBe("");
    expect(renderer.root.findByProps({ "aria-label": "할 일 상태 필터" }).props.value).toBe("open");
    expect(renderer.root.findByProps({ "aria-label": "할 일 분류 필터" }).props.value).toBe("all");
    act(() => renderer.unmount());
  });

  it("discards drafts only after confirmed filtering and clears dirty registrations", () => {
    const confirm = vi.fn(() => true);
    vi.stubGlobal("window", { confirm });
    let renderer!: ReactTestRenderer;
    act(() => { renderer = create(<ChecklistPanel {...panelProps()} />); });
    act(() => renderer.root.findByProps({ "aria-expanded": false }).props.onClick());
    act(() => renderer.root.findByType("textarea").props.onChange({ target: { value: "버릴 편집" } }));
    act(() => renderer.root.findByProps({ "aria-label": "할 일 상태 필터" }).props.onChange({ target: { value: "all" } }));
    expect(renderer.root.findAllByType("textarea")).toHaveLength(0);
    act(() => renderer.root.findByProps({ "aria-expanded": false }).props.onClick());
    expect(renderer.root.findByType("textarea").props.value).toBe("저장된 설명");
    act(() => renderer.root.findByProps({ "aria-label": "할 일 검색" }).props.onChange({ target: { value: "없는 제목" } }));
    expect(confirm).toHaveBeenCalledOnce();
    act(() => renderer.unmount());
  });

  it("keeps a failed save draft and allows explicit cancellation without stale filter guards", async () => {
    const confirm = vi.fn(() => false);
    vi.stubGlobal("window", { confirm });
    const props = panelProps();
    props.onUpdateDetails.mockRejectedValue(new Error("저장 공간 부족"));
    let renderer!: ReactTestRenderer;
    act(() => { renderer = create(<ChecklistPanel {...props} />); });
    act(() => renderer.root.findByProps({ "aria-expanded": false }).props.onClick());
    act(() => renderer.root.findByType("textarea").props.onChange({ target: { value: "저장 실패한 편집" } }));
    await act(async () => renderer.root.findAllByType("button").find(button => button.children.includes("세부 내용 저장"))!.props.onClick());
    act(() => renderer.root.findByProps({ "aria-expanded": true }).props.onClick());
    expect(renderer.root.findByType("textarea").props.value).toBe("저장 실패한 편집");
    act(() => renderer.root.findAllByType("button").find(button => button.children.includes("편집 취소"))!.props.onClick());
    act(() => renderer.root.findByProps({ "aria-label": "할 일 상태 필터" }).props.onChange({ target: { value: "all" } }));
    expect(confirm).toHaveBeenCalledOnce();
    act(() => renderer.unmount());
  });

  it("guards Enter at the checklist limit and during Korean composition", () => {
    let renderer!: ReactTestRenderer;
    act(() => { renderer = create(<TaskDetailsEditor task={task({ checklist: Array.from({ length: 100 }, (_, index) => ({ id: String(index), text: `항목 ${index}`, isDone: false })) })} onSave={vi.fn()} />); });
    act(() => renderer.root.findByProps({ "aria-label": "새 하위 항목" }).props.onChange({ target: { value: "추가 입력" } }));
    act(() => renderer.root.findByProps({ "aria-label": "새 하위 항목" }).props.onKeyDown({ key: "Enter", nativeEvent: { isComposing: false }, keyCode: 13, preventDefault: vi.fn() }));
    expect(renderer.root.findAllByProps({ "aria-label": "101번 하위 항목 내용" })).toHaveLength(0);
    act(() => renderer.unmount());
    act(() => { renderer = create(<TaskDetailsEditor task={task()} onSave={vi.fn()} />); });
    act(() => renderer.root.findByProps({ "aria-label": "새 하위 항목" }).props.onChange({ target: { value: "한글 작성" } }));
    act(() => renderer.root.findByProps({ "aria-label": "새 하위 항목" }).props.onKeyDown({ key: "Enter", nativeEvent: { isComposing: true }, keyCode: 229, preventDefault: vi.fn() }));
    expect(renderer.root.findAllByProps({ "aria-label": "1번 하위 항목 내용" })).toHaveLength(0);
    act(() => renderer.unmount());
  });
});

it("preserves dirty row editors when sync changes their section and completion filter", () => {
  vi.stubGlobal("window", { confirm: vi.fn(() => false) });
  const props = panelProps();
  let renderer!: ReactTestRenderer;
  act(() => { renderer = create(<ChecklistPanel {...props} />); });
  act(() => renderer.root.findByProps({ "aria-expanded": false }).props.onClick());
  act(() => renderer.root.findByType("textarea").props.onChange({ target: { value: "동기화 중에도 보존할 편집" } }));
  const moved = { ...props.tasks[0], plannedDate: formatLocalDate(), updatedAt: "2026-11-07T01:00:00.000Z" };
  act(() => renderer.update(<ChecklistPanel {...props} tasks={[moved]} />));
  expect(renderer.root.findByType("textarea").props.value).toBe("동기화 중에도 보존할 편집");
  const completed = { ...moved, isDone: true, completedAt: "2026-11-07T01:01:00.000Z", updatedAt: "2026-11-07T01:01:00.000Z" };
  act(() => renderer.update(<ChecklistPanel {...props} tasks={[completed]} />));
  expect(renderer.root.findByType("textarea").props.value).toBe("동기화 중에도 보존할 편집");
  expect(JSON.stringify(renderer.toJSON())).toContain("다른 화면이나 기기에서");
  act(() => renderer.root.findAllByType("button").find(button => button.children.includes("편집 취소"))!.props.onClick());
  expect(renderer.root.findAllByType("textarea")).toHaveLength(0);
  expect(renderer.root.findAllByProps({ "aria-label": "완료 여부" })).toHaveLength(0);
  act(() => renderer.unmount());
});
