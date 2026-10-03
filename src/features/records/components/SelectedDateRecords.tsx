import {
  CalendarDays,
  CheckSquare,
  Dumbbell,
  Salad,
  Scale,
  StickyNote,
} from "lucide-react";
import type { MealRecord, WeightRecord } from "../../../types";
import { formatSharedWorkoutLabels, type SharedWorkoutSummary } from "../../fitness-summary/sharedWorkoutSummaries";
import {
  BACKFILL_LABEL,
  hasBackfillMetadata,
  isFutureLocalDate,
  isPastLocalDate,
} from "../../../lib/dataTrust/backfillMetadata";
import { formatKoreanDate } from "../../fitness/fitnessDate";
import { formatMetric } from "../../fitness/stats/fitnessStats";
import { getPlainTextFromNoteContent } from "../../notes/noteService";
import type { DateRecords } from "../recordAggregation";
import { formatRecordTime, formatTaskDueLabel } from "../recordDisplayFormatters";
import { DailyItem, DailySection, DeleteItemButton } from "./DailyRecordSection";
import { MarkerLegend } from "./RecordMarkerLegend";

interface SelectedDateRecordsProps {
  onDeleteNote: (noteId: string) => void;
  onDeleteTask: (taskId: string) => void;
  onOpenBackfillAction: (sourceElement: HTMLElement) => void;
  onOpenQuickAction: (date: string, sourceElement: HTMLElement) => void;
  onToggleTask: (taskId: string) => void;
  records: DateRecords;
  selectedDate: string;
  today: string;
}

function BackfillBadge({ record }: { record: { isBackfilled?: boolean } }) {
  if (!hasBackfillMetadata(record)) {
    return null;
  }

  return (
    <span className="mt-1 inline-flex w-fit rounded-full border border-amber-300 bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-800 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-200">
      {BACKFILL_LABEL}
    </span>
  );
}

function WorkoutProjectionDetail({
  projection,
}: {
  projection: SharedWorkoutSummary;
}) {
  return (
    <div className="mt-1 text-xs text-slate-500 dark:text-neutral-400">
      {formatSharedWorkoutLabels(projection).join(" · ")}
    </div>
  );
}

function ReadOnlyMeal({ record }: { record: MealRecord }) {
  return (
    <DailyItem markerClassName="bg-yellow-400">
      <div className="truncate text-sm font-semibold text-slate-900 dark:text-neutral-100">
        {record.menu}
      </div>
      <div className="mt-1 text-xs text-slate-500 dark:text-neutral-400">
        {record.calories.toLocaleString("ko-KR")} kcal / 단백질{" "}
        {formatMetric(record.proteinGrams)} g
      </div>
      <BackfillBadge record={record} />
    </DailyItem>
  );
}

function ReadOnlyWeight({ record }: { record: WeightRecord }) {
  return (
    <DailyItem markerClassName="bg-emerald-500">
      <div className="truncate text-sm font-semibold text-slate-900 dark:text-neutral-100">
        {formatMetric(record.weightKg)} kg
      </div>
      <BackfillBadge record={record} />
    </DailyItem>
  );
}

export function SelectedDateRecords({
  onDeleteNote,
  onDeleteTask,
  onOpenBackfillAction,
  onOpenQuickAction,
  onToggleTask,
  records,
  selectedDate,
  today,
}: SelectedDateRecordsProps) {
  const selectedDateIsPast = isPastLocalDate(selectedDate, today);
  const selectedDateIsFuture = isFutureLocalDate(selectedDate, today);
  const totalSelectedRecords =
    records.notes.length +
    records.tasks.length +
    records.workoutRecords.length +
    records.mealRecords.length +
    records.weightRecords.length;

  return (
    <div className="rounded-md border border-slate-300 bg-white p-3 dark:border-neutral-800 dark:bg-black">
      <div className="mb-3 flex items-center justify-between gap-2">
        <div className="min-w-0">
          <h3 className="truncate text-sm font-semibold text-slate-950 dark:text-neutral-50">
            {selectedDate === today ? "오늘 일정" : formatKoreanDate(selectedDate)}
          </h3>
          <p className="truncate text-xs text-slate-500 dark:text-neutral-400">
            {selectedDateIsPast
              ? "지난 날짜의 새 기록은 누락 보강으로만 추가합니다."
              : selectedDateIsFuture
                ? "미래 날짜에는 실제 수행 기록을 추가하지 않습니다."
                : "메모, 할 일, Fitness 소유 요약을 모았습니다."}
          </p>
        </div>
        <div className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-md border border-slate-300 bg-white px-2.5 text-xs font-semibold text-slate-700 dark:border-neutral-800 dark:bg-black dark:text-neutral-200">
          <CalendarDays className="h-4 w-4 text-teal-700 dark:text-teal-300" />
          {totalSelectedRecords}개
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <MarkerLegend />
        {selectedDate === today ? (
          <button
            type="button"
            onClick={(event) => onOpenQuickAction(selectedDate, event.currentTarget)}
            className="inline-flex h-8 shrink-0 items-center justify-center rounded-md bg-slate-900 px-3 text-xs font-semibold text-white transition hover:bg-slate-700 dark:bg-neutral-100 dark:text-black dark:hover:bg-white"
          >
            빠른 작업
          </button>
        ) : selectedDateIsPast ? (
          <button
            type="button"
            onClick={(event) => onOpenBackfillAction(event.currentTarget)}
            className="inline-flex h-8 shrink-0 items-center justify-center rounded-md border border-amber-300 bg-amber-50 px-3 text-xs font-semibold text-amber-800 transition hover:bg-amber-100 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-200 dark:hover:bg-amber-950/50"
          >
            {BACKFILL_LABEL}
          </button>
        ) : selectedDateIsFuture ? (
          <span className="inline-flex h-8 shrink-0 items-center justify-center rounded-md border border-slate-200 px-3 text-xs font-semibold text-slate-400 dark:border-neutral-800 dark:text-neutral-500">
            미래 날짜
          </span>
        ) : null}
      </div>

      <div className="mt-3 space-y-3">
        <DailySection
          title="메모"
          count={records.notes.length}
          emptyText="이 날짜에 수정한 메모가 없습니다."
          icon={<StickyNote className="h-4 w-4 text-slate-500 dark:text-neutral-200" />}
        >
          {records.notes.map((note) => (
            <DailyItem
              key={note.id}
              markerClassName="border border-slate-400 bg-white dark:border-neutral-200 dark:bg-neutral-100"
              actions={<DeleteItemButton label="메모 삭제" onDelete={() => onDeleteNote(note.id)} />}
            >
              <div className="truncate text-sm font-semibold text-slate-900 dark:text-neutral-100">
                {note.title.trim() || "제목 없음"}
              </div>
              <div className="mt-0.5 line-clamp-2 text-xs text-slate-500 dark:text-neutral-400">
                {getPlainTextFromNoteContent(note.content) || "내용 없음"}
              </div>
              <div className="mt-1 text-[11px] text-slate-400 dark:text-neutral-500">
                {formatRecordTime(note.updatedAt)}
              </div>
              <BackfillBadge record={note} />
            </DailyItem>
          ))}
        </DailySection>

        <DailySection
          title="할 일"
          count={records.tasks.length}
          emptyText="이 날짜에 잡힌 할 일이 없습니다."
          icon={<CheckSquare className="h-4 w-4 text-sky-500" />}
        >
          {records.tasks.map((task) => (
            <DailyItem
              key={task.id}
              markerClassName="bg-sky-400"
              actions={<DeleteItemButton label="할 일 삭제" onDelete={() => onDeleteTask(task.id)} />}
            >
              <div className="flex min-w-0 items-center gap-2">
                <input
                  type="checkbox"
                  checked={task.isDone}
                  onChange={() => onToggleTask(task.id)}
                  className="h-4 w-4 shrink-0 rounded border-slate-300 text-teal-700"
                  aria-label="할 일 완료 전환"
                />
                <div
                  className={
                    task.isDone
                      ? "min-w-0 flex-1 truncate text-sm font-semibold text-slate-400 line-through dark:text-neutral-500"
                      : "min-w-0 flex-1 truncate text-sm font-semibold text-slate-900 dark:text-neutral-100"
                  }
                >
                  {task.text}
                </div>
              </div>
              <div className="mt-1 text-xs text-slate-500 dark:text-neutral-400">
                {task.isDone ? "완료" : formatTaskDueLabel(task)}
              </div>
              <BackfillBadge record={task} />
            </DailyItem>
          ))}
        </DailySection>

        <DailySection
          title="운동 요약"
          count={records.workoutRecords.length}
          emptyText="Fitness에서 공유한 완료 운동 요약이 없습니다."
          icon={<Dumbbell className="h-4 w-4 text-red-600" />}
        >
          {records.workoutRecords.map((record) => (
            <DailyItem key={record.id} markerClassName="bg-red-500">
              <div className="truncate text-sm font-semibold text-slate-900 dark:text-neutral-100">
                Fitness 운동
              </div>
              <WorkoutProjectionDetail projection={record} />
              <BackfillBadge record={record} />
            </DailyItem>
          ))}
        </DailySection>

        <DailySection
          title="식사"
          count={records.mealRecords.length}
          emptyText="식사 기록 없음"
          icon={<Salad className="h-4 w-4 text-yellow-600" />}
        >
          {records.mealRecords.map((record) => (
            <ReadOnlyMeal key={record.id} record={record} />
          ))}
        </DailySection>

        <DailySection
          title="체중"
          count={records.weightRecords.length}
          emptyText="체중 기록 없음"
          icon={<Scale className="h-4 w-4 text-emerald-600" />}
        >
          {records.weightRecords.map((record) => (
            <ReadOnlyWeight key={record.id} record={record} />
          ))}
        </DailySection>
      </div>
    </div>
  );
}
