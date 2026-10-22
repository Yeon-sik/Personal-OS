import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { afterEach, describe, expect, it, vi } from "vitest";
import { WindowsMemoPanel } from "./WindowsMemoPanel";
import { MemoPanel, type MemoPanelProps } from "./MemoPanel";
import { WindowsDesktopContext } from "../../app/WindowsDesktopContext";
import { entity } from "../home/testFixtures";
import * as noteService from "./noteService";

let renderer: ReactTestRenderer | undefined;
afterEach(() => {
  act(() => renderer?.unmount());
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});
function fixture(): MemoPanelProps {
  const notes = [{ ...entity, id: "a", title: "설계 메모", content: "**첫 문장**" }, { ...entity, id: "b", title: "회의 메모", content: "두 번째 내용" }];
  return { notes, selectedNote: notes[0], selectedNoteId: "a", isLoading: false, onCreate: vi.fn(), onSelect: vi.fn(), onDelete: vi.fn(), onChangeTitle: vi.fn(), onChangeContent: vi.fn() };
}

describe("Windows memo workflow", () => {
  it("keeps create, select and title editing connected to the existing actions", () => {
    const props = fixture();
    act(() => { renderer = create(<WindowsMemoPanel {...props} />); });
    act(() => renderer!.root.findByProps({ "aria-label": "메모 추가" }).props.onClick());
    expect(props.onCreate).toHaveBeenCalledOnce();
    act(() => renderer!.root.findByType("select").props.onChange({ target: { value: "b" } }));
    expect(props.onSelect).toHaveBeenCalledWith("b");
    act(() => renderer!.root.findByProps({ id: "windows-note-title" }).props.onChange({ target: { value: "수정 제목" } }));
    expect(props.onChangeTitle).toHaveBeenCalledWith("수정 제목");
  });
  it("requires a separate confirmation to delete and Escape cancels without deleting", () => {
    const props = fixture();
    const focus = vi.fn();
    act(() => { renderer = create(<WindowsMemoPanel {...props} />); });
    const requestDelete = () => act(() => renderer!.root.findByProps({ "aria-label": "메모 삭제" }).props.onClick({ currentTarget: { focus } }));
    requestDelete();
    expect(props.onDelete).not.toHaveBeenCalled();
    act(() => renderer!.root.findByProps({ "aria-label": "메모 삭제 확인" }).props.onKeyDown({ key: "Escape", preventDefault: vi.fn() }));
    expect(props.onDelete).not.toHaveBeenCalled();
    expect(focus).toHaveBeenCalledOnce();
    requestDelete();
    act(() => renderer!.root.findByProps({ "aria-label": "메모 삭제 확인" }).findAllByType("button")[1].props.onClick());
    expect(props.onDelete).toHaveBeenCalledWith("a");
  });
  it("filters by content without changing the selected note or deleting data", () => {
    const props = fixture();
    act(() => { renderer = create(<WindowsMemoPanel {...props} />); });
    act(() => renderer!.root.findByProps({ "aria-label": "메모 검색" }).props.onChange({ target: { value: "두 번째" } }));
    const list = renderer!.root.findByProps({ "aria-label": "메모 목록" });
    expect(list.findAllByType("button")).toHaveLength(1);
    act(() => list.findByType("button").props.onClick());
    expect(props.onSelect).toHaveBeenCalledWith("b");
    expect(props.onDelete).not.toHaveBeenCalled();
    expect(renderer!.root.findByProps({ id: "windows-note-title" }).props.value).toBe("설계 메모");
  });
  it("uses the existing mobile editor unless the Windows context is enabled", () => {
    const props = fixture();
    act(() => { renderer = create(<MemoPanel {...props} />); });
    expect(renderer!.root.findAllByType(WindowsMemoPanel)).toHaveLength(0);
    act(() => renderer!.update(<WindowsDesktopContext.Provider value><MemoPanel {...props} /></WindowsDesktopContext.Provider>));
    expect(renderer!.root.findAllByType(WindowsMemoPanel)).toHaveLength(1);
  });

  it("tracks caret and mixed formatting, preserves selection for shortcuts, and saves through the existing action", () => {
    const props = fixture();
    const textNode = {};
    const range = { commonAncestorContainer: textNode, cloneRange: () => range };
    const selection = {
      anchorNode: textNode, focusNode: textNode, rangeCount: 1,
      getRangeAt: () => range, removeAllRanges: vi.fn(), addRange: vi.fn(),
    };
    const applied = { bold: true, italic: false };
    const mixed = { bold: false, italic: false };
    let selectionChanged = () => {};
    const removeEventListener = vi.fn();
    const execCommand = vi.fn((command: "bold" | "italic") => { applied[command] = !applied[command]; });
    vi.stubGlobal("document", {
      getSelection: () => selection,
      addEventListener: (_: string, listener: () => void) => { selectionChanged = listener; },
      removeEventListener,
      queryCommandState: (command: "bold" | "italic") => applied[command],
      queryCommandIndeterm: (command: "bold" | "italic") => mixed[command],
      execCommand,
    });
    vi.spyOn(noteService, "serializeNoteEditorHtmlToMarkdown").mockReturnValue("첫 문장");
    const editor = { innerHTML: "", contains: (node: unknown) => node === textNode, focus: vi.fn() };
    act(() => {
      renderer = create(<WindowsMemoPanel {...props} />, {
        createNodeMock: (element) => element.props["aria-label"] === "메모 내용" ? editor : null,
      });
    });
    const button = (label: string) => renderer!.root.findByProps({ "aria-label": label });
    act(() => selectionChanged());
    expect(button("굵게").props["aria-pressed"]).toBe(true);
    expect(button("기울임").props["aria-pressed"]).toBe(false);

    const preventDefault = vi.fn();
    act(() => button("메모 내용").props.onKeyDown({ ctrlKey: true, key: "b", preventDefault }));
    expect(preventDefault).toHaveBeenCalledOnce();
    expect(execCommand).toHaveBeenCalledWith("bold");
    expect(selection.addRange).toHaveBeenCalledWith(range);
    expect(button("굵게").props["aria-pressed"]).toBe(false);
    expect(props.onChangeContent).toHaveBeenCalledWith("첫 문장");

    act(() => { applied.italic = true; mixed.bold = true; selectionChanged(); });
    expect(button("기울임").props["aria-pressed"]).toBe(true);
    expect(button("굵게").props["aria-pressed"]).toBe("mixed");
    // Moving the caret changes state without writing the note again.
    expect(props.onChangeContent).toHaveBeenCalledOnce();
    act(() => renderer!.update(<WindowsMemoPanel {...props} selectedNoteId="b" selectedNote={props.notes[1]} />));
    expect(button("굵게").props["aria-pressed"]).toBe(false);
    expect(button("기울임").props["aria-pressed"]).toBe(false);
    expect(removeEventListener).toHaveBeenCalledWith("selectionchange", expect.any(Function));
  });

  it("preserves the live editor on its own save echo while still applying external content changes", () => {
    const props = fixture();
    vi.stubGlobal("document", { getSelection: () => null, addEventListener: vi.fn(), removeEventListener: vi.fn() });
    vi.spyOn(noteService, "serializeNoteEditorHtmlToMarkdown").mockReturnValue("**수정 내용**");
    const editor = { innerHTML: "" };
    act(() => { renderer = create(<WindowsMemoPanel {...props} />, {
      createNodeMock: (element) => element.props["aria-label"] === "메모 내용" ? editor : null,
    }); });
    const browserMarkup = "<div><b>수정 내용</b></div>";
    editor.innerHTML = browserMarkup;
    act(() => renderer!.root.findByProps({ "aria-label": "메모 내용" }).props.onInput());
    expect(props.onChangeContent).toHaveBeenCalledWith("**수정 내용**");
    act(() => renderer!.update(<WindowsMemoPanel {...props} selectedNote={{ ...props.notes[0], content: "**수정 내용**" }} />));
    expect(editor.innerHTML).toBe(browserMarkup);
    act(() => renderer!.update(<WindowsMemoPanel {...props} selectedNote={{ ...props.notes[0], content: "다른 기기의 변경" }} />));
    expect(editor.innerHTML).toBe(noteService.renderNoteContentHtml("다른 기기의 변경"));
    act(() => renderer!.update(<WindowsMemoPanel {...props} selectedNote={{ ...props.notes[0], content: "**수정 내용**" }} />));
    expect(editor.innerHTML).toBe(noteService.renderNoteContentHtml("**수정 내용**"));
  });

  it("keeps Korean composition intact until it ends, including when a remote edit arrives", () => {
    const props = fixture();
    vi.stubGlobal("document", { getSelection: () => null, addEventListener: vi.fn(), removeEventListener: vi.fn() });
    const serialize = vi.spyOn(noteService, "serializeNoteEditorHtmlToMarkdown").mockReturnValue("완성된 한글");
    const editor = { innerHTML: "" };
    act(() => { renderer = create(<WindowsMemoPanel {...props} />, { createNodeMock: (element) => element.props.contentEditable ? editor : null }); });
    const field = () => renderer!.root.findByProps({ contentEditable: true });
    act(() => field().props.onCompositionStart?.());
    editor.innerHTML = "<div>조합 중인 한글</div>";
    act(() => field().props.onInput());
    expect(serialize).not.toHaveBeenCalled();
    expect(props.onChangeContent).not.toHaveBeenCalled();
    act(() => renderer!.update(<WindowsMemoPanel {...props} selectedNote={{ ...props.notes[0], content: "다른 기기의 변경" }} />));
    expect(editor.innerHTML).toBe("<div>조합 중인 한글</div>");
    act(() => field().props.onCompositionEnd?.());
    expect(props.onChangeContent).toHaveBeenCalledExactlyOnceWith("완성된 한글");
  });
});
