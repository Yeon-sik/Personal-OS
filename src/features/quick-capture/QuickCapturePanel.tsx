import {
  KeyboardEvent,
  useEffect,
  useRef,
  useState,
} from "react";
import {
  CheckSquare,
  Send,
  StickyNote,
  X,
} from "lucide-react";
import type { DesktopQuickCaptureShortcutStatus } from "../../lib/desktop/quickCapture";
import type { QuickCaptureMode } from "./quickCaptureParser";

interface QuickCapturePanelProps {
  isOpen: boolean;
  mode: QuickCaptureMode;
  shortcutStatus: DesktopQuickCaptureShortcutStatus;
  onClose: () => void;
  onModeChange: (mode: QuickCaptureMode) => void;
  onSave: (draft: string, mode: QuickCaptureMode) => boolean;
}

function getShortcutLabel(status: DesktopQuickCaptureShortcutStatus): string {
  if (!status.supported) {
    return "Ctrl+K";
  }

  return status.registered ? status.shortcut : "사용 불가";
}

function getFocusableElements(container: HTMLElement): HTMLElement[] {
  return Array.from(
    container.querySelectorAll<HTMLElement>(
      'button, textarea, input, select, a[href], [tabindex]:not([tabindex="-1"])',
    ),
  ).filter((element) => !element.hasAttribute("disabled"));
}

export function QuickCapturePanel({
  isOpen,
  mode,
  shortcutStatus,
  onClose,
  onModeChange,
  onSave,
}: QuickCapturePanelProps) {
  const [draft, setDraft] = useState("");
  const [saveError, setSaveError] = useState<string | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    setSaveError(null);
    window.requestAnimationFrame(() => {
      inputRef.current?.focus();
    });
  }, [isOpen]);

  if (!isOpen) {
    return null;
  }

  function submitDraft() {
    try {
      const saved = onSave(draft, mode);

      if (!saved) {
        setSaveError("입력 내용을 확인하세요.");
        return;
      }

      setDraft("");
      setSaveError(null);
    } catch {
      setSaveError("로컬 저장 실패");
    }
  }

  function handlePanelKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === "Escape") {
      event.preventDefault();
      onClose();
      return;
    }

    if (
      event.key === "Enter" &&
      !event.shiftKey &&
      !event.nativeEvent.isComposing
    ) {
      event.preventDefault();
      submitDraft();
      return;
    }

    if (event.key !== "Tab" || !panelRef.current) {
      return;
    }

    const focusableElements = getFocusableElements(panelRef.current);
    const firstElement = focusableElements[0];
    const lastElement = focusableElements[focusableElements.length - 1];

    if (!firstElement || !lastElement) {
      return;
    }

    if (event.shiftKey && document.activeElement === firstElement) {
      event.preventDefault();
      lastElement.focus();
    } else if (!event.shiftKey && document.activeElement === lastElement) {
      event.preventDefault();
      firstElement.focus();
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-3 backdrop-blur-sm max-sm:items-end max-sm:p-0"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label="빠른 입력"
        onKeyDown={handlePanelKeyDown}
        className="w-full max-w-[420px] rounded-lg border border-white/10 bg-neutral-950/95 p-3 text-white shadow-2xl shadow-black/50 backdrop-blur-xl max-sm:rounded-b-none max-sm:rounded-t-lg max-sm:pb-[calc(0.75rem+var(--app-safe-bottom))]"
      >
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="text-sm font-semibold tracking-normal">
              빠른 입력
            </div>
            <div className="mt-0.5 truncate text-[11px] text-neutral-400">
              {getShortcutLabel(shortcutStatus)}
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-neutral-400 transition hover:bg-white/10 hover:text-white"
            aria-label="닫기"
            title="닫기"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        <div className="mt-3 grid grid-cols-2 rounded-md border border-white/10 bg-black p-1">
          <button
            type="button"
            onClick={() => onModeChange("task")}
            className={
              mode === "task"
                ? "inline-flex h-9 items-center justify-center gap-2 rounded-md bg-white text-xs font-semibold text-black"
                : "inline-flex h-9 items-center justify-center gap-2 rounded-md text-xs font-semibold text-neutral-400 transition hover:bg-white/10 hover:text-white"
            }
            aria-pressed={mode === "task"}
          >
            <CheckSquare className="h-4 w-4" aria-hidden="true" />
            <span>할 일</span>
          </button>
          <button
            type="button"
            onClick={() => onModeChange("memo")}
            className={
              mode === "memo"
                ? "inline-flex h-9 items-center justify-center gap-2 rounded-md bg-white text-xs font-semibold text-black"
                : "inline-flex h-9 items-center justify-center gap-2 rounded-md text-xs font-semibold text-neutral-400 transition hover:bg-white/10 hover:text-white"
            }
            aria-pressed={mode === "memo"}
          >
            <StickyNote className="h-4 w-4" aria-hidden="true" />
            <span>메모</span>
          </button>
        </div>

        <textarea
          ref={inputRef}
          value={draft}
          onChange={(event) => {
            setDraft(event.target.value);
            setSaveError(null);
          }}
          rows={5}
          className="mt-3 min-h-32 w-full resize-none rounded-md border border-white/10 bg-black px-3 py-3 text-sm leading-6 text-white outline-none transition placeholder:text-neutral-600 focus:border-teal-400 focus:ring-2 focus:ring-teal-400/20"
          placeholder={mode === "memo" ? "메모 입력" : "할 일 입력"}
        />

        <div className="mt-3 flex min-h-9 items-center gap-2">
          <div className="min-w-0 flex-1 text-xs text-red-300">
            {saveError}
          </div>
          <button
            type="button"
            onClick={submitDraft}
            className="inline-flex h-9 shrink-0 items-center justify-center gap-2 rounded-md bg-teal-400 px-3 text-sm font-semibold text-black transition hover:bg-teal-300"
          >
            <Send className="h-4 w-4" aria-hidden="true" />
            <span>저장</span>
          </button>
        </div>
      </div>
    </div>
  );
}
