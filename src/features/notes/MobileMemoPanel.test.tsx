import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MobileMemoPanel } from "./MobileMemoPanel";
import { MemoPanel, type MemoPanelProps } from "./MemoPanel";
import { MobileLayoutContext } from "../../app/MobileLayoutContext";
import { entity } from "../home/testFixtures";
import * as noteService from "./noteService";

let renderer: ReactTestRenderer | undefined;
beforeEach(() => {
  vi.stubGlobal("document", { getSelection: () => null, addEventListener: vi.fn(), removeEventListener: vi.fn() });
  vi.stubGlobal("window", { requestAnimationFrame: (callback: () => void) => { callback(); return 1; } });
});
afterEach(() => { act(() => renderer?.unmount()); vi.restoreAllMocks(); vi.unstubAllGlobals(); });
function fixture(): MemoPanelProps {
  const notes = [{ ...entity, id: "a", title: "하루 기록", content: "기억할 내용" }, { ...entity, id: "b", title: "회의 메모", content: "다음 약속" }];
  return { notes, selectedNote: notes[0], selectedNoteId: "a", isLoading: false, onCreate: vi.fn(), onSelect: vi.fn(), onDelete: vi.fn(), onChangeTitle: vi.fn(), onChangeContent: vi.fn() };
}
const button = (label: string) => renderer!.root.findAllByType("button").find((node) => node.props["aria-label"] === label || node.children.join("") === label)!;

describe("mobile memo flow", () => {
  it("offers search/list and a dedicated editor while keeping the existing CRUD callbacks", () => {
    const props = fixture();
    act(() => { renderer = create(<MobileLayoutContext.Provider value><MemoPanel {...props} /></MobileLayoutContext.Provider>); });
    expect(renderer!.root.findAllByType(MobileMemoPanel)).toHaveLength(1);
    expect(renderer!.root.findAllByProps({ contentEditable: true })).toHaveLength(0);
    act(() => renderer!.root.findByProps({ type: "search" }).props.onChange({ target: { value: "다음" } }));
    expect(renderer!.root.findAll((node) => node.type === "button" && node.props["data-note-id"])).toHaveLength(1);
    act(() => renderer!.root.findByProps({ "data-note-id": "b" }).props.onClick());
    expect(props.onSelect).toHaveBeenCalledWith("b");
    expect(renderer!.root.findAllByProps({ type: "search" })).toHaveLength(0);
    act(() => renderer!.root.findByType("input").props.onChange({ target: { value: "바뀐 제목" } }));
    expect(props.onChangeTitle).toHaveBeenCalledWith("바뀐 제목");
    act(() => button("메모 삭제").props.onClick());
    expect(props.onDelete).not.toHaveBeenCalled();
    act(() => button("취소").props.onClick());
    expect(props.onDelete).not.toHaveBeenCalled();
    act(() => button("메모 삭제").props.onClick());
    act(() => button("삭제 확인").props.onClick());
    expect(props.onDelete).toHaveBeenCalledWith("a");
    expect(renderer!.root.findByProps({ type: "search" }).props.value).toBe("다음");
    act(() => button("메모 추가").props.onClick());
    expect(props.onCreate).toHaveBeenCalledOnce();
  });

  it("waits for Korean composition, preserves the live DOM on save echo, and accepts external changes", () => {
    const props = fixture();
    const editor = { innerHTML: "" };
    const serialize = vi.spyOn(noteService, "serializeNoteEditorHtmlToMarkdown").mockReturnValue("**완성된 문장**");
    act(() => { renderer = create(<MobileMemoPanel {...props} />, { createNodeMock: (element) => element.props.contentEditable ? editor : null }); });
    act(() => renderer!.root.findByProps({ "data-note-id": "a" }).props.onClick());
    const content = () => renderer!.root.findByProps({ contentEditable: true });
    act(() => content().props.onCompositionStart());
    editor.innerHTML = "<div><b>완성된 문장</b></div>";
    act(() => content().props.onInput());
    expect(serialize).not.toHaveBeenCalled();
    expect(props.onChangeContent).not.toHaveBeenCalled();
    act(() => content().props.onCompositionEnd());
    expect(props.onChangeContent).toHaveBeenCalledExactlyOnceWith("**완성된 문장**");
    act(() => renderer!.update(<MobileMemoPanel {...props} selectedNote={{ ...props.notes[0], content: "**완성된 문장**" }} />));
    expect(editor.innerHTML).toBe("<div><b>완성된 문장</b></div>");
    act(() => renderer!.update(<MobileMemoPanel {...props} selectedNote={{ ...props.notes[0], content: "외부 변경" }} />));
    expect(editor.innerHTML).toBe(noteService.renderNoteContentHtml("외부 변경"));
  });

  it("shows an actionable empty search without mutating notes", () => {
    const props = fixture();
    act(() => { renderer = create(<MobileMemoPanel {...props} />); });
    act(() => renderer!.root.findByProps({ type: "search" }).props.onChange({ target: { value: "없는 내용" } }));
    expect(button("검색 지우기")).toBeDefined();
    act(() => button("검색 지우기").props.onClick());
    expect(renderer!.root.findAll((node) => node.type === "button" && node.props["data-note-id"])).toHaveLength(2);
    expect(props.onDelete).not.toHaveBeenCalled();
    expect(props.onChangeContent).not.toHaveBeenCalled();
  });

  it("does not carry an old note's composition into the newly selected note", () => {
    const props = fixture();
    const editors: Array<{ innerHTML: string }> = [];
    const nextHtml = noteService.renderNoteContentHtml(props.notes[1].content);
    vi.spyOn(noteService, "serializeNoteEditorHtmlToMarkdown").mockImplementation((html) => html === nextHtml ? props.notes[1].content : "이전 메모 작성");
    act(() => { renderer = create(<MobileMemoPanel {...props} />, { createNodeMock: (element) => {
      if (!element.props.contentEditable) return null;
      const editor = { innerHTML: "" };
      editors.push(editor);
      return editor;
    } }); });
    act(() => renderer!.root.findByProps({ "data-note-id": "a" }).props.onClick());
    const field = () => renderer!.root.findByProps({ contentEditable: true });
    const oldInput = field().props.onInput;
    const oldCompositionEnd = field().props.onCompositionEnd;
    act(() => field().props.onCompositionStart());
    editors[0].innerHTML = "<div>이전 메모 작성</div>";
    act(() => renderer!.update(<MobileMemoPanel {...props} selectedNoteId="b" selectedNote={props.notes[1]} />));
    // A new DOM editor prevents the native IME session from writing into note B.
    expect(editors).toHaveLength(2);
    expect(editors[1].innerHTML).toBe(nextHtml);
    act(() => { oldCompositionEnd(); oldInput(); });
    expect(props.onChangeContent).not.toHaveBeenCalled();
    act(() => field().props.onCompositionEnd());
    expect(props.onChangeContent).not.toHaveBeenCalled();
    editors[1].innerHTML = "<div>새 메모 작성</div>";
    act(() => field().props.onInput());
    expect(props.onChangeContent).toHaveBeenCalledOnce();
  });
});
