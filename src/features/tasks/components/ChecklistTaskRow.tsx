import { useCallback, useEffect, useState, type PointerEvent as ReactPointerEvent } from "react";
import {
  CalendarCheck,
  CalendarDays,
  Clock3,
  ChevronDown,
  ChevronUp,
  GripVertical,
  Trash2,
  X,
} from "lucide-react";
import type { Task, TaskDetailsChanges } from "../../../types";
import { TaskDetailsEditor } from "./TaskDetailsEditor";
import { completionDay } from "../taskPlanningPresentation";
import { ActionSummary } from "../../actions/ActionSummary";
import type { TaskDropPlacement } from "../taskReorder";

interface ChecklistTaskRowProps {
  dragOverPlacement: TaskDropPlacement;
  isDragging: boolean;
  isDropTarget: boolean;
  task: Task;
  onUpdateDetails?: (id: string, changes: TaskDetailsChanges) => void | Promise<void>;
  onSkipOccurrence?: (id: string) => void | Promise<void>;
  onDirtyChange?: (id: string, dirty: boolean) => void;
  today: string;
  onDelete: (taskId: string) => void;
  onPointerDown: (
    event: ReactPointerEvent<HTMLButtonElement>,
    taskId: string,
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

export function ChecklistTaskRow({
  dragOverPlacement,
  isDragging,
  isDropTarget,
  task,
  onUpdateDetails,
  onSkipOccurrence,
  onDirtyChange,
  today,
  onDelete,
  onPointerDown,
  onToggle,
  onUpdatePlannedDate,
  onUpdateSchedule,
  onUpdateText,
}: ChecklistTaskRowProps) {
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [detailsDirty, setDetailsDirty] = useState(false);
  const reportDirty = useCallback((dirty: boolean) => {
    setDetailsDirty(dirty); onDirtyChange?.(task.id, dirty);
  }, [onDirtyChange, task.id]);
  useEffect(() => () => { onDirtyChange?.(task.id, false); }, [onDirtyChange, task.id]);
  function leaveDetails(work: () => void) {
    if (detailsDirty && !window.confirm("저장하지 않은 세부 편집을 버리고 계속할까요?")) return;
    setDetailsOpen(false); reportDirty(false); work();
  }
  const imported = task.origin === "IMPORT" || task.origin === "CHATGPT";
  const summaryDate = task.eventStartDate || task.dueDate || task.windowStartDate;
  const summaryTime = task.eventStartDate ? task.eventStartTime : task.dueDate ? task.dueTime : task.windowStartTime;
  const hasSummary = Boolean(summaryDate || task.category || task.checklist?.length || task.recurrence || task.isDone || task.skippedAt || task.projectActionId);
  const dropTargetClass = isDropTarget
    ? dragOverPlacement === "before"
      ? "border-t-indigo-500 bg-indigo-50 dark:bg-indigo-950/50"
      : "border-b-indigo-500 bg-indigo-50 dark:bg-indigo-950/50"
    : "";

  function handleDueDateChange(value: string) {
    const nextDueDate = value || null;
    onUpdateSchedule(task.id, nextDueDate, nextDueDate ? task.dueTime : null);
  }

  function handleDueTimeChange(value: string) {
    onUpdateSchedule(task.id, task.dueDate, value || null);
  }

  return (
    <div
      data-task-row-id={task.id}
      className={
        isDropTarget
          ? `flex flex-col gap-1 rounded-md border border-slate-200 px-1.5 py-1.5 shadow-sm dark:border-neutral-800 ${dropTargetClass}`
          : isDragging
            ? "flex flex-col gap-1 rounded-md border border-slate-200 bg-slate-50 px-1.5 py-1.5 opacity-60 dark:border-neutral-800 dark:bg-neutral-950"
            : "flex flex-col gap-1 rounded-md border border-slate-200 bg-white px-1.5 py-1.5 transition hover:border-slate-300 dark:border-neutral-800 dark:bg-black dark:hover:border-neutral-700"
      }
    >
      <div className="flex min-h-8 items-center gap-1.5">
        <button
          type="button"
          onPointerDown={(event) => onPointerDown(event, task.id)}
          className="inline-flex min-h-11 min-w-11 shrink-0 touch-none cursor-grab items-center justify-center rounded-md text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 active:cursor-grabbing dark:text-neutral-500 dark:hover:bg-neutral-900 dark:hover:text-neutral-200"
          title="순서 변경"
          aria-label={`${task.text || "할 일"} 순서 변경`}
        >
          <GripVertical className="h-4 w-4" aria-hidden="true" />
        </button>

        <input
          type="checkbox"
          checked={task.isDone}
          disabled={Boolean(task.skippedAt)}
          onChange={() => leaveDetails(() => onToggle(task.id))}
          className="h-4 w-4 shrink-0 rounded border-slate-300 text-teal-700"
          aria-label="완료 여부"
        />
        <input
          value={task.text}
          onChange={(event) => onUpdateText(task.id, event.target.value)}
          className={
            task.isDone
              ? "min-w-0 flex-1 border-0 bg-transparent text-sm text-slate-400 line-through focus:outline-none dark:text-neutral-500"
              : "min-w-0 flex-1 border-0 bg-transparent text-sm text-slate-800 focus:outline-none dark:text-neutral-100"
          }
          aria-label="할 일 내용"
        />
        <button
          type="button"
          onClick={() => leaveDetails(() =>
            onUpdatePlannedDate(
              task.id,
              task.plannedDate === today ? null : today,
            ))
          }
          className={
            task.plannedDate === today
              ? "inline-flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-md bg-fuchsia-100 text-fuchsia-700 transition hover:bg-fuchsia-200 dark:bg-fuchsia-950/50 dark:text-fuchsia-200"
              : "inline-flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-md text-slate-400 transition hover:bg-fuchsia-50 hover:text-fuchsia-700 dark:text-neutral-500 dark:hover:bg-fuchsia-950/40 dark:hover:text-fuchsia-200"
          }
          title={
            task.plannedDate === today
              ? "오늘 할 일에서 제거"
              : "오늘 할 일로 지정"
          }
          aria-label={
            task.plannedDate === today
              ? "오늘 할 일에서 제거"
              : "오늘 할 일로 지정"
          }
        >
          {task.plannedDate === today ? (
            <X className="h-4 w-4" aria-hidden="true" />
          ) : (
            <CalendarCheck className="h-4 w-4" aria-hidden="true" />
          )}
        </button>
        <button
          type="button"
          aria-label={detailsOpen ? "세부 내용 접기" : "설명 · 하위 항목 · 반복 설정"}
          aria-expanded={detailsOpen}
          onClick={() => { if (detailsOpen) leaveDetails(() => undefined); else setDetailsOpen(true); }}
          className="inline-flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-md text-teal-800 hover:bg-teal-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-teal-600 dark:text-teal-200 dark:hover:bg-teal-950/50"
          title={detailsOpen ? "세부 내용 접기" : "세부 내용 펼치기"}
        >
          {detailsOpen ? <ChevronUp className="h-4 w-4" aria-hidden="true" /> : <ChevronDown className="h-4 w-4" aria-hidden="true" />}
        </button>
        <button
          type="button"
          onClick={() => leaveDetails(() => onDelete(task.id))}
          className="inline-flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-md text-slate-400 transition hover:bg-red-50 hover:text-red-700 dark:text-neutral-500 dark:hover:bg-red-950/50 dark:hover:text-red-300"
          title="할 일 삭제"
          aria-label="할 일 삭제"
        >
          <Trash2 className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>

      {hasSummary && <div className="flex flex-wrap items-center gap-x-3 gap-y-1 pb-1 pl-8 text-xs text-slate-600 dark:text-neutral-300">
        {summaryDate && <span className="inline-flex items-center gap-1"><CalendarDays className="h-3.5 w-3.5" aria-hidden="true" />{task.eventStartDate ? "행사" : task.dueDate ? "마감" : "접수"} {summaryDate}{summaryTime ? ` · ${summaryTime}` : ""}</span>}
        {task.category && <span>{task.category}</span>}
        {Boolean(task.checklist?.length) && <span>하위 항목 {task.checklist!.filter(item => item.isDone).length}/{task.checklist!.length}</span>}
        {task.recurrence && <span>반복 · {task.recurrence.interval}{task.recurrence.frequency === "DAILY" ? "일" : task.recurrence.frequency === "WEEKLY" ? "주" : "개월"}마다</span>}
        {task.isDone && <span>완료 · {completionDay(task) ?? "날짜 미상"}</span>}
        {task.skippedAt && <span>이번 회차 건너뜀</span>}
        {task.projectActionId && <span>프로젝트 작업 연결됨</span>}
      </div>}
      {detailsOpen && <div className="space-y-3 border-t border-slate-200 p-2 dark:border-neutral-800">
        {imported ? <div className="space-y-2">
          <ActionSummary task={task} />
          <p className="text-xs text-slate-600 dark:text-neutral-300">공식 일정과 출처는 전체 기록 달력의 일정 상세에서 수정하세요.</p>
        </div> : <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
          <label className="flex min-w-0 items-center gap-1.5 rounded-md border border-slate-200 bg-slate-50 px-2 text-[11px] text-slate-500 dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-400">
            <CalendarDays
              className="h-3.5 w-3.5 shrink-0"
              aria-hidden="true"
            />
            <span className="sr-only">마감일</span>
            <input
              type="date"
              value={task.dueDate ?? ""}
              onChange={(event) => handleDueDateChange(event.target.value)}
              className="h-11 min-w-0 flex-1 border-0 bg-transparent text-[11px] text-slate-700 focus:outline-none dark:text-neutral-200"
              aria-label={`${task.text || "할 일"} 마감일`}
            />
          </label>

          <label className="flex min-w-0 items-center gap-1 rounded-md border border-slate-200 bg-slate-50 px-2 text-[11px] text-slate-500 dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-400">
            <Clock3 className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            <span className="sr-only">마감 시간</span>
            <input
              type="time"
              value={task.dueTime ?? ""}
              disabled={!task.dueDate}
              onChange={(event) => handleDueTimeChange(event.target.value)}
              className="h-11 min-w-0 flex-1 border-0 bg-transparent text-[11px] text-slate-700 focus:outline-none disabled:cursor-not-allowed disabled:text-slate-400 dark:text-neutral-200 dark:disabled:text-neutral-600"
              aria-label={`${task.text || "할 일"} 마감 시간`}
            />
          </label>
        </div>}
        {onUpdateDetails && <TaskDetailsEditor task={task} onSave={onUpdateDetails} onSkipOccurrence={onSkipOccurrence} onDirtyChange={reportDirty} onCancel={() => { setDetailsOpen(false); reportDirty(false); }} />}
      </div>}
    </div>
  );
}
