import type { LocalDataSnapshot, Task } from "../../types";
import { validDate } from "../actions/actionTime";
import { normalizeActionFields } from "../actions/actionModel";
import { createTask, getNextOrderIndex, updateTask } from "./taskService";

export const PROJECT_TASK_NAMESPACE = "personal-os.project-action";

export function syncLinkedProjectAction(snapshot: LocalDataSnapshot, task: Task): LocalDataSnapshot {
  if (!task.projectActionId || task.deletedAt) return snapshot;
  const action = snapshot.projectActions.find(row => row.id === task.projectActionId && !row.deletedAt);
  if (!action || !snapshot.projects.some(project => project.id === action.projectId && !project.deletedAt)) return snapshot;
  const status = task.isDone ? "DONE" : "OPEN";
  if (action.title === task.text && action.status === status) return snapshot;
  const updatedAt = new Date(Math.max(Date.parse(task.updatedAt), Date.parse(action.updatedAt) + 1)).toISOString();
  return {
    ...snapshot,
    tasks: snapshot.tasks.map(row => row.id === task.id ? { ...row, updatedAt } : row),
    projectActions: snapshot.projectActions.map(row => row.id === action.id
      ? { ...row, title: task.text, status, updatedAt, deviceId: task.deviceId } : row),
  };
}

export function planProjectTask(snapshot: LocalDataSnapshot, actionId: string, taskId: string, date: string, deviceId: string, ownerScope: string): LocalDataSnapshot {
  if (!validDate(date)) throw new Error("올바른 계획 날짜를 입력해 주세요.");
  const action = snapshot.projectActions.find(row => row.id === actionId && !row.deletedAt);
  if (!action || !snapshot.projects.some(project => project.id === action.projectId && !project.deletedAt)) throw new Error("프로젝트 작업을 찾을 수 없습니다.");
  if (action.status === "DONE") throw new Error("완료된 작업입니다. 다시 진행할 경우 완료를 취소해 주세요.");
  const existing = snapshot.tasks.find(row => row.projectActionId === actionId || row.id === taskId);
  if (existing) {
    if (existing.actionOwnerScope && existing.actionOwnerScope !== ownerScope) throw new Error("다른 계정의 할 일에는 연결할 수 없습니다.");
    if (existing.deletedAt) throw new Error("연결된 할 일이 삭제되어 있습니다. 복원한 뒤 다시 계획해 주세요.");
    if (existing.projectActionId !== actionId) throw new Error("같은 식별자의 다른 일정이 있습니다. 원본을 확인해 주세요.");
    const task = updateTask(existing, { plannedDate: date }, deviceId);
    return syncLinkedProjectAction({ ...snapshot, tasks: snapshot.tasks.map(row => row.id === task.id ? task : row) }, task);
  }
  const base = createTask(action.title, getNextOrderIndex(snapshot.tasks), deviceId, null, null, date);
  const task: Task = {
    ...base, ...normalizeActionFields(base), id: taskId, projectActionId: actionId,
    sourceNamespace: PROJECT_TASK_NAMESPACE, externalKey: actionId, actionOwnerScope: ownerScope,
    completedAt: null, skippedAt: null,
  };
  return { ...snapshot, tasks: [...snapshot.tasks, task] };
}
