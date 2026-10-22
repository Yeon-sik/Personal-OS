import { useEffect, useRef, useState } from "react";
import { ArrowLeft, Bold, Italic, Plus, Search } from "lucide-react";
import { MobileDeleteButton } from "../../components/MobileDeleteButton";
import type { MemoPanelProps } from "./MemoPanel";
import { getNoteDisplayTitle, getPlainTextFromNoteContent, renderNoteContentHtml, serializeNoteEditorHtmlToMarkdown } from "./noteService";

type FormatState = boolean | "mixed";

export function MobileMemoPanel({ notes, selectedNote, selectedNoteId, isLoading, onCreate, onDelete, onSelect, onChangeTitle, onChangeContent }: MemoPanelProps) {
  const [editing, setEditing] = useState(false);
  const [query, setQuery] = useState("");
  const [formatting, setFormatting] = useState<{ bold: FormatState; italic: FormatState }>({ bold: false, italic: false });
  const editorRef = useRef<HTMLDivElement>(null);
  const titleRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const editorNoteIdRef = useRef<string | null>(null);
  const localContentRef = useRef<{ noteId: string; content: string } | null>(null);
  const selectionRef = useRef<Range | null>(null);
  const composingRef = useRef(false);
  const creatingRef = useRef(false);
  const filteredNotes = notes.filter((note) => `${note.title} ${getPlainTextFromNoteContent(note.content)}`.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()));

  useEffect(() => {
    const editor = editorRef.current;
    if (!editing || !selectedNote || !editor) {
      editorNoteIdRef.current = null;
      localContentRef.current = null;
      composingRef.current = false;
      return;
    }
    // Do not let an old note's IME session block hydration of another note.
    if (editorNoteIdRef.current !== selectedNote.id) composingRef.current = false;
    if (composingRef.current) return;
    const localEcho = editorNoteIdRef.current === selectedNote.id
      && localContentRef.current?.noteId === selectedNote.id
      && localContentRef.current.content === selectedNote.content;
    const html = renderNoteContentHtml(selectedNote.content) || "<div><br /></div>";
    if (!localEcho && editor.innerHTML !== html) editor.innerHTML = html;
    if (!localEcho) localContentRef.current = null;
    editorNoteIdRef.current = selectedNote.id;
    if (creatingRef.current) { titleRef.current?.focus(); creatingRef.current = false; }
  }, [editing, selectedNoteId, selectedNote?.content, isLoading]);

  useEffect(() => {
    selectionRef.current = null;
    setFormatting({ bold: false, italic: false });
    document.addEventListener("selectionchange", updateFormatting);
    return () => document.removeEventListener("selectionchange", updateFormatting);
  }, [editing, selectedNoteId]);

  function updateFormatting() {
    const editor = editorRef.current;
    const selection = document.getSelection();
    if (!editor || !selection?.rangeCount || !editor.contains(selection.anchorNode) || !editor.contains(selection.focusNode)) return;
    selectionRef.current = selection.getRangeAt(0).cloneRange();
    const state = (command: "bold" | "italic"): FormatState => document.queryCommandIndeterm(command) ? "mixed" : document.queryCommandState(command);
    const next = { bold: state("bold"), italic: state("italic") };
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
    editor.focus();
    if (selectionRef.current && editor.contains(selectionRef.current.commonAncestorContainer)) {
      const selection = document.getSelection();
      selection?.removeAllRanges();
      selection?.addRange(selectionRef.current);
    }
    document.execCommand(command);
    syncContent();
    updateFormatting();
  }

  function createNote() { creatingRef.current = true; setEditing(true); setQuery(""); onCreate(); }
  function showList() {
    syncContent();
    setEditing(false);
    window.requestAnimationFrame(() => {
      const selected = Array.from(listRef.current?.querySelectorAll<HTMLButtonElement>("[data-note-id]") ?? []).find((button) => button.dataset.noteId === selectedNoteId);
      selected?.focus();
    });
  }

  return <section className="mobile-memo" aria-label="메모 작업 공간">
    <header className="mobile-panel-heading">
      {editing ? <button type="button" className="mobile-back" onClick={showList}><ArrowLeft size={20} aria-hidden="true" />목록</button> : <h2>메모 <span>{notes.length}</span></h2>}
      <button type="button" className="mobile-primary" onClick={createNote} aria-label="메모 추가"><Plus size={18} aria-hidden="true" />새 메모</button>
    </header>
    {isLoading ? <p className="mobile-empty" role="status">메모를 불러오는 중입니다.</p> : editing && selectedNote ? <div key={selectedNote.id} className="mobile-memo-editor">
      <label className="mobile-note-title">제목<input ref={titleRef} value={selectedNote.title} onChange={(event) => onChangeTitle(event.target.value)} placeholder="메모 제목" /></label>
      <div className="mobile-editor-toolbar" role="group" aria-label="메모 서식">
        <button type="button" aria-label="굵게" aria-pressed={formatting.bold} onMouseDown={(event) => event.preventDefault()} onClick={() => format("bold")}><Bold size={20} aria-hidden="true" /></button>
        <button type="button" aria-label="기울임" aria-pressed={formatting.italic} onMouseDown={(event) => event.preventDefault()} onClick={() => format("italic")}><Italic size={20} aria-hidden="true" /></button>
        <span>자동 저장</span>
      </div>
      <div className="mobile-note-scroll">
        <div ref={editorRef} contentEditable suppressContentEditableWarning role="textbox" aria-multiline="true" aria-label="메모 내용" className="mobile-note-content"
          onInput={() => { syncContent(); updateFormatting(); }} onBlur={syncContent} onFocus={updateFormatting}
          onCompositionStart={() => { composingRef.current = true; }} onCompositionEnd={() => { if (!composingRef.current) return; composingRef.current = false; syncContent(); updateFormatting(); }}
          onKeyDown={(event) => {
            if (!event.nativeEvent.isComposing && (event.ctrlKey || event.metaKey) && ["b", "i"].includes(event.key.toLowerCase())) {
              event.preventDefault(); format(event.key.toLowerCase() === "b" ? "bold" : "italic");
            }
          }} />
        <footer className="mobile-note-footer"><time dateTime={selectedNote.updatedAt}>수정 {new Intl.DateTimeFormat("ko-KR", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date(selectedNote.updatedAt))}</time>
          <MobileDeleteButton key={selectedNote.id} label="메모 삭제" itemName={getNoteDisplayTitle(selectedNote)} onDelete={() => { onDelete(selectedNote.id); setEditing(false); }} />
        </footer>
      </div>
    </div> : <div className="mobile-note-list" ref={listRef}>
      <label className="mobile-note-search"><Search size={18} aria-hidden="true" /><span className="sr-only">메모 검색</span><input type="search" value={query} placeholder="제목 또는 내용 검색" onChange={(event) => setQuery(event.target.value)} /></label>
      <div className="mobile-note-results">
        {filteredNotes.map((note) => <button type="button" key={note.id} data-note-id={note.id} aria-current={note.id === selectedNoteId ? "true" : undefined} className="mobile-note-item" onClick={() => { onSelect(note.id); setEditing(true); }}>
          <strong>{getNoteDisplayTitle(note)}</strong><span>{getPlainTextFromNoteContent(note.content) || "내용을 작성해 보세요."}</span><time dateTime={note.updatedAt}>{new Intl.DateTimeFormat("ko-KR", { month: "short", day: "numeric" }).format(new Date(note.updatedAt))}</time>
        </button>)}
        {!notes.length ? <div className="mobile-empty"><h3>첫 메모를 남겨보세요</h3><p>작성한 내용은 이 기기에 자동으로 저장됩니다.</p><button type="button" className="mobile-primary" onClick={createNote}>메모 작성</button></div> : !filteredNotes.length ? <div className="mobile-empty"><p>검색 결과가 없습니다.</p><button type="button" onClick={() => setQuery("")}>검색 지우기</button></div> : null}
      </div>
    </div>}
  </section>;
}
