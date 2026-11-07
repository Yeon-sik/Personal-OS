import { useCallback } from "react";
import type { SnapshotUpdater } from "../../app/sync/useSnapshotStore";
import type { BackfillInput, Device, LocalDataSnapshot, Task, TaskDetailsChanges } from "../../types";
import { createTask, getNextOrderIndex, softDeleteTask, updateTask } from "./taskService";
import { reorderTasksForDrop, type TaskDropPlacement } from "./taskReorder";
import { editTaskDetails } from "./taskPlanning";
import { applyPreparedTaskTransition, prepareTaskTransition, type TaskTransition } from "./taskRecurrence";

interface UseTaskActionsOptions {
  snapshot: LocalDataSnapshot;
  commitSnapshot: (updater: SnapshotUpdater) => void;
  device: Device | null;
  onError?: (message: string) => void;
  transformTaskSnapshot?: (snapshot: LocalDataSnapshot, changedTask: Task) => LocalDataSnapshot;
}

export interface TaskActions {
  addTask: (text: string, dueDate?: string | null, dueTime?: string | null, plannedDate?: string | null, backfillInput?: BackfillInput) => void;
  deleteTask: (taskId: string) => void;
  reorderTasks: (draggedTaskId: string, targetTaskId: string, placement: TaskDropPlacement) => void;
  toggleTask: (taskId: string) => Promise<void>;
  skipTaskOccurrence: (taskId: string) => Promise<void>;
  updateTaskDetails: (taskId: string, changes: TaskDetailsChanges) => Promise<void>;
  updateTaskPlannedDate: (taskId: string, plannedDate: string | null) => void;
  updateTaskSchedule: (taskId: string, dueDate: string | null, dueTime: string | null) => void;
  updateTaskText: (taskId: string, text: string) => void;
}

export function useTaskActions({ snapshot, commitSnapshot, device, onError, transformTaskSnapshot }: UseTaskActionsOptions): TaskActions {
  const reportError = useCallback((error: unknown) => {
    if (!onError) throw error;
    onError(error instanceof Error ? error.message : "할 일을 저장하지 못했습니다.");
  }, [onError]);

  const commitTask = useCallback((id: string, update: (task: Task, current: LocalDataSnapshot) => Task) => {
    commitSnapshot(current => {
      const task = current.tasks.find(row => row.id === id);
      if (!task) throw new Error("할 일을 찾을 수 없습니다. 목록을 다시 확인해 주세요.");
      const changedTask = update(task, current);
      if (changedTask === task) return current;
      const next = { ...current, tasks: current.tasks.map(row => row.id === id ? changedTask : row) };
      return transformTaskSnapshot?.(next, changedTask) ?? next;
    });
  }, [commitSnapshot, transformTaskSnapshot]);

  const addTask = useCallback((text: string, dueDate: string | null = null, dueTime: string | null = null,
    plannedDate: string | null = null, backfillInput?: BackfillInput) => {
    if (!device) return;
    commitSnapshot(current => ({ ...current, tasks: [...current.tasks,
      createTask(text, getNextOrderIndex(current.tasks), device.id, dueDate, dueTime, plannedDate, backfillInput)] }));
  }, [commitSnapshot, device]);

  const transitionTask = useCallback(async (id: string, transition: TaskTransition) => {
    if (!device) throw new Error("앱이 준비된 뒤 다시 시도해 주세요.");
    const original = snapshot.tasks.find(row => row.id === id);
    if (!original) throw new Error("할 일을 찾을 수 없습니다.");
    const owner = original.actionOwnerScope ?? snapshot.syncState?.scope?.userId ?? `local:${device.id}`;
    const prepared = await prepareTaskTransition(original, transition, device.id, owner);
    commitSnapshot(current => {
      const latest = current.tasks.find(row => row.id === id);
      if (!latest || latest.updatedAt !== original.updatedAt ||
          JSON.stringify(current.syncState?.scope) !== JSON.stringify(snapshot.syncState?.scope)) {
        throw new Error("할 일이나 계정이 변경되었습니다. 최신 내용을 확인하고 다시 시도해 주세요.");
      }
      if (prepared.task === original) return current;
      const next = applyPreparedTaskTransition(current, prepared);
      return transformTaskSnapshot?.(next, prepared.task) ?? next;
    });
  }, [snapshot, commitSnapshot, device, transformTaskSnapshot]);

  const toggleTask = useCallback(async (id: string) => {
    const task = snapshot.tasks.find(row => row.id === id);
    try { await transitionTask(id, task?.isDone || task?.skippedAt ? "REOPEN" : "COMPLETE"); }
    catch (error) { reportError(error); }
  }, [snapshot.tasks, transitionTask, reportError]);

  const skipTaskOccurrence = useCallback(async (id: string) => {
    try { await transitionTask(id, "SKIP"); }
    catch (error) { onError?.(error instanceof Error ? error.message : "이번 회차를 건너뛰지 못했습니다."); throw error; }
  }, [transitionTask, onError]);

  const updateTaskDetails = useCallback(async (id: string, changes: TaskDetailsChanges) => {
    if (!device) throw new Error("앱이 준비된 뒤 다시 시도해 주세요.");
    try { commitTask(id, (task, current) => editTaskDetails(task, changes, current.tasks, device.id)); }
    catch (error) { onError?.(error instanceof Error ? error.message : "상세 내용을 저장하지 못했습니다."); throw error; }
  }, [commitTask, device, onError]);

  const updateTaskText = useCallback((id: string, text: string) => {
    if (!device) return;
    try { commitTask(id, task => updateTask(task, { text }, device.id)); }
    catch (error) { reportError(error); }
  }, [commitTask, device, reportError]);

  const updateTaskSchedule = useCallback((id: string, dueDate: string | null, dueTime: string | null) => {
    if (!device) return;
    try { commitTask(id, task => updateTask(task, { dueDate, dueTime: dueDate ? dueTime : null }, device.id)); }
    catch (error) { reportError(error); }
  }, [commitTask, device, reportError]);

  const updateTaskPlannedDate = useCallback((id: string, plannedDate: string | null) => {
    if (!device) return;
    try { commitTask(id, task => updateTask(task, { plannedDate }, device.id)); }
    catch (error) { reportError(error); }
  }, [commitTask, device, reportError]);

  const deleteTask = useCallback((id: string) => {
    if (!device) return;
    try { commitTask(id, task => softDeleteTask(task, device.id)); }
    catch (error) { reportError(error); }
  }, [commitTask, device, reportError]);

  const reorderTasks = useCallback((dragged: string, target: string, placement: TaskDropPlacement) => {
    if (!device || dragged === target) return;
    commitSnapshot(current => {
      const tasks = reorderTasksForDrop(current.tasks, dragged, target, placement, device.id);
      return tasks === current.tasks ? current : { ...current, tasks };
    });
  }, [commitSnapshot, device]);

  return { addTask, deleteTask, reorderTasks, toggleTask, skipTaskOccurrence, updateTaskDetails,
    updateTaskPlannedDate, updateTaskSchedule, updateTaskText };
}
