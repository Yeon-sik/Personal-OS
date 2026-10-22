import type { PointerEvent as ReactPointerEvent } from "react";
import {
  CalendarCheck,
  CalendarDays,
  ChevronDown,
  ChevronUp,
  Clock3,
  GripVertical,
  Trash2,
  X,
} from "lucide-react";
import type { Task } from "../../../types";
import type { TaskDropPlacement } from "../taskReorder";
import { useMobileLayout } from "../../../app/MobileLayoutContext";
import { MobileTaskRow } from "./MobileTaskRow";

export interface ChecklistTaskRowProps {
  dragOverPlacement: TaskDropPlacement;
  isDragging: boolean;
  isDropTarget: boolean;
  task: Task;
  today: string;
  onDelete: (taskId: string) => void;
  canMoveUp: boolean;
  canMoveDown: boolean;
  onMove?: (direction: -1 | 1, trigger: HTMLButtonElement) => void;
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

export function ChecklistTaskRow(props: ChecklistTaskRowProps) {
  const mobileLayout = useMobileLayout();
  return mobileLayout ? <MobileTaskRow {...props} /> : <DesktopTaskRow {...props} />;
}

function DesktopTaskRow({
  dragOverPlacement,
  isDragging,
  isDropTarget,
  task,
  today,
  onDelete,
  canMoveUp,
  canMoveDown,
  onMove,
  onPointerDown,
  onToggle,
  onUpdatePlannedDate,
  onUpdateSchedule,
  onUpdateText,
}: ChecklistTaskRowProps) {
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
      data-task-drag-state={isDropTarget ? dragOverPlacement : isDragging ? "dragging" : undefined}
      className={
        isDropTarget
          ? `flex min-h-[7rem] flex-col gap-2 rounded-md border border-slate-200 px-1.5 py-1.5 shadow-sm dark:border-neutral-800 ${dropTargetClass}`
          : isDragging
            ? "flex min-h-[7rem] flex-col gap-2 rounded-md border border-slate-200 bg-slate-50 px-1.5 py-1.5 opacity-60 dark:border-neutral-800 dark:bg-neutral-950"
            : "flex min-h-[7rem] flex-col gap-2 rounded-md border border-slate-200 bg-white px-1.5 py-1.5 transition hover:border-slate-300 dark:border-neutral-800 dark:bg-black dark:hover:border-neutral-700"
      }
    >
      <div className="flex min-h-8 items-center gap-1.5">
        <button
          type="button"
          onPointerDown={(event) => onPointerDown(event, task.id)}
          data-reorder-handle={onMove ? "" : undefined}
          onKeyDown={onMove ? (event) => {
            if (event.key === "ArrowUp" || event.key === "ArrowDown") {
              event.preventDefault();
              onMove(event.key === "ArrowUp" ? -1 : 1, event.currentTarget);
            }
          } : undefined}
          className="inline-flex h-7 w-6 shrink-0 touch-none cursor-grab items-center justify-center rounded-md text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 active:cursor-grabbing dark:text-neutral-500 dark:hover:bg-neutral-900 dark:hover:text-neutral-200"
          title={onMove ? "드래그 또는 위·아래 방향키로 순서 변경" : "순서 변경"}
          aria-label={`${task.text || "할 일"} 순서 변경${onMove ? " (위·아래 방향키)" : ""}`}
        >
          <GripVertical className="h-4 w-4" aria-hidden="true" />
        </button>

        {onMove ? <div className="win-reorder-actions" role="group" aria-label={`${task.text || "할 일"} 순서 이동`}>
          <button type="button" disabled={!canMoveUp} onClick={(event) => onMove(-1, event.currentTarget)} aria-label={`${task.text || "할 일"} 위로 이동`} title="위로 이동"><ChevronUp size={16} aria-hidden="true" /></button>
          <button type="button" disabled={!canMoveDown} onClick={(event) => onMove(1, event.currentTarget)} aria-label={`${task.text || "할 일"} 아래로 이동`} title="아래로 이동"><ChevronDown size={16} aria-hidden="true" /></button>
        </div> : null}

        <input
          type="checkbox"
          checked={task.isDone}
          onChange={() => onToggle(task.id)}
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
          onClick={() =>
            onUpdatePlannedDate(
              task.id,
              task.plannedDate === today ? null : today,
            )
          }
          className={
            task.plannedDate === today
              ? "inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-fuchsia-100 text-fuchsia-700 transition hover:bg-fuchsia-200 dark:bg-fuchsia-950/50 dark:text-fuchsia-200"
              : "inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-slate-400 transition hover:bg-fuchsia-50 hover:text-fuchsia-700 dark:text-neutral-500 dark:hover:bg-fuchsia-950/40 dark:hover:text-fuchsia-200"
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
          onClick={() => onDelete(task.id)}
          className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-slate-400 transition hover:bg-red-50 hover:text-red-700 dark:text-neutral-500 dark:hover:bg-red-950/50 dark:hover:text-red-300"
          title="할 일 삭제"
          aria-label="할 일 삭제"
        >
          <Trash2 className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>

      <div className="win-task-schedule grid grid-cols-1 gap-1.5 pl-8">
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
            className="h-8 min-w-0 flex-1 border-0 bg-transparent text-[11px] text-slate-700 focus:outline-none dark:text-neutral-200"
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
            className="h-8 min-w-0 flex-1 border-0 bg-transparent text-[11px] text-slate-700 focus:outline-none disabled:cursor-not-allowed disabled:text-slate-400 dark:text-neutral-200 dark:disabled:text-neutral-600"
            aria-label={`${task.text || "할 일"} 마감 시간`}
          />
        </label>
      </div>
    </div>
  );
}
