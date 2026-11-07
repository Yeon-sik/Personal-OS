import { useMemo, useState } from "react";
import { getVisibleNotes } from "../features/notes/noteService";
import { useNoteActions } from "../features/notes/useNoteActions";
import { getVisibleTasks } from "../features/tasks/taskService";
import { actionId } from "../features/actions/actionIdentity";
import { calendarDate } from "../features/actions/actionTime";
import { PROJECT_TASK_NAMESPACE, planProjectTask, syncLinkedProjectAction } from "../features/tasks/projectTaskLink";
import { useTaskActions } from "../features/tasks/useTaskActions";
import { useActionActions } from "../features/actions/useActionActions";
import { useDevControlActions } from "../features/dev-control/useDevControlActions";
import { useKnowledgeVaultRuntime } from "../features/knowledge-vault/useKnowledgeVaultRuntime";
import {
  getVisibleProjects,
  getVisibleWorkstreams,
} from "../features/dev-control/devControlService";
import { localStorageAdapter } from "../lib/storage/localStorageAdapter";
import type { StorageAdapter } from "../lib/storage/storageAdapter";
import type { SyncClient } from "../lib/sync/syncTypes";
import { useMemoSyncRuntime } from "./sync/useMemoSyncRuntime";

// Public facade used by App. Runtime orchestration and domain mutations live in
// focused hooks, while this function keeps the existing return contract intact.
export function useLocalSyncMemo(
  storage: StorageAdapter = localStorageAdapter,
  injectedSyncClient?: SyncClient,
  injectedUserId?: string,
) {
  const runtime = useMemoSyncRuntime(
    storage,
    injectedSyncClient,
    injectedUserId,
  );
  const visibleNotes = useMemo(
    () => getVisibleNotes(runtime.snapshot.notes),
    [runtime.snapshot.notes],
  );
  const visibleTasks = useMemo(
    () => getVisibleTasks(runtime.snapshot.tasks),
    [runtime.snapshot.tasks],
  );
  const visibleProjects = useMemo(
    () => getVisibleProjects(runtime.snapshot.projects),
    [runtime.snapshot.projects],
  );
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [selectedWorkstreamId, setSelectedWorkstreamId] = useState<string | null>(
    null,
  );
  const visibleWorkstreams = useMemo(
    () => getVisibleWorkstreams(runtime.snapshot.workstreams),
    [runtime.snapshot.workstreams],
  );
  const visibleKnowledgeDocuments = useMemo(
    () =>
      runtime.snapshot.knowledgeDocuments
        .filter((document) => document.deletedAt === null)
        .sort((first, second) => first.title.localeCompare(second.title)),
    [runtime.snapshot.knowledgeDocuments],
  );
  const visibleFitnessSummaryProjections = useMemo(
    () =>
      runtime.snapshot.fitnessSummaryProjections
        .filter(
          (projection) =>
            projection.deletedAt === null &&
            projection.completionStatus === "completed" && projection.contractVersion === 2,
        )
        .sort((first, second) => {
          if (first.date !== second.date) {
            return first.date.localeCompare(second.date);
          }
          return first.updatedAt.localeCompare(second.updatedAt);
        }),
    [runtime.snapshot.fitnessSummaryProjections],
  );
  const visibleFitnessSharedWorkoutRecords = useMemo(() => {
    const projectedSessionIds = new Set(
      runtime.snapshot.fitnessSummaryProjections.map(
        (projection) => projection.sourceFitnessSessionId,
      ),
    );
    return (runtime.snapshot.fitnessSharedWorkoutRecords ?? []).filter(
      (record) => !projectedSessionIds.has(record.id),
    );
  }, [
    runtime.snapshot.fitnessSharedWorkoutRecords,
    runtime.snapshot.fitnessSummaryProjections,
  ]);
  const selectedNote = useMemo(
    () =>
      visibleNotes.find((note) => note.id === runtime.selectedNoteId) ?? null,
    [runtime.selectedNoteId, visibleNotes],
  );
  const noteActions = useNoteActions({
    commitSnapshot: runtime.commitSnapshot,
    device: runtime.device,
    selectedNoteId: runtime.selectedNoteId,
    setSelectedNoteId: runtime.setSelectedNoteId,
    visibleNotes,
  });
  const [taskError, setTaskError] = useState<string | null>(null);
  const taskActions = useTaskActions({
    snapshot: runtime.snapshot,
    onError: setTaskError,
    transformTaskSnapshot: syncLinkedProjectAction,
    commitSnapshot: runtime.commitSnapshot,
    device: runtime.device,
  });
  const actionActions = useActionActions({ ...runtime, transformTaskSnapshot: syncLinkedProjectAction });
  const devControlActions = useDevControlActions({
    commitSnapshot: runtime.commitSnapshot,
    snapshot: runtime.snapshot,
    device: runtime.device,
    selectedProjectId,
    setSelectedProjectId,
    selectedWorkstreamId,
    setSelectedWorkstreamId,
  });
  const planProjectAction = (id: string, date = calendarDate()) => {
    if (!runtime.device) return;
    setTaskError(null);
    const owner = runtime.snapshot.syncState?.scope?.userId ?? (runtime.isAuthenticated ? runtime.userId : `local:${runtime.device.id}`);
    const deviceId = runtime.device.id;
    void actionId(owner, PROJECT_TASK_NAMESPACE, id).then(taskId => runtime.commitDurably(current => {
      const currentOwner = current.syncState?.scope?.userId ?? owner;
      if (currentOwner !== owner) throw new Error("계정이 변경되었습니다. 다시 시도해 주세요.");
      return planProjectTask(current, id, taskId, date, deviceId, owner);
    })).catch(error => setTaskError(error instanceof Error ? error.message : "할 일 연결에 실패했습니다."));
  };
  const updateLinkedProjectAction: typeof devControlActions.updateProjectAction = (id, changes) => {
    const task = runtime.snapshot.tasks.find(row => row.projectActionId === id && !row.deletedAt);
    if (!task) { devControlActions.updateProjectAction(id, changes); return; }
    if (changes.type !== undefined) devControlActions.updateProjectAction(id, { type: changes.type });
    setTaskError(null);
    if (changes.status !== undefined) {
      void actionActions.updateAction(task.id, task.updatedAt, {
        isDone: changes.status === "DONE",
        ...(changes.title !== undefined ? { text: changes.title } : {}),
      }).catch(error => setTaskError(error instanceof Error ? error.message : "완료 상태 변경에 실패했습니다."));
    } else if (changes.title !== undefined) taskActions.updateTaskText(task.id, changes.title);
  };
  const knowledgeVault = useKnowledgeVaultRuntime({
    snapshot: runtime.snapshot,
    isReady: runtime.isReady,
    commitSnapshot: runtime.commitSnapshot,
  });
  return {
    activeDevices: runtime.activeDevices,
    authEmail: runtime.authEmail,
    ...noteActions,
    ...taskActions,
    actionActions,
    calendarTasks: runtime.snapshot.tasks,
    actionSyncState: runtime.snapshot.syncState,
    autostartEnabled: runtime.autostartEnabled,
    autostartSupported: runtime.autostartSupported,
    device: runtime.device,
    projectActions: runtime.snapshot.projectActions,
    projectHistory: runtime.snapshot.projectHistory,
    workstreamActions: runtime.snapshot.workstreamActions,
    workstreamActionDependencies:
      runtime.snapshot.workstreamActionDependencies,
    workstreamActionProjects: runtime.snapshot.workstreamActionProjects,
    workstreamMilestones: runtime.snapshot.workstreamMilestones,
    workstreamProjects: runtime.snapshot.workstreamProjects,
    workstreams: visibleWorkstreams,
    projectIdeas: runtime.snapshot.projectIdeas,
    projectMilestones: runtime.snapshot.projectMilestones,
    projects: visibleProjects,
    error: taskError ?? runtime.error,
    taskPlanningError: taskError,
    projectTaskLinks: Object.fromEntries(runtime.snapshot.tasks.filter(task => task.projectActionId && !task.deletedAt).map(task => [task.projectActionId!, task.plannedDate])),
    fitnessSummaryProjections: visibleFitnessSummaryProjections,
    fitnessSharedWorkoutRecords: visibleFitnessSharedWorkoutRecords,
    fitnessNutritionSummaries: runtime.snapshot.fitnessNutritionSummaries,
    fitnessWeightRecords: runtime.snapshot.fitnessWeightRecords ?? [],
    isAuthenticated: runtime.isAuthenticated,
    isManualSyncing: runtime.isManualSyncing,
    isReady: runtime.isReady,
    isSupabaseConfigured: runtime.isSupabaseConfigured,
    knowledgeDocuments: visibleKnowledgeDocuments,
    knowledgeVault,
    loadFinanceDailySummaries: runtime.loadFinanceDailySummaries,
    manualSync: runtime.manualSync,
    // Legacy source records remain available for archive compatibility only.
    mealRecords: runtime.snapshot.mealRecords,
    notes: visibleNotes,
    saveState: runtime.saveState,
    saveSupabaseConfig: runtime.saveSupabaseConfig,
    selectedNote,
    selectedNoteId: runtime.selectedNoteId,
    selectedProjectId,
    setSelectedProjectId,
    selectedWorkstreamId,
    setSelectedWorkstreamId,
    setAutostartEnabled: runtime.setAutostartEnabled,
    signIn: runtime.signIn,
    signOut: runtime.signOut,
    supabaseConfig: runtime.supabaseConfig,
    syncStatus: runtime.syncStatus,
    tasks: visibleTasks,
    userId: runtime.userId,
    // Legacy archive; RecordsOverview gates weight display on a successful pull.
    weightRecords: runtime.snapshot.weightRecords,
    // Legacy archive only; live workouts come from v2 projections.
    workoutRecords: runtime.snapshot.workoutRecords,
    ...devControlActions,
    planProjectAction,
    updateProjectAction: updateLinkedProjectAction,
  };
}
