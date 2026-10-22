import { useEffect, useRef, useState } from "react";
import { Bold, Italic, Plus, Search, StickyNote, Trash2 } from "lucide-react";
import type { MemoPanelProps } from "./MemoPanel";
import { getNoteDisplayTitle, getPlainTextFromNoteContent, renderNoteContentHtml, serializeNoteEditorHtmlToMarkdown } from "./noteService";

type FormatState = boolean | "mixed";
const emptyFormatting = { bold: false, italic: false } as const;

export function WindowsMemoPanel({ notes, selectedNote, selectedNoteId, isLoading, onCreate, onDelete, onSelect, onChangeTitle, onChangeContent }: MemoPanelProps) {
  const [query, setQuery] = useState("");
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const editorRef = useRef<HTMLDivElement>(null);
  const titleRef = useRef<HTMLInputElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const deleteTriggerRef = useRef<HTMLElement | null>(null);
  const pendingTitleFocus = useRef(false);
  const editorNoteIdRef = useRef<string | null>(null);
  const localContentRef = useRef<{ noteId: string; content: string } | null>(null);
  const composingRef = useRef(false);
  const savedSelectionRef = useRef<Range | null>(null);
  const [formatting, setFormatting] = useState<{ bold: FormatState; italic: FormatState }>(emptyFormatting);
  const deleteNote = notes.find((note) => note.id === deleteId);
  const filteredNotes = notes.filter((note) => `${note.title} ${getPlainTextFromNoteContent(note.content)}`.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()));

  useEffect(() => {
    if (!selectedNote || !editorRef.current) {
      editorNoteIdRef.current = null;
      localContentRef.current = null;
      composingRef.current = false;
      return;
    }
    // A remote selection change ends the old editor session, even during IME.
    if (editorNoteIdRef.current !== selectedNote.id) composingRef.current = false;
    if (composingRef.current) return;
    const html = renderNoteContentHtml(selectedNote.content) || "<div><br /></div>";
    const isLocalEcho = editorNoteIdRef.current === selectedNote.id
      && localContentRef.current?.noteId === selectedNote.id
      && localContentRef.current.content === selectedNote.content;
    // Replacing equivalent browser markup on every save destroys the selection
    // and undo history. Still hydrate note switches and external content changes.
    if (!isLocalEcho && editorRef.current.innerHTML !== html) editorRef.current.innerHTML = html;
    if (!isLocalEcho) localContentRef.current = null;
    editorNoteIdRef.current = selectedNote.id;
    if (pendingTitleFocus.current) {
      titleRef.current?.focus();
      pendingTitleFocus.current = false;
    }
  }, [selectedNoteId, selectedNote?.content, isLoading]);

  useEffect(() => {
    if (deleteId) cancelRef.current?.focus();
  }, [deleteId]);

  useEffect(() => {
    savedSelectionRef.current = null;
    setFormatting(emptyFormatting);
    if (typeof document === "undefined") return;
    document.addEventListener("selectionchange", updateFormatting);
    return () => document.removeEventListener("selectionchange", updateFormatting);
  }, [selectedNoteId]);

  function updateFormatting() {
    const editor = editorRef.current;
    const selection = document.getSelection();
    if (!editor || !selection?.rangeCount || !editor.contains(selection.anchorNode) || !editor.contains(selection.focusNode)) return;
    savedSelectionRef.current = selection.getRangeAt(0).cloneRange();
    const readState = (command: "bold" | "italic"): FormatState =>
      document.queryCommandIndeterm(command) ? "mixed" : document.queryCommandState(command);
    const next = { bold: readState("bold"), italic: readState("italic") };
    setFormatting((current) => current.bold === next.bold && current.italic === next.italic ? current : next);
  }

  function syncContent() {
    if (!selectedNote || !editorRef.current || composingRef.current || editorNoteIdRef.current !== selectedNote.id) return;
    const content = serializeNoteEditorHtmlToMarkdown(editorRef.current.innerHTML);
    if (content !== selectedNote.content) {
      localContentRef.current = { noteId: selectedNote.id, content };
      onChangeContent(content);
    }
  }

  function format(command: "bold" | "italic") {
    const editor = editorRef.current;
    if (!editor || composingRef.current) return;
    const savedSelection = savedSelectionRef.current;
    editor.focus();
    // Tab can move focus to the toolbar. Restore the editor selection first.
    if (savedSelection && editor.contains(savedSelection.commonAncestorContainer)) {
      const selection = document.getSelection();
      selection?.removeAllRanges();
      selection?.addRange(savedSelection);
    }
    document.execCommand(command);
    syncContent();
    updateFormatting();
  }

  function createNote() {
    setQuery("");
    pendingTitleFocus.current = true;
    onCreate();
  }

  function cancelDelete() {
    setDeleteId(null);
    deleteTriggerRef.current?.focus();
  }

  return (
    <section className="win-memo" aria-label="메모 작업 공간">
      <header className="win-memo-heading">
        <h2><StickyNote size={17} aria-hidden="true" />메모 <span className="win-count">{notes.length}</span></h2>
        <button type="button" className="win-button win-primary" onClick={createNote} aria-label="메모 추가"><Plus size={16} aria-hidden="true" />새 메모</button>
      </header>
      {isLoading ? <p className="win-empty" role="status">로컬 데이터를 불러오는 중입니다.</p> : notes.length === 0 ? (
        <div className="win-empty"><StickyNote size={28} aria-hidden="true" /><h3>첫 메모를 남겨보세요</h3><p>작성한 내용은 이 기기에 자동으로 저장됩니다.</p><button type="button" className="win-button win-primary" onClick={createNote}>메모 작성</button></div>
      ) : <>
        <div className="win-memo-compact-picker">
          <label htmlFor="windows-note-picker">메모 선택</label>
          <select id="windows-note-picker" value={selectedNoteId ?? ""} onChange={(event) => onSelect(event.target.value)}>
            {!selectedNoteId ? <option value="">메모를 선택하세요</option> : null}
            {notes.map((note) => <option key={note.id} value={note.id}>{getNoteDisplayTitle(note)}</option>)}
          </select>
        </div>
        <div className="win-memo-body">
          <aside className="win-memo-list" aria-label="메모 목록">
            <label className="win-note-search"><Search size={16} aria-hidden="true" /><input aria-label="메모 검색" placeholder="제목 또는 내용 검색" value={query} onChange={(event) => setQuery(event.target.value)} /></label>
            <div className="win-note-results">
              {filteredNotes.map((note) => <button type="button" className="win-note-item" key={note.id} aria-current={note.id === selectedNoteId ? "true" : undefined} onClick={() => onSelect(note.id)}>
                <strong>{getNoteDisplayTitle(note)}</strong><span>{getPlainTextFromNoteContent(note.content) || "내용 없음"}</span>
                <time dateTime={note.updatedAt}>{new Intl.DateTimeFormat("ko-KR", { month: "short", day: "numeric" }).format(new Date(note.updatedAt))}</time>
              </button>)}
              {filteredNotes.length === 0 ? <div className="win-empty"><p>검색 결과가 없습니다.</p><button type="button" className="win-button" onClick={() => setQuery("")}>검색 지우기</button></div> : null}
            </div>
          </aside>
          {selectedNote ? <div key={selectedNote.id} className="win-memo-editor">
            <div className="win-memo-title-row">
              <label className="sr-only" htmlFor="windows-note-title">메모 제목</label>
              <input id="windows-note-title" ref={titleRef} value={selectedNote.title} onChange={(event) => onChangeTitle(event.target.value)} placeholder="메모 제목" />
              <button type="button" className="win-button win-icon-button" aria-label="메모 삭제" title="메모 삭제" onClick={(event) => { deleteTriggerRef.current = event.currentTarget; setDeleteId(selectedNote.id); }}><Trash2 size={17} aria-hidden="true" /></button>
            </div>
            <div className="win-editor-toolbar" role="group" aria-label="메모 서식">
              <button type="button" className="win-button win-icon-button" onMouseDown={(event) => event.preventDefault()} onClick={() => format("bold")} aria-label="굵게" aria-pressed={formatting.bold} title="굵게 (Ctrl+B)"><Bold size={16} aria-hidden="true" /></button>
              <button type="button" className="win-button win-icon-button" onMouseDown={(event) => event.preventDefault()} onClick={() => format("italic")} aria-label="기울임" aria-pressed={formatting.italic} title="기울임 (Ctrl+I)"><Italic size={16} aria-hidden="true" /></button>
              <time dateTime={selectedNote.updatedAt}>수정 {new Intl.DateTimeFormat("ko-KR", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date(selectedNote.updatedAt))}</time>
            </div>
            <div className="win-note-scroll"><div ref={editorRef} role="textbox" aria-multiline="true" aria-label="메모 내용" contentEditable suppressContentEditableWarning className="win-note-content" onInput={() => { syncContent(); updateFormatting(); }} onFocus={updateFormatting} onBlur={syncContent}
              onCompositionStart={() => { composingRef.current = true; }} onCompositionEnd={() => { if (!composingRef.current) return; composingRef.current = false; syncContent(); updateFormatting(); }}
              onKeyDown={(event) => {
              if (event.nativeEvent?.isComposing || composingRef.current) return;
              if (!(event.ctrlKey || event.metaKey)) return;
              const key = event.key.toLowerCase();
              if (key === "b" || key === "i") { event.preventDefault(); format(key === "b" ? "bold" : "italic"); }
            }} /></div>
          </div> : <p className="win-empty">목록에서 메모를 선택하세요.</p>}
        </div>
      </>}
      {deleteId ? <div className="win-delete-confirm" role="group" aria-label="메모 삭제 확인" onKeyDown={(event) => { if (event.key === "Escape") { event.preventDefault(); cancelDelete(); } }}>
        <p><strong>{deleteNote ? getNoteDisplayTitle(deleteNote) : "선택한"}</strong> 메모를 삭제할까요?</p>
        <div><button ref={cancelRef} type="button" className="win-button" onClick={cancelDelete}>취소</button><button type="button" className="win-button win-danger" onClick={() => { onDelete(deleteId); setDeleteId(null); titleRef.current?.focus(); }}>삭제</button></div>
      </div> : null}
    </section>
  );
}
