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

export function App() {
  const memo = useLocalSyncMemo();
  const github = useGitHubIntegration();
  const { setThemeMode, themeMode } = useThemeMode();
  const [activeView, setActiveView] = useState<AppTab>("home");
  const [recordSection, setRecordSection] = useState<RecordSection>("all");
  const [selectedDate, setSelectedDate] = useState(formatLocalDate());
  const projectWorkspaceState = useMemo(
    () =>
      projectWorkspaceStateFromRuntime({
        projects: memo.projects,
        projectMilestones: memo.projectMilestones,
        projectActions: memo.projectActions,
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
  const quickCapture = useQuickCapture({
    onAddMemo: memo.addNoteForDate,
    onAddTask: memo.addTask,
  });
  const snapshot: LocalDataSnapshot = useMemo(
    () => ({
      notes: memo.notes,
      tasks: memo.tasks,
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

  function openRecords(section: RecordSection = "all", date?: string) {
    setRecordSection(section);
    if (date) setSelectedDate(date);
    setActiveView("records");
  }

  return (
    <div className="app-shell personal-os-shell flex w-full min-w-0 justify-center bg-slate-200 text-slate-900 dark:bg-black dark:text-neutral-100">
      <div className="relative flex h-full min-h-0 w-full max-w-[520px] min-w-0 flex-col border-x border-slate-300 bg-slate-100 shadow-panel dark:border-neutral-800 dark:bg-black dark:shadow-none">
        <HeaderBar
          activeView={activeView}
          device={memo.device}
          syncStatus={memo.syncStatus}
          saveState={memo.saveState}
        />

        {memo.error ? <StatusBanner message={memo.error} /> : null}

        <main className="os-main min-h-0 flex-1 overflow-hidden px-3 pb-2 pt-3" aria-label={APP_TAB_LABELS[activeView]}>
          <div className="os-tab-panel h-full min-h-0">
            {activeView === "home" ? (
              <HomePanel
                snapshot={snapshot}
                syncStatus={memo.syncStatus}
                onOpenRecords={openRecords}
                onOpenProjects={() => setActiveView("projects")}
                onQuickCapture={quickCapture.open}
              />
            ) : activeView === "settings" ? (
              <SettingsPanel
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
              <DevControlPanel
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
                  void openWorkspace({ mode: "view", projectId }).catch((error: unknown) => {
                    console.error("프로젝트 작업 공간을 열지 못했습니다.", error);
                  });
                }}
                onCreateProjectWorkspace={() => {
                  memo.setSelectedProjectId(null);
                  void openWorkspace({ mode: "create", projectId: null }).catch((error: unknown) => {
                    console.error("프로젝트 작업 공간을 열지 못했습니다.", error);
                  });
                }}
                actions={memo}
                github={github}
              />
            ) : null}
          </div>
        </main>

        <BottomNavigation activeTab={activeView} onChangeTab={setActiveView} />

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
      </div>
    </div>
  );
}
