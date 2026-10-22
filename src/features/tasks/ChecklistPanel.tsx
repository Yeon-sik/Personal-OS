import {
  type FocusEvent as ReactFocusEvent,
  type PointerEvent as ReactPointerEvent,
  useEffect,
  useRef,
  useState,
} from "react";
import { Check, CheckSquare, Plus } from "lucide-react";
import type { Task } from "../../types";
import { formatLocalDate } from "../fitness/fitnessDate";
import { ChecklistTaskList } from "./components/ChecklistTaskList";
import {
  TaskDraftForm,
  type DraftMode,
} from "./components/TaskDraftForm";
import type { TaskDropPlacement } from "./taskReorder";

interface ChecklistPanelProps {
  tasks: Task[];
  onAdd: (
    text: string,
    dueDate: string | null,
    dueTime: string | null,
    plannedDate?: string | null,
  ) => void;
  onDelete: (taskId: string) => void;
  onReorder: (
    draggedTaskId: string,
    targetTaskId: string,
    placement: TaskDropPlacement,
  ) => void;
  onToggle: (taskId: string) => void;
  onUpdatePlannedDate: (taskId: string, plannedDate: string | null) => void;
  onUpdateSchedule: (
    taskId: string,
    dueDate: string | null,
    dueTime: string | null,
  ) => void;
  onUpdateText: (taskId: string, text: string) => void;
}

export function ChecklistPanel({
  tasks,
  onAdd,
  onDelete,
  onReorder,
  onToggle,
  onUpdatePlannedDate,
  onUpdateSchedule,
  onUpdateText,
}: ChecklistPanelProps) {
  const today = formatLocalDate();
  const todayTasks = tasks.filter((task) => task.plannedDate === today);
  const deadlineTasks = tasks.filter((task) => task.plannedDate !== today);
  const [draftMode, setDraftMode] = useState<DraftMode>("today");
  const [draft, setDraft] = useState("");
  const [draftDueDate, setDraftDueDate] = useState("");
  const [draftDueTime, setDraftDueTime] = useState("");
  const [isAdding, setIsAdding] = useState(false);
  const [draggedTaskId, setDraggedTaskId] = useState<string | null>(null);
  const [dragOverTaskId, setDragOverTaskId] = useState<string | null>(null);
  const [dragOverPlacement, setDragOverPlacement] =
    useState<TaskDropPlacement>("before");
  const draggedTaskIdRef = useRef<string | null>(null);
  const dragOverTaskIdRef = useRef<string | null>(null);
  const dragOverPlacementRef = useRef<TaskDropPlacement>("before");
  const inputRef = useRef<HTMLInputElement | null>(null);
  const isDraftFormVisible =
    isAdding || Boolean(draft) || Boolean(draftDueDate) || Boolean(draftDueTime);
  const canSubmitDraft = draft.trim().length > 0;

  useEffect(() => {
    if (isAdding) {
      inputRef.current?.focus();
    }
  }, [isAdding, draftMode]);

  useEffect(() => {
    if (!draggedTaskId) {
      return;
    }

    function handleWindowPointerMove(event: PointerEvent) {
      event.preventDefault();
      updateDropTarget(event.clientX, event.clientY);
    }

    function handleWindowPointerUp() {
      const sourceTaskId = draggedTaskIdRef.current;
      const targetTaskId = dragOverTaskIdRef.current;

      if (sourceTaskId && targetTaskId && sourceTaskId !== targetTaskId) {
        onReorder(sourceTaskId, targetTaskId, dragOverPlacementRef.current);
      }

      clearDragState();
    }

    function handleWindowPointerCancel() {
      clearDragState();
    }

    function handleWindowKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape" || event.isComposing) return;
      event.preventDefault();
      clearDragState();
    }

    const previousUserSelect = document.body.style.userSelect;
    document.body.style.userSelect = "none";
    window.addEventListener("pointermove", handleWindowPointerMove, {
      capture: true,
      passive: false,
    });
    window.addEventListener("pointerup", handleWindowPointerUp, {
      capture: true,
    });
    window.addEventListener("pointercancel", handleWindowPointerCancel, {
      capture: true,
    });
    window.addEventListener("keydown", handleWindowKeyDown, { capture: true });
    window.addEventListener("blur", handleWindowPointerCancel);

    return () => {
      document.body.style.userSelect = previousUserSelect;
      window.removeEventListener("pointermove", handleWindowPointerMove, {
        capture: true,
      });
      window.removeEventListener("pointerup", handleWindowPointerUp, {
        capture: true,
      });
      window.removeEventListener("pointercancel", handleWindowPointerCancel, {
        capture: true,
      });
      window.removeEventListener("keydown", handleWindowKeyDown, { capture: true });
      window.removeEventListener("blur", handleWindowPointerCancel);
    };
  }, [draggedTaskId, onReorder]);

  function submitDraft() {
    const nextText = draft.trim();

    if (!nextText) {
      setIsAdding(true);
      return;
    }

    if (draftMode === "today") {
      onAdd(nextText, null, null, today);
    } else {
      const nextDueDate = draftDueDate || null;
      const nextDueTime = nextDueDate ? draftDueTime || null : null;
      onAdd(nextText, nextDueDate, nextDueTime, null);
    }

    setDraft("");
    setDraftDueDate("");
    setDraftDueTime("");
    setIsAdding(false);
  }

  function openDraft(mode: DraftMode) {
    setDraftMode(mode);
    setIsAdding(true);
  }

  function handleHeaderAction() {
    if (!isDraftFormVisible) {
      openDraft("today");
      return;
    }

    submitDraft();
  }

  function handleDraftFormBlur(event: ReactFocusEvent<HTMLFormElement>) {
    const nextFocusedElement = event.relatedTarget;

    if (
      nextFocusedElement instanceof Node &&
      event.currentTarget.contains(nextFocusedElement)
    ) {
      return;
    }

    if (!draft.trim() && !draftDueDate && !draftDueTime) {
      setIsAdding(false);
    }
  }

  function handleDraftDueDateChange(value: string) {
    setDraftDueDate(value);

    if (!value) {
      setDraftDueTime("");
    }
  }

  function updateDropTarget(clientX: number, clientY: number) {
    const sourceTaskId = draggedTaskIdRef.current;
    const target = document.elementFromPoint(clientX, clientY);
    const row = target?.closest<HTMLElement>("[data-task-row-id]");

    if (!sourceTaskId || !row) {
      dragOverTaskIdRef.current = null;
      setDragOverTaskId(null);
      return;
    }

    const targetTaskId = row.dataset.taskRowId ?? null;

    if (!targetTaskId || sourceTaskId === targetTaskId) {
      dragOverTaskIdRef.current = null;
      setDragOverTaskId(null);
      return;
    }

    const bounds = row.getBoundingClientRect();
    const placement =
      clientY < bounds.top + bounds.height / 2 ? "before" : "after";

    dragOverTaskIdRef.current = targetTaskId;
    dragOverPlacementRef.current = placement;
    setDragOverTaskId(targetTaskId);
    setDragOverPlacement(placement);
  }

  function handlePointerDown(
    event: ReactPointerEvent<HTMLButtonElement>,
    taskId: string,
  ) {
    if (event.button !== 0) {
      return;
    }

    event.preventDefault();
    draggedTaskIdRef.current = taskId;
    dragOverTaskIdRef.current = null;
    dragOverPlacementRef.current = "before";
    setDraggedTaskId(taskId);
    setDragOverTaskId(null);
    setDragOverPlacement("before");
  }

  function clearDragState() {
    draggedTaskIdRef.current = null;
    dragOverTaskIdRef.current = null;
    dragOverPlacementRef.current = "before";
    setDraggedTaskId(null);
    setDragOverTaskId(null);
    setDragOverPlacement("before");
  }

  return (
    <section className="win-task-panel win-panel flex min-h-0 flex-col overflow-hidden rounded-md border border-slate-300 bg-white dark:border-neutral-800 dark:bg-black">
      <div className="flex h-11 shrink-0 items-center justify-between border-b border-slate-200 px-3 dark:border-neutral-800">
        <div className="flex min-w-0 items-center gap-2 text-sm font-semibold text-slate-900 dark:text-neutral-100">
          <CheckSquare
            className="h-4 w-4 shrink-0 text-indigo-700 dark:text-indigo-300"
            aria-hidden="true"
          />
          <span className="truncate">할 일</span>
          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] text-slate-500 dark:bg-neutral-900 dark:text-neutral-300">
            {tasks.length}
          </span>
        </div>
        <button
          type="button"
          onClick={handleHeaderAction}
          disabled={isDraftFormVisible && !canSubmitDraft}
          className="win-task-add inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-indigo-700 text-white transition hover:bg-indigo-800 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-500 dark:disabled:bg-neutral-800 dark:disabled:text-neutral-500"
          title={isDraftFormVisible ? "할 일 생성" : "오늘 할 일 입력 열기"}
          aria-label={
            isDraftFormVisible ? "할 일 생성" : "오늘 할 일 입력 열기"
          }
        >
          {isDraftFormVisible ? (
            <Check className="h-4 w-4" aria-hidden="true" />
          ) : (
            <Plus className="h-4 w-4" aria-hidden="true" />
          )}
        </button>
      </div>

      <TaskDraftForm
        draft={draft}
        draftDueDate={draftDueDate}
        draftDueTime={draftDueTime}
        draftMode={draftMode}
        inputRef={inputRef}
        isVisible={isDraftFormVisible}
        onBlur={handleDraftFormBlur}
        onDraftChange={setDraft}
        onDraftDueDateChange={handleDraftDueDateChange}
        onDraftDueTimeChange={setDraftDueTime}
        onDraftModeChange={setDraftMode}
        onSubmitDraft={submitDraft}
      />

      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-2">
        <section className="space-y-1.5">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-xs font-semibold text-fuchsia-700 dark:text-fuchsia-300">
              오늘 할 일
            </h3>
            <button
              type="button"
              onClick={() => openDraft("today")}
              className="inline-flex h-7 items-center justify-center rounded-md border border-fuchsia-200 px-2 text-[11px] font-semibold text-fuchsia-700 transition hover:bg-fuchsia-50 dark:border-fuchsia-900 dark:text-fuchsia-200 dark:hover:bg-fuchsia-950/50"
            >
              추가
            </button>
          </div>
          <ChecklistTaskList
            dragOverPlacement={dragOverPlacement}
            dragOverTaskId={dragOverTaskId}
            draggedTaskId={draggedTaskId}
            emptyText="오늘 실제로 수행할 일을 추가하세요."
            items={todayTasks}
            today={today}
            onDelete={onDelete}
            onPointerDown={handlePointerDown}
            onReorder={onReorder}
            onToggle={onToggle}
            onUpdatePlannedDate={onUpdatePlannedDate}
            onUpdateSchedule={onUpdateSchedule}
            onUpdateText={onUpdateText}
          />
        </section>

        <section className="space-y-1.5">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-xs font-semibold text-sky-700 dark:text-sky-300">
              기한 내 할 일
            </h3>
            <button
              type="button"
              onClick={() => openDraft("deadline")}
              className="inline-flex h-7 items-center justify-center rounded-md border border-sky-200 px-2 text-[11px] font-semibold text-sky-700 transition hover:bg-sky-50 dark:border-sky-900 dark:text-sky-200 dark:hover:bg-sky-950/50"
            >
              추가
            </button>
          </div>
          <ChecklistTaskList
            dragOverPlacement={dragOverPlacement}
            dragOverTaskId={dragOverTaskId}
            draggedTaskId={draggedTaskId}
            emptyText="기한이나 날짜 기준으로 관리할 일을 추가하세요."
            items={deadlineTasks}
            today={today}
            onDelete={onDelete}
            onPointerDown={handlePointerDown}
            onReorder={onReorder}
            onToggle={onToggle}
            onUpdatePlannedDate={onUpdatePlannedDate}
            onUpdateSchedule={onUpdateSchedule}
            onUpdateText={onUpdateText}
          />
        </section>
      </div>
    </section>
  );
}
