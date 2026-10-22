import { useCallback } from "react";
import type { Device, LocalDataSnapshot, Task } from "../../types";
import type { SnapshotUpdater } from "../../app/sync/useSnapshotStore";
import { applyImportedTasks, editAction, prepareImport, type ActionEdit, type ImportOutcome, type ImportSelection } from "./actionImport";
import { actionId } from "./actionIdentity";
import { nextTaskTimestamp } from "./actionModel";
import type { PendingRevision } from "../../lib/sync/syncState";

export interface ActionActions {
  importActions: (selection: ImportSelection[]) => Promise<ImportOutcome[]>;
  updateAction: (id: string, revision: string, changes: Partial<ActionEdit>, sourceChecked?: boolean) => Promise<void>;
  resolveActionConflict: (id: string, keepLocal: boolean) => Promise<void>;
  adoptLocalActions: () => Promise<void>;
  restoreAction: (id: string, revision: string) => Promise<void>;
}
interface Options {
  snapshot: LocalDataSnapshot;
  device: Device | null;
  userId: string;
  isAuthenticated: boolean;
  commitDurably: (updater: SnapshotUpdater, track?: boolean) => Promise<void>;
}
export function useActionActions({ snapshot, device, userId, isAuthenticated, commitDurably }: Options): ActionActions {
  const ownerScope = snapshot.syncState?.scope?.userId ?? (isAuthenticated ? userId : "local:" + device?.id);
  const importActions = useCallback(async (selection: ImportSelection[]) => {
    if (!device) throw new Error("앱이 준비된 뒤 다시 시도해 주세요.");
    const tasks = await prepareImport(selection, ownerScope, device.id);
    const outcomes: ImportOutcome[] = [];
    await commitDurably(current => {
      if ((current.syncState?.scope?.userId ?? ownerScope) !== ownerScope) throw new Error("계정이 변경되었습니다. 가져오기를 다시 열어 주세요.");
      return applyImportedTasks(current, tasks, outcomes);
    });
    return outcomes;
  }, [device, ownerScope, commitDurably]);
  const updateAction = useCallback(async (id: string, revision: string, changes: Partial<ActionEdit>, sourceChecked = false) => {
    if (!device) throw new Error("앱이 준비되지 않았습니다.");
    await commitDurably(current => {
      const task = current.tasks.find(row => row.id === id);
      if (!task || task.deletedAt || task.updatedAt !== revision) throw new Error("일정이 변경되었습니다. 상세를 다시 열고 확인해 주세요.");
      return { ...current, tasks: current.tasks.map(row => row.id === id ? editAction(row, changes, device.id, ownerScope, sourceChecked) : row) };
    });
  }, [commitDurably, device, ownerScope]);
  const restoreAction = useCallback(async (id: string, revision: string) => {
    if (!device) return;
    await commitDurably(current => {
      const task = current.tasks.find(row => row.id === id);
      if (!task?.deletedAt || task.updatedAt !== revision) throw new Error("삭제 상태가 변경되었습니다. 다시 확인해 주세요.");
      return { ...current, tasks: current.tasks.map(row => row.id === id ? { ...row, deletedAt: null, deviceId: device.id, updatedAt: nextTaskTimestamp(row.updatedAt) } : row) };
    });
  }, [commitDurably, device]);
  const resolveActionConflict = useCallback(async (id: string, keepLocal: boolean) => {
    if (!device) return;
    await commitDurably(current => {
      const state = current.syncState;
      const pending = state?.pending.find(item => item.id === id && item.collection === "tasks");
      const local = current.tasks.find(row => row.id === id);
      if (!state || !pending?.conflictTask || !local) throw new Error("검토할 충돌을 찾지 못했습니다.");
      const remote = pending.conflictTask;
      if (remote.id !== local.id) throw new Error("일정 식별자가 달라 자동 처리할 수 없습니다. 원본을 보존하고 동기화 상태를 확인해 주세요.");
      const task: Task = keepLocal ? {
        ...local, deviceId: device.id,
        updatedAt: nextTaskTimestamp(remote.updatedAt > local.updatedAt ? remote.updatedAt : local.updatedAt),
        ...(local.sourceType === "EXTERNAL_NOTICE" ? { verificationStatus: "UNVERIFIED" as const, sourceCheckedAt: null, sourceCheckedBy: null } : {}),
      } : remote;
      // The chosen server row is not a fresh local edit. Local choice becomes an
      // ordinary explicit edit after the ensure operation has been resolved.
      const nextPending = state.pending.filter(item => !(item.collection === "tasks" && item.id === id));
      if (keepLocal) nextPending.push({ collection: "tasks", id, revision: state.nextRevision + 1 });
      return {
        ...current, tasks: current.tasks.map(row => row.id === id ? task : row),
        syncState: { ...state, pending: nextPending, nextRevision: state.nextRevision + (keepLocal ? 1 : 0) },
      };
    }, false);
  }, [device, commitDurably]);
  const adoptLocalActions = useCallback(async () => {
    if (!device || !isAuthenticated) throw new Error("계정에 로그인한 뒤 가져올 수 있습니다.");
    const local = snapshot.tasks.filter(task => task.actionOwnerScope?.startsWith("local:"));
    const translated = await Promise.all(local.map(async task => ({
      oldId: task.id, base: JSON.stringify(task), task: {
        ...task, id: task.externalKey ? await actionId(userId, task.sourceNamespace!, task.externalKey) : task.id,
        actionOwnerScope: userId, deviceId: device.id, updatedAt: nextTaskTimestamp(task.updatedAt),
        ...(task.sourceType === "EXTERNAL_NOTICE" ? { verificationStatus: "UNVERIFIED" as const, sourceCheckedAt: null, sourceCheckedBy: null } : {}),
      },
    })));
    await commitDurably(current => {
      if (!current.syncState || current.syncState.scope?.userId !== userId) throw new Error("동기화 계정을 다시 확인해 주세요.");
      for (const item of translated) if (JSON.stringify(current.tasks.find(task => task.id === item.oldId)) !== item.base) throw new Error("로컬 일정이 변경되었습니다. 다시 가져와 주세요.");
      for (const item of translated) if (item.oldId !== item.task.id && current.tasks.some(task => task.id === item.task.id)) {
        if (current.syncState.pending.some(pending => pending.collection === "tasks" && pending.id === item.task.id)) {
          throw new Error("계정에 같은 일정의 동기화 대기 수정이 있습니다. 먼저 동기화한 뒤 다시 가져오세요. 양쪽 내용은 보존했습니다.");
        }
      }
      const ids = new Set(translated.flatMap(item => [item.oldId, item.task.id]));
      let revision = current.syncState.nextRevision;
      const pending: PendingRevision[] = current.syncState.pending.filter(item => item.collection !== "tasks" || !ids.has(item.id));
      const tasks = current.tasks.filter(task => !ids.has(task.id));
      for (const { task } of translated) {
        tasks.push(task);
        const existing = current.tasks.find(row => row.id === task.id);
        pending.push({ collection: "tasks", id: task.id, revision: ++revision,
          ...(task.externalKey ? { operation: "ENSURE_ACTION" as const, initialTask: task, ...(existing ? { conflictTask: existing } : {}) } : {}),
        });
      }
      return { ...current, tasks, syncState: { ...current.syncState, pending, nextRevision: revision } };
    }, false);
  }, [device, isAuthenticated, snapshot.tasks, userId, commitDurably]);
  return { importActions, updateAction, resolveActionConflict, adoptLocalActions, restoreAction };
}
