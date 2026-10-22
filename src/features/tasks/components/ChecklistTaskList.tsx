import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import type { Task } from "../../../types";
import type { TaskDropPlacement } from "../taskReorder";
import { ChecklistTaskRow } from "./ChecklistTaskRow";
import { useWindowsDesktop } from "../../../app/WindowsDesktopContext";
import { useMobileLayout } from "../../../app/MobileLayoutContext";

interface ChecklistTaskListProps {
  dragOverPlacement: TaskDropPlacement;
  dragOverTaskId: string | null;
  draggedTaskId: string | null;
  emptyText: string;
  items: Task[];
  today: string;
  onDelete: (taskId: string) => void;
  onReorder?: (sourceId: string, targetId: string, placement: TaskDropPlacement) => void;
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
  today,
  onDelete,
  onReorder,
  onPointerDown,
  onToggle,
  onUpdatePlannedDate,
  onUpdateSchedule,
  onUpdateText,
}: ChecklistTaskListProps) {
  const windowsDesktop = useWindowsDesktop();
  const mobileLayout = useMobileLayout();
  const [moveAnnouncement, setMoveAnnouncement] = useState("");
  const moveTriggerRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    const trigger = moveTriggerRef.current;
    if (!trigger?.isConnected) return;
    // A move can disable the arrow at a list boundary. Keep focus on this row.
    const focusTarget = trigger.disabled
      ? trigger.closest("[data-task-row-id]")?.querySelector<HTMLButtonElement>("[data-reorder-handle]")
      : trigger;
    focusTarget?.focus();
    moveTriggerRef.current = null;
  }, [items]);

  function moveTask(task: Task, index: number, direction: -1 | 1, trigger: HTMLButtonElement) {
    const target = items[index + direction];
    if (!target || !onReorder) return;
    moveTriggerRef.current = trigger;
    onReorder(task.id, target.id, direction === -1 ? "before" : "after");
    setMoveAnnouncement(`${task.text || "할 일"} · ${items.length}개 중 ${index + direction + 1}번째로 이동했습니다.`);
  }

  if (items.length === 0) {
    return (
      <div className="win-task-empty rounded-md border border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-center text-sm text-slate-500 dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-400">
        {emptyText}
      </div>
    );
  }

  return (
    <div className="space-y-1.5">
      {windowsDesktop || mobileLayout ? <p className="sr-only" role="status" aria-live="polite" aria-atomic="true">{moveAnnouncement}</p> : null}
      {items.map((task, index) => (
        <ChecklistTaskRow
          key={task.id}
          dragOverPlacement={dragOverPlacement}
          isDragging={draggedTaskId === task.id}
          isDropTarget={
            dragOverTaskId === task.id && draggedTaskId !== task.id
          }
          task={task}
          today={today}
          onDelete={onDelete}
          onPointerDown={onPointerDown}
          canMoveUp={index > 0}
          canMoveDown={index < items.length - 1}
          onMove={(windowsDesktop || mobileLayout) && onReorder ? (direction, trigger) => moveTask(task, index, direction, trigger) : undefined}
          onToggle={onToggle}
          onUpdatePlannedDate={onUpdatePlannedDate}
          onUpdateSchedule={onUpdateSchedule}
          onUpdateText={onUpdateText}
        />
      ))}
    </div>
  );
}
