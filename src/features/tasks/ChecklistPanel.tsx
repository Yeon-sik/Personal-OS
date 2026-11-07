import {
  type FocusEvent as ReactFocusEvent,
  type PointerEvent as ReactPointerEvent,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { Check, CheckSquare, Plus } from "lucide-react";
import type { Task, TaskDetailsChanges } from "../../types";
import { filterChecklistTasks, groupCompletedTasks, TASK_CATEGORIES, type TaskListStatus } from "./taskPlanningPresentation";
import { formatLocalDate } from "../fitness/fitnessDate";
import { ChecklistTaskList } from "./components/ChecklistTaskList";
import {
  TaskDraftForm,
  type DraftMode,
} from "./components/TaskDraftForm";
import type { TaskDropPlacement } from "./taskReorder";

interface ChecklistPanelProps {
  tasks: Task[];
  onUpdateDetails?: (id: string, changes: TaskDetailsChanges) => void | Promise<void>;
  onSkipOccurrence?: (id: string) => void | Promise<void>;
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
  onUpdateDetails,
  onSkipOccurrence,
  onAdd,
  onDelete,
  onReorder,
  onToggle,
  onUpdatePlannedDate,
  onUpdateSchedule,
  onUpdateText,
}: ChecklistPanelProps) {
  const today = formatLocalDate();
  const dirtyTaskIds = useRef(new Set<string>());
  const tasksRef = useRef(tasks);
  tasksRef.current = tasks;
  const [editingLayout, setEditingLayout] = useState<Task[] | null>(null);
  const [listRevision, setListRevision] = useState(0);
  const onTaskDirtyChange = useCallback((id: string, dirty: boolean) => {
    if (dirty) {
      dirtyTaskIds.current.add(id);
      setEditingLayout(current => current ?? tasksRef.current);
    } else {
      dirtyTaskIds.current.delete(id);
      if (!dirtyTaskIds.current.size) setEditingLayout(null);
    }
  }, []);
  function changeFilter(change: () => void) {
    if (dirtyTaskIds.current.size) {
      if (!window.confirm("저장하지 않은 세부 편집을 버리고 목록 조건을 바꿀까요?")) return;
      dirtyTaskIds.current.clear();
      setEditingLayout(null);
      setListRevision(value => value + 1);
    }
    change();
  }
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<TaskListStatus>("open");
  const [category, setCategory] = useState("all");
  // Keep row parents stable while editing: a sync update can change the
  // planned/completed date without unmounting and losing a local draft.
  const layoutTasks = filterChecklistTasks(editingLayout ?? tasks, query, status, category);
  const currentTasks = new Map(tasks.map(task => [task.id, task]));
  const filteredTasks = layoutTasks.map(task => currentTasks.get(task.id)).filter((task): task is Task => Boolean(task));
  const todayIds = new Set(layoutTasks.filter(task => task.plannedDate === today).map(task => task.id));
  const todayTasks = filteredTasks.filter(task => todayIds.has(task.id));
  const deadlineTasks = filteredTasks.filter(task => !todayIds.has(task.id));
  const completedGroups = groupCompletedTasks(layoutTasks).map(group => ({
    ...group, tasks: group.tasks.map(task => currentTasks.get(task.id)).filter((task): task is Task => Boolean(task)),
  })).filter(group => group.tasks.length);
  const extraCategories = [...new Set(tasks.map(task => task.category).filter((value): value is string => Boolean(value)))].filter(value => !TASK_CATEGORIES.some(category => category === value));
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

    const previousUserSelect = document.body.style.userSelect;
    document.body.style.userSelect = "none";
    window.addEventListener("pointermove", handleWindowPointerMove, {
      capture: true,
      passive: false,
    });
    window.addEventListener("pointerup", handleWindowPointerUp, {
      capture: true,
    });
    window.addEventListener("pointercancel", handleWindowPointerUp, {
      capture: true,
    });

    return () => {
      document.body.style.userSelect = previousUserSelect;
      window.removeEventListener("pointermove", handleWindowPointerMove, {
        capture: true,
      });
      window.removeEventListener("pointerup", handleWindowPointerUp, {
        capture: true,
      });
      window.removeEventListener("pointercancel", handleWindowPointerUp, {
        capture: true,
      });
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

  function renderList(items: Task[], emptyText: string) {
    return <ChecklistTaskList key={listRevision} onDirtyChange={onTaskDirtyChange} dragOverPlacement={dragOverPlacement} dragOverTaskId={dragOverTaskId}
      draggedTaskId={draggedTaskId} emptyText={emptyText} items={items} today={today}
      onDelete={onDelete} onPointerDown={handlePointerDown} onToggle={onToggle}
      onUpdatePlannedDate={onUpdatePlannedDate} onUpdateSchedule={onUpdateSchedule} onUpdateText={onUpdateText}
      onUpdateDetails={onUpdateDetails} onSkipOccurrence={onSkipOccurrence} />;
  }

  return (
    <section className="flex min-h-0 flex-col overflow-hidden rounded-md border border-slate-300 bg-white dark:border-neutral-800 dark:bg-black">
      <div className="flex h-11 shrink-0 items-center justify-between border-b border-slate-200 px-3 dark:border-neutral-800">
        <div className="flex min-w-0 items-center gap-2 text-sm font-semibold text-slate-900 dark:text-neutral-100">
          <CheckSquare
            className="h-4 w-4 shrink-0 text-indigo-700 dark:text-indigo-300"
            aria-hidden="true"
          />
          <span className="truncate">할 일</span>
          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] text-slate-500 dark:bg-neutral-900 dark:text-neutral-300">
            {filteredTasks.length}
          </span>
        </div>
        <button
          type="button"
          onClick={handleHeaderAction}
          disabled={isDraftFormVisible && !canSubmitDraft}
          className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-indigo-700 text-white transition hover:bg-indigo-800 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-500 dark:disabled:bg-neutral-800 dark:disabled:text-neutral-500"
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
      />

      <div className="space-y-2 border-b border-slate-200 p-3 dark:border-neutral-800">
        <label className="block text-sm font-medium">할 일 검색
          <input type="search" value={query} onChange={event => changeFilter(() => setQuery(event.target.value))} placeholder="제목으로 찾기" aria-label="할 일 검색"
            className="mt-1 min-h-11 w-full rounded-md border border-slate-300 bg-white px-3 text-base text-slate-950 focus:border-teal-600 focus:outline-none focus:ring-1 focus:ring-teal-600 dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-100" />
        </label>
        <div className="grid grid-cols-2 gap-2">
          <label className="text-sm font-medium">상태
            <select value={status} onChange={event => changeFilter(() => setStatus(event.target.value as TaskListStatus))} aria-label="할 일 상태 필터" className="mt-1 min-h-11 w-full rounded-md border border-slate-300 bg-white px-2 text-sm dark:border-neutral-700 dark:bg-neutral-950">
              <option value="open">미완료</option><option value="all">전체</option><option value="completed">완료 기록</option><option value="undated">날짜 미정</option><option value="skipped">건너뛴 회차</option>
            </select>
          </label>
          <label className="text-sm font-medium">분류
            <select value={category} onChange={event => changeFilter(() => setCategory(event.target.value))} aria-label="할 일 분류 필터" className="mt-1 min-h-11 w-full rounded-md border border-slate-300 bg-white px-2 text-sm dark:border-neutral-700 dark:bg-neutral-950">
              <option value="all">모든 분류</option><option value="uncategorized">분류 없음</option>
              {[...TASK_CATEGORIES, ...extraCategories].map(value => <option key={value} value={value}>{value}</option>)}
            </select>
          </label>
        </div>
      </div>
      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-3">
        {editingLayout && <p className="text-sm text-slate-600 dark:text-neutral-300">편집 중인 항목은 저장하거나 취소할 때까지 현재 목록에 유지됩니다.</p>}
        {status === "completed" ? <section aria-label="날짜별 완료 기록" className="space-y-5">
          <p className="text-sm text-slate-600 dark:text-neutral-300">실제로 완료한 날짜 · 서울 기준. 계획일이나 마지막 수정일로 추정하지 않습니다.</p>
          {completedGroups.length ? completedGroups.map(group => <section key={group.date ?? "unknown"} className="space-y-2">
            <h3 className="text-sm font-semibold">{group.date ?? "완료 날짜 미상"} · {group.tasks.length}개</h3>
            {!group.date && <p className="text-sm text-slate-600 dark:text-neutral-300">완료 시각이 저장되지 않은 기존 기록입니다.</p>}
            {renderList(group.tasks, "완료한 일이 없습니다.")}
          </section>) : <p className="py-5 text-sm text-slate-600 dark:text-neutral-300">조건에 맞는 완료 기록이 없습니다.</p>}
        </section> : <>
          <section className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-sm font-semibold text-fuchsia-800 dark:text-fuchsia-200">오늘 할 일</h3>
              <button type="button" onClick={() => openDraft("today")} className="inline-flex min-h-11 items-center justify-center rounded-md border border-fuchsia-300 px-3 text-sm font-semibold text-fuchsia-800 hover:bg-fuchsia-50 dark:border-fuchsia-800 dark:text-fuchsia-200 dark:hover:bg-fuchsia-950/50">추가</button>
            </div>
            {renderList(todayTasks, "조건에 맞는 오늘 할 일이 없습니다.")}
          </section>
          <section className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-sm font-semibold text-sky-800 dark:text-sky-200">그 밖의 할 일</h3>
              <button type="button" onClick={() => openDraft("deadline")} className="inline-flex min-h-11 items-center justify-center rounded-md border border-sky-300 px-3 text-sm font-semibold text-sky-800 hover:bg-sky-50 dark:border-sky-800 dark:text-sky-200 dark:hover:bg-sky-950/50">추가</button>
            </div>
            {renderList(deadlineTasks, "조건에 맞는 할 일이 없습니다.")}
          </section>
        </>}
      </div>
    </section>
  );
}
