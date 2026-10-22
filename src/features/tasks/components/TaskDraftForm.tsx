import type {
  FocusEvent as ReactFocusEvent,
  FormEvent,
  RefObject,
} from "react";
import { CalendarDays, Clock3 } from "lucide-react";
import { useMobileLayout } from "../../../app/MobileLayoutContext";

export type DraftMode = "today" | "deadline";

interface TaskDraftFormProps {
  draft: string;
  draftDueDate: string;
  draftDueTime: string;
  draftMode: DraftMode;
  inputRef: RefObject<HTMLInputElement>;
  isVisible: boolean;
  onBlur: (event: ReactFocusEvent<HTMLFormElement>) => void;
  onDraftChange: (value: string) => void;
  onDraftDueDateChange: (value: string) => void;
  onDraftDueTimeChange: (value: string) => void;
  onDraftModeChange: (mode: DraftMode) => void;
  onSubmitDraft?: () => void;
}

export function TaskDraftForm({
  draft,
  draftDueDate,
  draftDueTime,
  draftMode,
  inputRef,
  isVisible,
  onBlur,
  onDraftChange,
  onDraftDueDateChange,
  onDraftDueTimeChange,
  onDraftModeChange,
  onSubmitDraft,
}: TaskDraftFormProps) {
  const mobileLayout = useMobileLayout();
  if (!isVisible) return null;
  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (draft.trim()) onSubmitDraft?.();
  }

  return (
    <form
      onSubmit={handleSubmit}
      onBlur={onBlur}
      className="shrink-0 border-b border-slate-200 bg-slate-50 p-2 dark:border-neutral-800 dark:bg-neutral-950"
    >
      <div className="mb-2 grid grid-cols-2 gap-1 rounded-md border border-slate-200 bg-white p-1 dark:border-neutral-800 dark:bg-black">
        <button
          type="button"
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => onDraftModeChange("today")}
          aria-pressed={mobileLayout ? draftMode === "today" : undefined}
          className={
            draftMode === "today"
              ? "h-8 rounded-md bg-fuchsia-600 text-xs font-semibold text-white"
              : "h-8 rounded-md text-xs font-semibold text-slate-500 transition hover:bg-slate-100 dark:text-neutral-400 dark:hover:bg-neutral-900"
          }
        >
          오늘 할 일
        </button>
        <button
          type="button"
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => onDraftModeChange("deadline")}
          aria-pressed={mobileLayout ? draftMode === "deadline" : undefined}
          className={
            draftMode === "deadline"
              ? "h-8 rounded-md bg-sky-700 text-xs font-semibold text-white"
              : "h-8 rounded-md text-xs font-semibold text-slate-500 transition hover:bg-slate-100 dark:text-neutral-400 dark:hover:bg-neutral-900"
          }
        >
          기한 내 할 일
        </button>
      </div>
      <label htmlFor="task-draft" className={mobileLayout ? "mobile-draft-label" : "sr-only"}>
        할 일
      </label>
      <input
        ref={inputRef}
        id="task-draft"
        value={draft}
        onChange={(event) => onDraftChange(event.target.value)}
        className="h-9 w-full rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none dark:border-neutral-800 dark:bg-black dark:text-neutral-100 dark:placeholder:text-neutral-500"
        placeholder={
          draftMode === "today" ? "오늘 실제로 할 일" : "마감일이 있는 할 일"
        }
        enterKeyHint={mobileLayout ? "done" : undefined}
        onKeyDown={(event) => { if (event.key === "Enter" && event.nativeEvent.isComposing) event.preventDefault(); }}
      />
      {draftMode === "deadline" ? (
        <div className="mt-2 grid grid-cols-1 gap-1.5">
          <label className="flex min-w-0 items-center gap-1.5 rounded-md border border-slate-200 bg-white px-2 text-[11px] text-slate-500 dark:border-neutral-800 dark:bg-black dark:text-neutral-400">
            <CalendarDays
              className="h-3.5 w-3.5 shrink-0"
              aria-hidden="true"
            />
            <span className="sr-only">마감일</span>
            <input
              type="date"
              value={draftDueDate}
              onInput={(event) =>
                onDraftDueDateChange(event.currentTarget.value)
              }
              onChange={(event) => onDraftDueDateChange(event.target.value)}
              className="h-8 min-w-0 flex-1 border-0 bg-transparent text-[11px] text-slate-700 focus:outline-none dark:text-neutral-200"
              aria-label="추가할 할 일 마감일"
            />
          </label>

          <label className="flex min-w-0 items-center gap-1 rounded-md border border-slate-200 bg-white px-2 text-[11px] text-slate-500 dark:border-neutral-800 dark:bg-black dark:text-neutral-400">
            <Clock3
              className="h-3.5 w-3.5 shrink-0"
              aria-hidden="true"
            />
            <span className="sr-only">마감 시간</span>
            <input
              type="time"
              value={draftDueTime}
              disabled={!draftDueDate}
              onInput={(event) =>
                onDraftDueTimeChange(event.currentTarget.value)
              }
              onChange={(event) => onDraftDueTimeChange(event.target.value)}
              className="h-8 min-w-0 flex-1 border-0 bg-transparent text-[11px] text-slate-700 focus:outline-none disabled:cursor-not-allowed disabled:text-slate-400 dark:text-neutral-200 dark:disabled:text-neutral-600"
              aria-label="추가할 할 일 마감 시간"
            />
          </label>
        </div>
      ) : null}
      <button type="submit" className={mobileLayout ? "mobile-primary mobile-draft-submit" : "win-button win-primary mt-2 w-full rounded-md bg-indigo-700 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50"} disabled={!draft.trim()}>할 일 저장</button>
    </form>
  );
}
