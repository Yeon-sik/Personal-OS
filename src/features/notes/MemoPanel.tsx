import { Clock3, Plus, StickyNote, Trash2 } from "lucide-react";
import { useEffect, useRef } from "react";
import { useWindowsDesktop } from "../../app/WindowsDesktopContext";
import { WindowsMemoPanel } from "./WindowsMemoPanel";
import { useMobileLayout } from "../../app/MobileLayoutContext";
import { MobileMemoPanel } from "./MobileMemoPanel";
import type { Note } from "../../types";
import {
  getNoteDisplayTitle,
  getPlainTextFromNoteContent,
  renderNoteContentHtml,
  serializeNoteEditorHtmlToMarkdown,
} from "./noteService";

export interface MemoPanelProps {
  notes: Note[];
  selectedNote: Note | null;
  selectedNoteId: string | null;
  isLoading: boolean;
  onCreate: () => void;
  onDelete: (noteId: string) => void;
  onSelect: (noteId: string) => void;
  onChangeTitle: (title: string) => void;
  onChangeContent: (content: string) => void;
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("ko-KR", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

export function MemoPanel(props: MemoPanelProps) {
  const windowsDesktop = useWindowsDesktop();
  const mobileLayout = useMobileLayout();
  return windowsDesktop ? <WindowsMemoPanel {...props} /> : mobileLayout ? <MobileMemoPanel {...props} /> : <CompactMemoPanel {...props} />;
}

function CompactMemoPanel({
  notes,
  selectedNote,
  selectedNoteId,
  isLoading,
  onCreate,
  onDelete,
  onSelect,
  onChangeTitle,
  onChangeContent,
}: MemoPanelProps) {
  const editorRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!selectedNote || !editorRef.current) {
      return;
    }

    const nextHtml = renderNoteContentHtml(selectedNote.content) || "<div><br /></div>";

    if (editorRef.current.innerHTML !== nextHtml) {
      editorRef.current.innerHTML = nextHtml;
    }
  }, [selectedNoteId, selectedNote?.content]);

  function syncEditorContent() {
    if (!selectedNote || !editorRef.current) {
      return;
    }

    const nextContent = serializeNoteEditorHtmlToMarkdown(editorRef.current.innerHTML);

    if (nextContent !== selectedNote.content) {
      onChangeContent(nextContent);
    }
  }

  function applyInlineFormat(command: "bold" | "italic") {
    if (!editorRef.current) {
      return;
    }

    editorRef.current.focus();
    document.execCommand(command);
    syncEditorContent();
  }

  function handleEditorKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    if (!(event.ctrlKey || event.metaKey)) {
      return;
    }

    const key = event.key.toLowerCase();

    if (key === "b") {
      event.preventDefault();
      applyInlineFormat("bold");
      return;
    }

    if (key === "i") {
      event.preventDefault();
      applyInlineFormat("italic");
    }
  }

  return (
    <section className="flex min-h-0 flex-col overflow-hidden rounded-md border border-slate-300 bg-white dark:border-neutral-800 dark:bg-black">
      <div className="flex h-11 shrink-0 items-center justify-between border-b border-slate-200 px-3 dark:border-neutral-800">
        <div className="flex min-w-0 items-center gap-2 text-sm font-semibold text-slate-900 dark:text-neutral-100">
          <StickyNote className="h-4 w-4 shrink-0 text-teal-700 dark:text-teal-300" aria-hidden="true" />
          <span className="truncate">메모</span>
          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] text-slate-500 dark:bg-neutral-900 dark:text-neutral-300">
            {notes.length}
          </span>
        </div>
        <button
          type="button"
          onClick={onCreate}
          className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-teal-700 text-white transition hover:bg-teal-800"
          title="메모 추가"
          aria-label="메모 추가"
        >
          <Plus className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>

      {isLoading ? (
        <div className="m-3 rounded-md border border-slate-200 bg-slate-50 px-3 py-4 text-sm text-slate-500 dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-400">
          로컬 데이터를 불러오는 중입니다.
        </div>
      ) : notes.length === 0 ? (
        <div className="m-3 flex flex-1 items-center justify-center rounded-md border border-dashed border-slate-300 bg-slate-50 px-4 text-center text-sm text-slate-500 dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-400">
          아직 메모가 없습니다.
        </div>
      ) : (
        <div className="flex min-h-0 flex-1 flex-col">
          <div className="max-h-44 shrink-0 overflow-y-auto border-b border-slate-200 p-2 dark:border-neutral-800">
            <div className="space-y-1.5">
              {notes.map((note) => {
                const isSelected = note.id === selectedNoteId;

                return (
                  <div
                    key={note.id}
                    className={
                      isSelected
                        ? "group flex items-start gap-2 rounded-md border border-teal-200 bg-teal-50 px-2 py-2 dark:border-teal-800 dark:bg-teal-950/50"
                        : "group flex items-start gap-2 rounded-md border border-transparent px-2 py-2 transition hover:border-slate-200 hover:bg-slate-50 dark:hover:border-neutral-800 dark:hover:bg-neutral-900"
                    }
                  >
                    <button
                      type="button"
                      onClick={() => onSelect(note.id)}
                      className="min-w-0 flex-1 text-left"
                    >
                      <div className="truncate text-xs font-semibold text-slate-900 dark:text-neutral-100">
                        {getNoteDisplayTitle(note)}
                      </div>
                      <div className="mt-1 line-clamp-2 text-[11px] leading-4 text-slate-500 dark:text-neutral-400">
                        {getPlainTextFromNoteContent(note.content) || "내용 없음"}
                      </div>
                    </button>
                    <button
                      type="button"
                      onClick={() => onDelete(note.id)}
                      className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-slate-400 opacity-0 transition hover:bg-red-50 hover:text-red-700 group-hover:opacity-100 dark:text-neutral-500 dark:hover:bg-red-950/50 dark:hover:text-red-300"
                      title="메모 삭제"
                      aria-label="메모 삭제"
                    >
                      <Trash2 className="h-4 w-4" aria-hidden="true" />
                    </button>
                  </div>
                );
              })}
            </div>
          </div>

          {selectedNote ? (
            <div className="flex min-h-0 flex-1 flex-col">
              <div className="border-b border-slate-200 px-3 py-2 dark:border-neutral-800">
                <input
                  value={selectedNote.title}
                  onChange={(event) => onChangeTitle(event.target.value)}
                  className="w-full border-0 bg-transparent text-sm font-semibold text-slate-950 placeholder:text-slate-400 focus:outline-none dark:text-neutral-50 dark:placeholder:text-neutral-500"
                  placeholder="메모 제목"
                  aria-label="메모 제목"
                />
                <div className="mt-1 flex min-w-0 items-center gap-1.5 text-[10px] text-slate-500 dark:text-neutral-400">
                  <Clock3 className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                  <span className="truncate">{formatDate(selectedNote.updatedAt)}</span>
                </div>
              </div>
              <div className="border-b border-slate-200 px-3 py-2 dark:border-neutral-800">
                <div className="flex flex-wrap items-center gap-1.5">
                  <button
                    type="button"
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => applyInlineFormat("bold")}
                    className="inline-flex h-7 min-w-7 items-center justify-center rounded-md border border-slate-300 px-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 dark:border-neutral-700 dark:text-neutral-200 dark:hover:bg-neutral-900"
                    aria-label="굵게"
                    title="굵게 (Ctrl+B)"
                  >
                    B
                  </button>
                  <button
                    type="button"
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => applyInlineFormat("italic")}
                    className="inline-flex h-7 min-w-7 items-center justify-center rounded-md border border-slate-300 px-2 text-xs italic text-slate-700 transition hover:bg-slate-50 dark:border-neutral-700 dark:text-neutral-200 dark:hover:bg-neutral-900"
                    aria-label="기울임"
                    title="기울임 (Ctrl+I)"
                  >
                    I
                  </button>
                </div>
              </div>
              <div
                ref={editorRef}
                contentEditable
                suppressContentEditableWarning
                onInput={syncEditorContent}
                onBlur={syncEditorContent}
                onKeyDown={handleEditorKeyDown}
                className="min-h-0 flex-1 overflow-y-auto bg-white px-3 py-3 text-left text-sm leading-6 text-slate-800 focus:outline-none dark:bg-black dark:text-neutral-200 [&_strong]:font-semibold [&_em]:italic"
                aria-label="메모 내용"
              />
            </div>
          ) : (
            <div className="m-3 flex flex-1 items-center justify-center rounded-md border border-dashed border-slate-300 bg-slate-50 px-4 text-center text-sm text-slate-500 dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-400">
              선택된 메모가 없습니다.
            </div>
          )}
        </div>
      )}
    </section>
  );
}
