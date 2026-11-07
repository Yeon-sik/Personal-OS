import { useMemo } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { formatLocalDate, parseDateInput } from "../fitness/fitnessDate";
import {
  formatCompactKrw,
  type FinanceSummaryByDate,
} from "../finance/financeCalendar";
import type {
  CalendarMarkers,
  CalendarTaskMarker,
} from "./recordAggregation";

interface RecordCalendarProps {
  markerByDate: CalendarMarkers;
  financeByDate: FinanceSummaryByDate;
  selectedDate: string;
  visibleMonth: string;
  onSelectDate: (date: string) => void;
  onVisibleMonthChange: (date: string) => void;
}

const weekDays = ["일", "월", "화", "수", "목", "금", "토"];

function getMonthCells(monthDate: Date): Array<string | null> {
  const year = monthDate.getFullYear();
  const month = monthDate.getMonth();
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const cells: Array<string | null> = [];

  for (let index = 0; index < firstDay.getDay(); index += 1) {
    cells.push(null);
  }

  for (let day = 1; day <= lastDay.getDate(); day += 1) {
    cells.push(formatLocalDate(new Date(year, month, day)));
  }

  while (cells.length % 7 !== 0) {
    cells.push(null);
  }

  return cells;
}

function getMonthTitle(monthDate: Date): string {
  return new Intl.DateTimeFormat("ko-KR", {
    year: "numeric",
    month: "long",
  }).format(monthDate);
}

const markerStyles: Array<{
  key: "notes" | "workouts" | "meals" | "weights";
  className: string;
  label: string;
}> = [
  {
    key: "notes",
    label: "메모",
    className: "border-slate-400 bg-white dark:border-neutral-200 dark:bg-neutral-100",
  },
  {
    key: "workouts",
    label: "운동",
    className: "border-transparent bg-red-500",
  },
  {
    key: "meals",
    label: "식단",
    className: "border-transparent bg-yellow-400",
  },
  {
    key: "weights",
    label: "체중",
    className: "border-transparent bg-emerald-500",
  },
];

const emptyTaskMarker: CalendarTaskMarker = {
  dueCount: 0,
  activeCount: 0,
  plannedCount: 0,
  completedPlannedCount: 0,
  allPlannedDone: false,
};

const calendarCellSize = "h-24 min-w-0";
const calendarCellBase =
  `${calendarCellSize} flex flex-col justify-between gap-0.5 ` +
  "rounded-md border-2 px-1 py-1 text-xs";

function getScheduleCount(taskMarker: CalendarTaskMarker) {
  const confirmed = taskMarker.confirmedCount ?? Math.max(taskMarker.activeCount, taskMarker.dueCount);
  const candidates = taskMarker.candidateCount ?? 0;
  return {
    confirmed,
    candidates,
    total: confirmed + candidates,
    label: `확정 일정 ${confirmed}개 · 후보 ${candidates}개 · 마감 ${taskMarker.dueCount}개`,
  };
}

function renderTaskMarker(taskMarker: CalendarTaskMarker) {
  const { confirmed, candidates, label } = getScheduleCount(taskMarker);
  if (confirmed && candidates) {
    return <span title={label} className="flex h-full w-full overflow-hidden rounded-sm border border-teal-600">
      <span className="h-full flex-1 bg-teal-500" />
      <span className="h-full flex-1 border-l border-dashed border-amber-700 bg-amber-400" />
    </span>;
  }
  if (candidates) {
    return <span title={label} className="block h-full w-full rounded-sm border border-dashed border-amber-600 bg-amber-200 dark:bg-amber-800" />;
  }
  if (confirmed) {
    return <span title={label} className={taskMarker.dueCount
      ? "block h-full w-full rounded-sm border border-transparent bg-sky-400"
      : "block h-full w-full rounded-sm border border-teal-600 bg-teal-500"} />;
  }
  return <span className="block h-full w-full rounded-sm border border-slate-200 bg-transparent dark:border-neutral-700" />;
}

function renderPlannedDoneMarker(taskMarker: CalendarTaskMarker) {
  if (!taskMarker.allPlannedDone) {
    return (
      <span className="block h-full w-full rounded-sm border border-slate-200 bg-transparent dark:border-neutral-700" />
    );
  }

  return (
    <span
      title={`오늘 할 일 ${taskMarker.completedPlannedCount}/${taskMarker.plannedCount} 완료`}
      className="block h-full w-full rounded-sm border border-transparent bg-[#FF00FF]"
    />
  );
}

export function RecordCalendar({
  markerByDate,
  financeByDate,
  selectedDate,
  visibleMonth,
  onSelectDate,
  onVisibleMonthChange,
}: RecordCalendarProps) {
  const today = formatLocalDate();
  const visibleMonthDate = useMemo(
    () => parseDateInput(visibleMonth),
    [visibleMonth],
  );
  const monthCells = useMemo(() => getMonthCells(visibleMonthDate), [visibleMonthDate]);

  function moveMonth(offset: number) {
    onVisibleMonthChange(
      formatLocalDate(
        new Date(
          visibleMonthDate.getFullYear(),
          visibleMonthDate.getMonth() + offset,
          1,
        ),
      ),
    );
  }

  function handleTodayClick() {
    const nextToday = formatLocalDate();
    onSelectDate(nextToday);
    onVisibleMonthChange(nextToday);
  }

  return (
    <div className="rounded-md border border-slate-300 bg-white p-2 dark:border-neutral-800 dark:bg-black">
      <div className="mb-2 flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => moveMonth(-1)}
          className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-slate-300 text-slate-600 transition hover:bg-slate-50 dark:border-neutral-800 dark:text-neutral-300 dark:hover:bg-neutral-900"
          aria-label="이전 달"
        >
          <ChevronLeft className="h-4 w-4" aria-hidden="true" />
        </button>
        <div className="min-w-0 text-center">
          <div className="truncate text-sm font-semibold text-slate-950 dark:text-neutral-50">
            {getMonthTitle(visibleMonthDate)}
          </div>
          <button
            type="button"
            onClick={handleTodayClick}
            className="mt-1 text-xs font-semibold text-teal-700 hover:text-teal-900 dark:text-teal-300 dark:hover:text-teal-200"
          >
            오늘로 이동
          </button>
        </div>
        <button
          type="button"
          onClick={() => moveMonth(1)}
          className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-slate-300 text-slate-600 transition hover:bg-slate-50 dark:border-neutral-800 dark:text-neutral-300 dark:hover:bg-neutral-900"
          aria-label="다음 달"
        >
          <ChevronRight className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>

      <div className="grid grid-cols-7 gap-0.5 text-center text-[11px] font-semibold text-slate-500 dark:text-neutral-400">
        {weekDays.map((day) => (
          <div key={day} className="py-1">
            {day}
          </div>
        ))}
      </div>
      <div className="mt-0.5 grid grid-cols-7 gap-0.5">
        {monthCells.map((date, index) => {
          const markers = date ? markerByDate[date] : null;
          const finance = date ? financeByDate[date] : null;
          const isSelected = date === selectedDate;
          const isToday = date === today;
          const taskMarker = markers?.tasks ?? emptyTaskMarker;
          const schedule = getScheduleCount(taskMarker);

          return date ? (
            <button
              key={date}
              type="button"
              aria-label={`${date} · 일정 ${schedule.confirmed}개 · 후보 ${schedule.candidates}개`}
              onClick={() => {
                onSelectDate(date);
              }}
              className={
                isSelected
                  ? `${calendarCellBase} border-teal-600 bg-teal-50 font-semibold text-teal-950 dark:border-teal-400 dark:bg-teal-950/50 dark:text-teal-100`
                  : `${calendarCellBase} border-slate-200 bg-white text-slate-800 transition hover:border-teal-300 hover:bg-teal-50 dark:border-neutral-800 dark:bg-black dark:text-neutral-200 dark:hover:border-teal-800 dark:hover:bg-teal-950/30`
              }
            >
              <span className="flex min-h-5 w-full flex-wrap items-center justify-between gap-x-0.5 gap-y-0.5">
                <span className={isToday
                  ? "inline-flex h-4 min-w-4 shrink-0 items-center justify-center rounded-full bg-slate-900 px-0.5 text-[11px] font-semibold text-white dark:bg-neutral-100 dark:text-black"
                  : "inline-flex h-4 min-w-4 shrink-0 items-center justify-center px-0.5 text-[11px] font-semibold"}>
                  {Number(date.slice(-2))}
                </span>
                {schedule.total > 0 && <span
                  aria-hidden="true"
                  title={`일정 합계 ${schedule.total}개 · ${schedule.label}`}
                  className={schedule.confirmed
                    ? "inline-flex h-3 min-w-3 shrink-0 items-center justify-center rounded bg-teal-700 px-0.5 text-[9px] font-semibold leading-none text-white dark:bg-teal-300 dark:text-teal-950"
                    : "inline-flex h-3 min-w-3 shrink-0 items-center justify-center rounded border border-dashed border-amber-700 bg-amber-100 px-0.5 text-[9px] font-semibold leading-none text-amber-950 dark:border-amber-400 dark:bg-amber-900 dark:text-amber-100"}>
                  {schedule.total > 99 ? "99+" : schedule.total}
                </span>}
              </span>
              <span className="h-5 w-full shrink-0 space-y-0.5 overflow-hidden text-[9px] font-semibold leading-none">
                <span className="block truncate text-emerald-700 dark:text-emerald-300">
                  {finance?.incomeKrw
                    ? `+${formatCompactKrw(finance.incomeKrw)}`
                    : "\u00a0"}
                </span>
                <span className="block truncate text-rose-600 dark:text-rose-300">
                  {finance?.expenseKrw
                    ? `-${formatCompactKrw(finance.expenseKrw)}`
                    : "\u00a0"}
                </span>
              </span>
              <span className="grid w-full shrink-0 grid-rows-[repeat(6,4px)] gap-px overflow-hidden">
                <span
                  title={markers?.weights ? "체중" : undefined}
                  className={
                    markers?.weights
                      ? `block h-full w-full rounded-sm border ${markerStyles[3].className}`
                      : "block h-full w-full rounded-sm border border-slate-200 bg-transparent dark:border-neutral-700"
                  }
                  aria-hidden={!markers?.weights}
                />
                <span
                  title={markers?.meals ? "식단" : undefined}
                  className={
                    markers?.meals
                      ? `block h-full w-full rounded-sm border ${markerStyles[2].className}`
                      : "block h-full w-full rounded-sm border border-slate-200 bg-transparent dark:border-neutral-700"
                  }
                  aria-hidden={!markers?.meals}
                />
                <span
                  title={markers?.workouts ? "운동" : undefined}
                  className={
                    markers?.workouts
                      ? `block h-full w-full rounded-sm border ${markerStyles[1].className}`
                      : "block h-full w-full rounded-sm border border-slate-200 bg-transparent dark:border-neutral-700"
                  }
                  aria-hidden={!markers?.workouts}
                />
                {renderTaskMarker(taskMarker)}
                {renderPlannedDoneMarker(taskMarker)}
                <span
                  title={markers?.notes ? "메모" : undefined}
                  className={
                    markers?.notes
                      ? `block h-full w-full rounded-sm border ${markerStyles[0].className}`
                      : "block h-full w-full rounded-sm border border-slate-200 bg-transparent dark:border-neutral-700"
                  }
                  aria-hidden={!markers?.notes}
                />
              </span>
            </button>
          ) : (
            <div
              key={`blank-${index}`}
              className={`${calendarCellSize} rounded-md border-2 border-transparent`}
            />
          );
        })}
      </div>
    </div>
  );
}
