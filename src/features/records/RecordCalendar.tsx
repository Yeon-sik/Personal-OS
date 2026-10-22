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

const calendarCellSize = "h-[clamp(8.25rem,24vw,9rem)] min-w-0";
const calendarCellBase =
  `${calendarCellSize} flex flex-col justify-between gap-1 ` +
  "rounded-md border-2 px-1 py-1 text-xs";

function renderTaskMarker(taskMarker: CalendarTaskMarker) {
  const confirmed = taskMarker.confirmedCount ?? 0;
  const candidates = taskMarker.candidateCount ?? 0;
  if (confirmed || candidates) {
    return <span className="flex h-full min-w-0 items-center justify-center gap-1 overflow-hidden rounded-sm border border-teal-600 text-[8px] font-semibold text-teal-800 dark:text-teal-300"
      title={`확정 일정 ${confirmed}개 · 마감 ${taskMarker.dueCount}개 · 후보 ${candidates}개`}>
      {confirmed > 0 && <span className="truncate">일정 {confirmed}</span>}
      {candidates > 0 && <span className="truncate border-l border-dashed border-amber-600 pl-0.5 text-amber-900 dark:text-amber-200">후보 {candidates}</span>}
    </span>;
  }
  if (taskMarker.dueCount > 0) {
    return (
      <span
        title={`할 일 ${taskMarker.dueCount}개 마감`}
        className="block h-full w-full rounded-sm border-2 border-transparent bg-sky-400"
      />
    );
  }

  if (taskMarker.activeCount > 0) {
    return (
      <span
        title={`진행 중인 할 일 ${taskMarker.activeCount}개`}
        className="flex h-full w-full min-w-0 items-center justify-center gap-1 rounded-sm border-2 border-slate-200 bg-transparent px-1 dark:border-neutral-700"
      >
        <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-sky-400" />
        <span className="text-[10px] font-semibold leading-none text-sky-500 dark:text-sky-300">
          x{taskMarker.activeCount}
        </span>
      </span>
    );
  }

  return (
    <span className="block h-full w-full rounded-sm border-2 border-slate-200 bg-transparent dark:border-neutral-700" />
  );
}

function renderPlannedDoneMarker(taskMarker: CalendarTaskMarker) {
  if (!taskMarker.allPlannedDone) {
    return (
      <span className="block h-full w-full rounded-sm border-2 border-slate-200 bg-transparent dark:border-neutral-700" />
    );
  }

  return (
    <span
      title={`오늘 할 일 ${taskMarker.completedPlannedCount}/${taskMarker.plannedCount} 완료`}
      className="block h-full w-full rounded-sm border-2 border-transparent bg-[#FF00FF]"
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

          return date ? (
            <button
              key={date}
              type="button"
              aria-label={`${date} · 일정 ${taskMarker.confirmedCount ?? 0}개 · 후보 ${taskMarker.candidateCount ?? 0}개`}
              onClick={() => {
                onSelectDate(date);
              }}
              className={
                isSelected
                  ? `${calendarCellBase} border-teal-600 bg-teal-50 font-semibold text-teal-950 dark:border-teal-400 dark:bg-teal-950/50 dark:text-teal-100`
                  : `${calendarCellBase} border-slate-200 bg-white text-slate-800 transition hover:border-teal-300 hover:bg-teal-50 dark:border-neutral-800 dark:bg-black dark:text-neutral-200 dark:hover:border-teal-800 dark:hover:bg-teal-950/30`
              }
            >
              <span
                className={
                  isToday
                    ? "inline-flex h-5 min-w-5 items-center justify-center self-center rounded-full bg-slate-900 px-1 text-[11px] font-semibold text-white dark:bg-neutral-100 dark:text-black"
                    : "inline-flex h-5 min-w-5 items-center justify-center self-center px-1 text-[11px] font-semibold"
                }
              >
                {Number(date.slice(-2))}
              </span>
              <span className="min-h-6 w-full space-y-0.5 overflow-hidden text-[9px] font-semibold leading-[1.05]">
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
              <span className="grid min-h-0 flex-1 w-full grid-rows-6 gap-0.5 overflow-hidden">
                <span
                  title={markers?.weights ? "체중" : undefined}
                  className={
                    markers?.weights
                      ? `block h-full w-full rounded-sm border-2 ${markerStyles[3].className}`
                      : "block h-full w-full rounded-sm border-2 border-slate-200 bg-transparent dark:border-neutral-700"
                  }
                  aria-hidden={!markers?.weights}
                />
                <span
                  title={markers?.meals ? "식단" : undefined}
                  className={
                    markers?.meals
                      ? `block h-full w-full rounded-sm border-2 ${markerStyles[2].className}`
                      : "block h-full w-full rounded-sm border-2 border-slate-200 bg-transparent dark:border-neutral-700"
                  }
                  aria-hidden={!markers?.meals}
                />
                <span
                  title={markers?.workouts ? "운동" : undefined}
                  className={
                    markers?.workouts
                      ? `block h-full w-full rounded-sm border-2 ${markerStyles[1].className}`
                      : "block h-full w-full rounded-sm border-2 border-slate-200 bg-transparent dark:border-neutral-700"
                  }
                  aria-hidden={!markers?.workouts}
                />
                {renderTaskMarker(taskMarker)}
                {renderPlannedDoneMarker(taskMarker)}
                <span
                  title={markers?.notes ? "메모" : undefined}
                  className={
                    markers?.notes
                      ? `block h-full w-full rounded-sm border-2 ${markerStyles[0].className}`
                      : "block h-full w-full rounded-sm border-2 border-slate-200 bg-transparent dark:border-neutral-700"
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
