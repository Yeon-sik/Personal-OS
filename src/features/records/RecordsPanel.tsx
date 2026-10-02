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

interface RecordsPanelProps {
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
    () => getRecordsForDate(snapshot, selectedDate),
    [selectedDate, snapshot],
  );
  const markerByDate = useMemo(
    () => getCalendarMarkers(snapshot, visibleMonth),
    [snapshot, visibleMonth],
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
        onDeleteNote={onDeleteNote}
        onDeleteTask={onDeleteTask}
        onOpenBackfillAction={openBackfillAction}
        onOpenQuickAction={openQuickAction}
        onToggleTask={onToggleTask}
        records={selectedRecords}
        selectedDate={selectedDate}
        today={today}
      />

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
    </section>
  );
}
