import { useEffect, useMemo, useState } from "react";
import type {
  BackfillInput,
  LocalDataSnapshot,
} from "../../types";
import type {
  FinanceDailySummary,
  SyncStatus,
} from "../../lib/sync/syncTypes";
import { QuickActionOverlay } from "../command-center/quickActions/QuickActionOverlay";
import { useQuickActionState } from "../command-center/quickActions/useQuickActionState";
import { formatLocalDate } from "../fitness/fitnessDate";
import { useFinanceCalendar } from "../finance/useFinanceCalendar";
import { FinanceDailyCard } from "./components/FinanceDailyCard";
import { RecordsOverview } from "./components/RecordsOverview";
import { SelectedDateRecords } from "./components/SelectedDateRecords";
import { RecordCalendar } from "./RecordCalendar";
import { getCalendarMarkers, getRecordsForDate } from "./recordAggregation";
import type { Task } from "../../types";
import type { ActionActions } from "../actions/useActionActions";
import { ActionImportDialog } from "../actions/ActionImportDialog";
import { ActionDetailDialog } from "../actions/ActionDetailDialog";
import { ActionSummary } from "../actions/ActionSummary";
import { actionButtonClass } from "../actions/ActionDialog";
import { isUndatedAction, firstActionDate } from "../actions/actionCalendar";

interface RecordsPanelProps {
  actionActions?: ActionActions;
  onManualSync?: () => Promise<void>;
  isAuthenticated?: boolean;
  selectedDate: string;
  snapshot: LocalDataSnapshot;
  syncStatus: SyncStatus;
  financeEnabled: boolean;
  loadFinanceDailySummaries: (
    fromDate: string,
    toDate: string,
  ) => Promise<FinanceDailySummary[]>;
  onAddNoteForDate: (
    date: string,
    title: string,
    content: string,
    backfillInput?: BackfillInput,
  ) => void;
  onAddTask: (
    text: string,
    dueDate: string | null,
    dueTime: string | null,
    plannedDate?: string | null,
    backfillInput?: BackfillInput,
  ) => void;
  onDeleteNote: (noteId: string) => void;
  onDeleteTask: (taskId: string) => void;
  onSelectDate: (date: string) => void;
  onToggleTask: (taskId: string) => void;
}

export function RecordsPanel({
  actionActions,
  onManualSync,
  isAuthenticated,
  selectedDate,
  snapshot,
  syncStatus,
  financeEnabled,
  loadFinanceDailySummaries,
  onAddNoteForDate,
  onAddTask,
  onDeleteNote,
  onDeleteTask,
  onSelectDate,
  onToggleTask,
}: RecordsPanelProps) {
  const today = formatLocalDate();
  const [visibleMonth, setVisibleMonth] = useState(selectedDate);
  const [importOpen, setImportOpen] = useState(false);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [proposal, setProposal] = useState<Task | undefined>();
  const [showCandidates, setShowCandidates] = useState(true);
  const [hideCompleted, setHideCompleted] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const calendarSnapshot = useMemo(() => ({ ...snapshot, tasks: snapshot.tasks.filter(task =>
    (showCandidates || task.registrationState !== "CANDIDATE") && (!hideCompleted || !task.isDone)) }), [snapshot, showCandidates, hideCompleted]);
  const undated = calendarSnapshot.tasks.filter(isUndatedAction);
  const detailTask = snapshot.tasks.find(task => task.id === detailId);
  const conflicts = snapshot.syncState?.pending.filter(item => item.conflictTask) ?? [];
  const localActions = snapshot.tasks.filter(task => task.actionOwnerScope?.startsWith("local:"));
  function openTask(id: string, nextProposal?: Task) {
    setImportOpen(false); setDetailId(id); setProposal(nextProposal);
    const task = snapshot.tasks.find(row => row.id === id);
    const date = task && firstActionDate(task);
    if (date) onSelectDate(date);
  }
  const {
    error: financeError,
    financeByDate,
    isLoading: isFinanceLoading,
    refresh: refreshFinance,
  } = useFinanceCalendar({
    enabled: financeEnabled,
    visibleMonth,
    loadSummaries: loadFinanceDailySummaries,
  });
  const {
    closeQuickAction,
    isQuickActionOpen,
    openQuickAction,
    quickActionDate,
    quickActionMode,
  } = useQuickActionState();
  const selectedRecords = useMemo(
    () => getRecordsForDate(calendarSnapshot, selectedDate),
    [selectedDate, calendarSnapshot],
  );
  const markerByDate = useMemo(
    () => getCalendarMarkers(calendarSnapshot, visibleMonth),
    [calendarSnapshot, visibleMonth],
  );
  const selectedFinance = financeByDate[selectedDate];
  useEffect(() => {
    setVisibleMonth(selectedDate);
  }, [selectedDate]);

  function openBackfillAction(sourceElement: HTMLElement) {
    const shouldOpen = window.confirm(
      "지난 날짜에 기록을 추가합니다. 이 항목은 누락 보강으로 표시됩니다.",
    );

    if (shouldOpen) {
      openQuickAction(selectedDate, sourceElement, "backfill");
    }
  }

  return (
    <section className="flex h-full min-h-0 flex-col gap-3 overflow-y-auto">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div><h2 className="text-base font-semibold text-slate-950 dark:text-neutral-100">일정과 기록</h2><p className="text-xs text-slate-600 dark:text-neutral-300">접수기간 · 계획일 · 마감 · 시험·행사</p></div>
        {actionActions && <button type="button" className={actionButtonClass} onClick={() => setImportOpen(true)}>일정 가져오기</button>}
      </div>
      <div className="flex flex-wrap gap-4 text-sm text-slate-700 dark:text-neutral-200">
        <label className="flex min-h-11 items-center gap-2"><input type="checkbox" checked={showCandidates} onChange={event => setShowCandidates(event.target.checked)} className="h-5 w-5 accent-teal-700" />후보 함께 보기</label>
        <label className="flex min-h-11 items-center gap-2"><input type="checkbox" checked={hideCompleted} onChange={event => setHideCompleted(event.target.checked)} className="h-5 w-5 accent-teal-700" />완료 숨기기</label>
      </div>
      {conflicts.length > 0 && <div role="status" className="rounded-md border border-amber-400 p-3 text-sm">
        <p className="font-semibold">기존 일정과 다른 제안 {conflicts.length}개</p>
        {conflicts.map(item => <button key={item.id} type="button" className={actionButtonClass + " mt-2"} onClick={() => openTask(item.id)}>검토: {snapshot.tasks.find(task => task.id === item.id)?.text}</button>)}
      </div>}
      {isAuthenticated && localActions.length > 0 && actionActions && <div className="space-y-2 rounded-md border border-slate-300 p-3 dark:border-neutral-700">
        <p className="text-sm">이 기기에만 저장된 일정 {localActions.length}개를 현재 로그인 계정으로 가져오면 다른 기기에서도 확인할 수 있습니다.</p>
        <button type="button" className={actionButtonClass} onClick={() => { setActionError(null); void actionActions.adoptLocalActions().then(() => onManualSync?.()).catch(error => setActionError(error instanceof Error ? error.message : "계정 가져오기에 실패했습니다.")); }}>현재 계정으로 가져오기</button>
      </div>}
      {actionError && <p role="alert" className="text-sm text-red-800 dark:text-red-200">{actionError}</p>}
      <RecordCalendar
        markerByDate={markerByDate}
        financeByDate={financeByDate}
        selectedDate={selectedDate}
        visibleMonth={visibleMonth}
        onSelectDate={onSelectDate}
        onVisibleMonthChange={setVisibleMonth}
      />

      <FinanceDailyCard
        financeEnabled={financeEnabled}
        financeError={financeError}
        isFinanceLoading={isFinanceLoading}
        onRefresh={refreshFinance}
        selectedDate={selectedDate}
        selectedFinance={selectedFinance}
      />

      <SelectedDateRecords
        onOpenTask={actionActions ? openTask : undefined}
        onDeleteNote={onDeleteNote}
        onDeleteTask={onDeleteTask}
        onOpenBackfillAction={openBackfillAction}
        onOpenQuickAction={openQuickAction}
        onToggleTask={onToggleTask}
        records={selectedRecords}
        selectedDate={selectedDate}
        today={today}
      />
      <details className="rounded-md border border-slate-300 bg-white p-3 dark:border-neutral-800 dark:bg-black" open={undated.length > 0 || undefined}>
        <summary className="cursor-pointer py-2 text-sm font-semibold">날짜 미정 {undated.length}개</summary>
        {undated.length === 0 ? <p className="py-2 text-sm text-slate-600 dark:text-neutral-300">날짜가 없는 일정이 없습니다.</p> :
          <ul className="divide-y divide-slate-200 dark:divide-neutral-800">{undated.map(task => <li key={task.id} className="py-3">
            <button type="button" disabled={!actionActions} className="min-h-11 w-full break-words text-left text-sm font-semibold text-teal-800 underline-offset-4 hover:underline dark:text-teal-300" onClick={() => openTask(task.id)}>{task.text}</button>
            <ActionSummary task={task} />
          </li>)}</ul>}
      </details>

      <RecordsOverview
        selectedDate={selectedDate}
        snapshot={snapshot}
        syncStatus={syncStatus}
        today={today}
      />

      {isQuickActionOpen && quickActionDate ? (
        <QuickActionOverlay
          isBackfill={quickActionMode === "backfill"}
          selectedDate={quickActionDate}
          onAddNote={onAddNoteForDate}
          onAddTask={onAddTask}
          onClose={closeQuickAction}
        />
      ) : null}
      {importOpen && actionActions && <ActionImportDialog tasks={snapshot.tasks} actions={actionActions} onClose={() => setImportOpen(false)} onOpenTask={openTask} />}
      {detailTask && actionActions && <ActionDetailDialog key={detailTask.id} task={detailTask} proposal={proposal}
        pending={snapshot.syncState?.pending.find(item => item.collection === "tasks" && item.id === detailTask.id)}
        actions={actionActions} onClose={() => { setDetailId(null); setProposal(undefined); }} onDelete={onDeleteTask} onSync={onManualSync} />}
    </section>
  );
}
