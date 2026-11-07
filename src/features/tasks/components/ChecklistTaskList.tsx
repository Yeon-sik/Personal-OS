import type { PointerEvent as ReactPointerEvent } from "react";
import type { Task, TaskDetailsChanges } from "../../../types";
import type { TaskDropPlacement } from "../taskReorder";
import { ChecklistTaskRow } from "./ChecklistTaskRow";

interface ChecklistTaskListProps {
  dragOverPlacement: TaskDropPlacement;
  dragOverTaskId: string | null;
  draggedTaskId: string | null;
  emptyText: string;
  items: Task[];
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

export function ChecklistTaskList({
  dragOverPlacement,
  dragOverTaskId,
  draggedTaskId,
  emptyText,
  items,
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
}: ChecklistTaskListProps) {
  if (items.length === 0) {
    return (
      <div className="rounded-md border border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-center text-sm text-slate-500 dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-400">
        {emptyText}
      </div>
    );
  }

  return (
    <div className="space-y-1.5">
      {items.map((task) => (
        <ChecklistTaskRow
          key={task.id}
          dragOverPlacement={dragOverPlacement}
          isDragging={draggedTaskId === task.id}
          isDropTarget={
            dragOverTaskId === task.id && draggedTaskId !== task.id
          }
          task={task}
          today={today}
          onUpdateDetails={onUpdateDetails}
          onSkipOccurrence={onSkipOccurrence}
          onDirtyChange={onDirtyChange}
          onDelete={onDelete}
          onPointerDown={onPointerDown}
          onToggle={onToggle}
          onUpdatePlannedDate={onUpdatePlannedDate}
          onUpdateSchedule={onUpdateSchedule}
          onUpdateText={onUpdateText}
        />
      ))}
    </div>
  );
}
