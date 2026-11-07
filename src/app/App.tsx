import { getPlatformCapabilities } from "../lib/platform/capabilities";
import { ProjectWorkspace } from "../features/dev-control/workspace/ProjectWorkspace";
import type { ProjectWorkspaceSelection } from "../features/dev-control/workspace/projectWorkspaceBridge";
import { useMemo, useState } from "react";
import { Command } from "lucide-react";
import type { LocalDataSnapshot } from "../types";
import { HeaderBar } from "../components/HeaderBar";
import { BottomNavigation } from "../components/BottomNavigation";
import { StatusBanner } from "../components/StatusBanner";
import { SettingsPanel } from "../components/SettingsPanel";
import { FitnessPanel } from "../features/fitness/FitnessPanel";
import { formatLocalDate } from "../features/fitness/fitnessDate";
import { MemoPanel } from "../features/notes/MemoPanel";
import { QuickCapturePanel } from "../features/quick-capture/QuickCapturePanel";
import { useQuickCapture } from "../features/quick-capture/useQuickCapture";
import { RecordsPanel } from "../features/records/RecordsPanel";
import { RecordHub } from "../features/records/RecordHub";
import { HomePanel } from "../features/home/HomePanel";
import { ChecklistPanel } from "../features/tasks/ChecklistPanel";
import { DevControlPanel } from "../features/dev-control/DevControlPanel";
import { useGitHubIntegration } from "../features/dev-control/github/useGitHubIntegration";
import {
  projectWorkspaceStateFromRuntime,
  useProjectWorkspaceHost,
} from "../features/dev-control/workspace/projectWorkspaceBridge";
import { useLocalSyncMemo } from "./useLocalSyncMemo";
import { useThemeMode } from "./useThemeMode";
import { APP_TAB_LABELS, type AppTab, type RecordSection } from "./navigation";
import { useDeadlineNotifications } from "../features/deadline-notifications/useDeadlineNotifications";
import { ActionDetailDialog } from "../features/actions/ActionDetailDialog";

export function App() {
  const memo = useLocalSyncMemo();
  const github = useGitHubIntegration();
  const { setThemeMode, themeMode } = useThemeMode();
  const [inlineWorkspace, setInlineWorkspace] = useState<ProjectWorkspaceSelection | null>(null);
  const [workspaceError, setWorkspaceError] = useState<string | null>(null);
  const [activeView, setActiveView] = useState<AppTab>("home");
  const [recordSection, setRecordSection] = useState<RecordSection>("all");
  const [selectedDate, setSelectedDate] = useState(formatLocalDate());
  const [homeAction, setHomeAction] = useState<{ id: string; scope: string } | null>(null);
  const connectionScope = JSON.stringify([memo.supabaseConfig?.supabaseUrl ?? "local", memo.userId ?? "local", Boolean(memo.isAuthenticated)]);
  const projectWorkspaceState = useMemo(
    () =>
      projectWorkspaceStateFromRuntime({
        projects: memo.projects,
        projectMilestones: memo.projectMilestones,
        projectActions: memo.projectActions,
        projectTaskLinks: memo.projectTaskLinks,
        taskPlanningError: memo.taskPlanningError,
        projectIdeas: memo.projectIdeas,
        projectHistory: memo.projectHistory,
        workstreams: memo.workstreams,
        workstreamProjects: memo.workstreamProjects,
        workstreamActions: memo.workstreamActions,
        workstreamMilestones: memo.workstreamMilestones,
        workstreamActionProjects: memo.workstreamActionProjects,
        workstreamActionDependencies: memo.workstreamActionDependencies,
        knowledgeDocuments: memo.knowledgeDocuments,
        selectedProjectId: memo.selectedProjectId,
        github,
      }),
    [
      github,
      memo.projectActions,
      memo.projectTaskLinks,
      memo.taskPlanningError,
      memo.projectHistory,
      memo.projectIdeas,
      memo.projectMilestones,
      memo.projects,
      memo.selectedProjectId,
      memo.workstreamActionDependencies,
      memo.workstreamActionProjects,
      memo.workstreamActions,
      memo.workstreamMilestones,
      memo.workstreamProjects,
      memo.workstreams,
      memo.knowledgeDocuments,
    ],
  );
  const { openWorkspace } = useProjectWorkspaceHost({
    state: projectWorkspaceState,
    github,
    actions: memo,
  });
  const openProjectWorkspace = (selection: ProjectWorkspaceSelection) => {
    setWorkspaceError(null);
    if (!getPlatformCapabilities().isTauriDesktop) { setInlineWorkspace(selection); return; }
    void openWorkspace(selection).catch(error => setWorkspaceError(error?.message ?? "프로젝트 작업 공간을 열지 못했습니다."));
  };
  const quickCapture = useQuickCapture({
    onAddMemo: memo.addNoteForDate,
    onAddTask: memo.addTask,
  });
  const snapshot: LocalDataSnapshot = useMemo(
    () => ({
      notes: memo.notes,
      tasks: memo.calendarTasks ?? memo.tasks,
      syncState: memo.actionSyncState,
      workoutRecords: memo.workoutRecords,
      fitnessSharedWorkoutRecords: memo.fitnessSharedWorkoutRecords,
      fitnessSummaryProjections: memo.fitnessSummaryProjections,
      fitnessNutritionSummaries: memo.fitnessNutritionSummaries,
      fitnessWeightRecords: memo.fitnessWeightRecords,
      mealRecords: memo.mealRecords,
      weightRecords: memo.weightRecords,
      devices: memo.activeDevices,
      projects: memo.projects,
      projectMilestones: memo.projectMilestones,
      projectActions: memo.projectActions,
      projectIdeas: memo.projectIdeas,
      projectHistory: memo.projectHistory,
      workstreams: memo.workstreams,
      workstreamProjects: memo.workstreamProjects,
      workstreamMilestones: memo.workstreamMilestones,
      workstreamActions: memo.workstreamActions,
      workstreamActionProjects: memo.workstreamActionProjects,
      workstreamActionDependencies: memo.workstreamActionDependencies,
      knowledgeDocuments: memo.knowledgeDocuments,
    }),
    [
      memo.activeDevices,
      memo.fitnessSharedWorkoutRecords,
      memo.fitnessSummaryProjections,
      memo.fitnessNutritionSummaries,
      memo.fitnessWeightRecords,
      memo.mealRecords,
      memo.notes,
      memo.projectActions,
      memo.projectHistory,
      memo.projectIdeas,
      memo.projectMilestones,
      memo.projects,
      memo.tasks,
      memo.calendarTasks,
      memo.actionSyncState,
      memo.weightRecords,
      memo.workoutRecords,
      memo.workstreamActionDependencies,
      memo.workstreamActionProjects,
      memo.workstreamActions,
      memo.workstreamMilestones,
      memo.workstreamProjects,
      memo.workstreams,
      memo.knowledgeDocuments,
    ],
  );

  const deadlineNotifications = useDeadlineNotifications(snapshot.tasks, memo.isReady,
    JSON.stringify(snapshot.syncState?.scope || { backend: memo.supabaseConfig?.supabaseUrl || "local", userId: memo.userId || "local" }));

  function openRecords(section: RecordSection = "all", date?: string) {
    setRecordSection(section);
    if (date) setSelectedDate(date);
    setActiveView("records");
  }
  const homeTask = homeAction?.scope === connectionScope ? snapshot.tasks.find(task => task.id === homeAction.id && !task.deletedAt) : undefined;

  return (
    <div className="app-shell personal-os-shell flex w-full min-w-0 justify-center bg-slate-200 text-slate-900 dark:bg-black dark:text-neutral-100">
      <div className={`relative flex h-full min-h-0 w-full ${activeView === "home" || (activeView === "records" && recordSection === "all") ? "max-w-6xl" : "max-w-[520px]"} min-w-0 flex-col border-x border-slate-300 bg-slate-100 shadow-panel dark:border-neutral-800 dark:bg-black dark:shadow-none`}>
        <HeaderBar
          activeView={activeView}
          device={memo.device}
          syncStatus={memo.syncStatus}
          saveState={memo.saveState}
        />

        {memo.error ? <StatusBanner message={memo.error} /> : null}
        {workspaceError ? <StatusBanner message={workspaceError} /> : null}

        <main className="os-main min-h-0 flex-1 overflow-hidden px-3 pb-2 pt-3" aria-label={APP_TAB_LABELS[activeView]}>
          <div className="os-tab-panel h-full min-h-0">
            {activeView === "home" ? (
              <HomePanel
                snapshot={snapshot}
                syncStatus={memo.syncStatus}
                onOpenRecords={openRecords}
                onOpenProjects={() => setActiveView("projects")}
                onQuickCapture={quickCapture.open}
                onOpenAction={id => setHomeAction({ id, scope: connectionScope })}
                connectedApps={{
                  enabled: memo.isSupabaseConfigured && memo.isAuthenticated,
                  scopeKey: connectionScope,
                  loadFinanceDailySummaries: memo.loadFinanceDailySummaries,
                  onOpenSettings: () => setActiveView("settings"),
                  onSync: memo.manualSync,
                  isSyncing: memo.isManualSyncing,
                }}
              />
            ) : activeView === "settings" ? (
              <SettingsPanel
                deadlineNotifications={deadlineNotifications}
                activeDevices={memo.activeDevices}
                authEmail={memo.authEmail}
                autostartEnabled={memo.autostartEnabled}
                autostartSupported={memo.autostartSupported}
                currentDeviceId={memo.device?.id ?? null}
                isManualSyncing={memo.isManualSyncing}
                isSupabaseConfigured={memo.isSupabaseConfigured}
                isAuthenticated={memo.isAuthenticated}
                supabaseConfig={memo.supabaseConfig}
                syncStatus={memo.syncStatus}
                themeMode={themeMode}
                userId={memo.userId}
                onChangeThemeMode={setThemeMode}
                quickCaptureShortcutPreference={
                  quickCapture.shortcutPreference
                }
                quickCaptureShortcutStatus={quickCapture.shortcutStatus}
                onManualSync={memo.manualSync}
                onRefreshGitHubStatus={github.refreshStatus}
                onRefreshQuickCaptureShortcutStatus={
                  quickCapture.refreshShortcutStatus
                }
                onSaveSupabaseConfig={memo.saveSupabaseConfig}
                onSignIn={memo.signIn}
                onSignOut={memo.signOut}
                onSaveQuickCaptureShortcutPreference={
                  quickCapture.setShortcutPreference
                }
                onToggleAutostart={memo.setAutostartEnabled}
                knowledgeVault={memo.knowledgeVault}
              />
            ) : activeView === "records" ? (
              <RecordHub activeSection={recordSection} selectedDate={selectedDate} onChangeSection={setRecordSection}>
                {recordSection === "all" ? (
                  <RecordsPanel
                    snapshot={snapshot}
                    selectedDate={selectedDate}
                    syncStatus={memo.syncStatus}
                    financeEnabled={
                      memo.isSupabaseConfigured && memo.isAuthenticated
                    }
                    loadFinanceDailySummaries={memo.loadFinanceDailySummaries}
                    onAddNoteForDate={memo.addNoteForDate}
                    onAddTask={memo.addTask}
                    onDeleteNote={memo.deleteNote}
                    onDeleteTask={memo.deleteTask}
                    onSelectDate={setSelectedDate}
                    onToggleTask={memo.toggleTask}
                    onUpdateDetails={memo.updateTaskDetails}
                    onSkipOccurrence={memo.skipTaskOccurrence}
                    actionActions={memo.actionActions}
                    onManualSync={memo.manualSync}
                    isAuthenticated={memo.isAuthenticated}
                  />
                ) : recordSection === "memo" ? (
                  <MemoPanel
                    notes={memo.notes}
                    selectedNote={memo.selectedNote}
                    selectedNoteId={memo.selectedNoteId}
                    isLoading={!memo.isReady}
                    onCreate={memo.addNote}
                    onDelete={memo.deleteNote}
                    onSelect={memo.selectNote}
                    onChangeTitle={memo.updateSelectedNoteTitle}
                    onChangeContent={memo.updateSelectedNoteContent}
                  />
                ) : recordSection === "tasks" ? (
                  <ChecklistPanel
                    tasks={memo.tasks}
                    onAdd={memo.addTask}
                    onDelete={memo.deleteTask}
                    onReorder={memo.reorderTasks}
                    onToggle={memo.toggleTask}
                    onUpdatePlannedDate={memo.updateTaskPlannedDate}
                    onUpdateSchedule={memo.updateTaskSchedule}
                    onUpdateText={memo.updateTaskText}
                    onUpdateDetails={memo.updateTaskDetails}
                    onSkipOccurrence={memo.skipTaskOccurrence}
                  />
                ) : (
                  <FitnessPanel
                    fitnessSummaryProjections={memo.fitnessSummaryProjections}
                    fitnessSharedWorkoutRecords={memo.fitnessSharedWorkoutRecords}
                    nutritionSummaries={memo.fitnessNutritionSummaries}
                    fitnessWeightRecords={memo.fitnessWeightRecords}
                    syncStatus={memo.syncStatus}
                    selectedDate={selectedDate}
                  />
                )}
              </RecordHub>
            ) : activeView === "projects" ? (
              inlineWorkspace ? <div className="flex h-full min-h-0 flex-col">
                <button type="button" className="min-h-11 shrink-0 rounded border border-slate-300 px-3 text-left text-sm dark:border-neutral-700" onClick={() => setInlineWorkspace(null)}>프로젝트 목록으로</button>
                <div className="min-h-0 flex-1"><ProjectWorkspace {...projectWorkspaceState} embedded mode={inlineWorkspace.mode === "create" && memo.selectedProjectId ? "view" : inlineWorkspace.mode} project={memo.projects.find(project => project.id === inlineWorkspace.projectId) ?? (inlineWorkspace.mode === "create" ? memo.projects.find(project => project.id === memo.selectedProjectId) ?? null : null)} actions={memo} github={github} /></div>
              </div> : <DevControlPanel
                projects={memo.projects}
                projectMilestones={memo.projectMilestones}
                projectActions={memo.projectActions}
                projectIdeas={memo.projectIdeas}
                projectHistory={memo.projectHistory}
                workstreams={memo.workstreams}
                workstreamProjects={memo.workstreamProjects}
                workstreamMilestones={memo.workstreamMilestones}
                workstreamActions={memo.workstreamActions}
                workstreamActionProjects={memo.workstreamActionProjects}
                workstreamActionDependencies={memo.workstreamActionDependencies}
                knowledgeDocuments={memo.knowledgeDocuments}
                selectedWorkstreamId={memo.selectedWorkstreamId}
                onOpenWorkstream={(workstreamId) => {
                  memo.setSelectedWorkstreamId(workstreamId);
                }}
                onCreateWorkstream={() => {
                  memo.setSelectedWorkstreamId(null);
                }}
                selectedProjectId={memo.selectedProjectId}
                onOpenProjectWorkspace={(projectId) => {
                  memo.setSelectedProjectId(projectId);
                  openProjectWorkspace({ mode: "view", projectId });
                }}
                onCreateProjectWorkspace={() => {
                  memo.setSelectedProjectId(null);
                  openProjectWorkspace({ mode: "create", projectId: null });
                }}
                actions={memo}
                github={github}
              />
            ) : null}
          </div>
        </main>

        <BottomNavigation activeTab={activeView} onChangeTab={tab => { setInlineWorkspace(null); setActiveView(tab); }} />

        <button
          type="button"
          onClick={quickCapture.open}
          className="os-quick-capture inline-flex items-center justify-center rounded-full bg-neutral-950 text-white shadow-lg shadow-black/20 hover:bg-neutral-800 dark:bg-neutral-100 dark:text-black dark:hover:bg-white"
          aria-label="빠른 입력 열기"
          title="빠른 입력"
        >
          <Command className="h-5 w-5" aria-hidden="true" />
        </button>

        <QuickCapturePanel
          isOpen={quickCapture.isOpen}
          mode={quickCapture.mode}
          shortcutStatus={quickCapture.shortcutStatus}
          onClose={quickCapture.close}
          onModeChange={quickCapture.setMode}
          onSave={quickCapture.saveDraft}
        />
        {homeTask && memo.actionActions && <ActionDetailDialog key={homeTask.id} task={homeTask}
          pending={snapshot.syncState?.pending.find(item => item.collection === "tasks" && item.id === homeTask.id)}
          onUpdateDetails={memo.updateTaskDetails} onSkipOccurrence={memo.skipTaskOccurrence} onToggle={memo.toggleTask}
          actions={memo.actionActions} onClose={() => setHomeAction(null)} onDelete={memo.deleteTask} onSync={memo.manualSync} />}
      </div>
    </div>
  );
}
