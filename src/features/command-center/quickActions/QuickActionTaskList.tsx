import { FormEvent, useState } from "react";
import { CheckSquare, Plus } from "lucide-react";
import type { BackfillInput } from "../../../types";

interface QuickActionTaskListProps {
  backfillInput?: BackfillInput;
  selectedDate: string;
  onAddTask: (
    text: string,
    dueDate: string | null,
    dueTime: string | null,
    plannedDate?: string | null,
    backfillInput?: BackfillInput,
  ) => void;
}

export function QuickActionTaskList({
  backfillInput,
  selectedDate,
  onAddTask,
}: QuickActionTaskListProps) {
  const [draft, setDraft] = useState("");

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const text = draft.trim();

    if (!text) {
      return;
    }

    onAddTask(text, null, null, selectedDate, backfillInput);
    setDraft("");
  }

  return (
    <section className="rounded-md border border-slate-200 bg-white p-3 dark:border-neutral-800 dark:bg-black">
      <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-neutral-100">
        <CheckSquare className="h-4 w-4 text-sky-500" aria-hidden="true" />
        <span>할 일 추가</span>
      </div>

      <form onSubmit={handleSubmit} className="flex gap-2">
        <input
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && event.nativeEvent.isComposing) event.preventDefault();
          }}
          className="h-9 min-w-0 flex-1 rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-900 placeholder:text-slate-400 dark:border-neutral-800 dark:bg-black dark:text-neutral-100 dark:placeholder:text-neutral-500"
          placeholder="이 날짜에 할 일 추가"
          aria-label="추가할 할 일"
        />
        <button
          type="submit"
          className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-sky-700 text-white transition hover:bg-sky-800"
          title="할 일 추가"
          aria-label="할 일 추가"
        >
          <Plus className="h-4 w-4" aria-hidden="true" />
        </button>
      </form>
    </section>
  );
}
