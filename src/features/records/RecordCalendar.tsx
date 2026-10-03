import { useMemo } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { formatLocalDate, parseDateInput } from "../fitness/fitnessDate";
import {
  formatCompactKrw,
  type FinanceSummaryByDate,
} from "../finance/financeCalendar";
import type {
  CalendarMarkers,
  CalendarProgressStack,
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

const progressRails: Array<{
  key: keyof CalendarProgressStack;
  className: string;
  label: string;
}> = [
  {
    key: "project",
    label: "프로젝트",
    className: "border-transparent bg-violet-700 text-white dark:bg-violet-600",
  },
  {
    key: "training",
    label: "운동",
    className: "border-transparent bg-red-700 text-white dark:bg-red-600",
  },
  {
    key: "learning",
    label: "학습 · 예약",
    className: "",
  },
  {
    key: "routine",
    label: "루틴 · 예약",
    className: "",
  },
  {
    key: "reservedOne",
    label: "예약 1",
    className: "",
  },
  {
    key: "reservedTwo",
    label: "예약 2",
    className: "",
  },
];

const emptyTaskMarker: CalendarTaskMarker = {
  dueCount: 0,
  plannedCount: 0,
  completedPlannedCount: 0,
};
const emptyProgressStack: CalendarProgressStack = {
  project: 0,
  training: 0,
  learning: 0,
  routine: 0,
  reservedOne: 0,
  reservedTwo: 0,
};

const calendarCellSize = "h-[clamp(5.75rem,16vw,6.75rem)] min-w-0";
const calendarCellBase =
  `${calendarCellSize} flex flex-col gap-0 rounded-md border-2 px-1 py-0.5 text-xs`;

function renderPlanMarker(taskMarker: CalendarTaskMarker) {
  const plannedCount = taskMarker.plannedCount > 0
    ? `✓${taskMarker.completedPlannedCount}/${taskMarker.plannedCount}`
    : "";
  const dueCount = taskMarker.dueCount > 0 ? `!${taskMarker.dueCount}` : "";
  const planTitle = [
    plannedCount ? `계획 ${taskMarker.completedPlannedCount}/${taskMarker.plannedCount} 완료` : "",
    dueCount ? `마감 ${taskMarker.dueCount}개` : "",
  ].filter(Boolean).join(" · ");

  return (
    <span
      title={planTitle || "Plan"}
      className="flex h-2 min-w-0 items-center gap-0.5 overflow-hidden text-[7px] font-semibold leading-none"
    >
      <span className="shrink-0 text-slate-500 dark:text-neutral-400">Plan</span>
      <span className="truncate text-teal-700 dark:text-teal-300">
        {plannedCount || "\u00a0"}
      </span>
      <span className="shrink-0 text-amber-700 dark:text-amber-300">
        {dueCount}
      </span>
    </span>
  );
}

function renderProgressRail(
  progressStack: CalendarProgressStack,
  rail: (typeof progressRails)[number],
) {
  const count = progressStack[rail.key];
  const isActive = count > 0;

  return (
    <span
      key={rail.key}
      title={isActive ? `${rail.label} ${count}건` : rail.label}
      aria-label={isActive ? `${rail.label} ${count}건` : undefined}
      aria-hidden={!isActive}
      className={
        isActive
          ? `flex h-full min-h-[7px] min-w-0 items-center justify-center overflow-hidden rounded-sm border-2 px-0.5 text-[7px] font-semibold leading-none ${rail.className}`
          : "block h-full min-h-[7px] w-full rounded-sm border-2 border-slate-200 bg-transparent dark:border-neutral-700"
      }
    >
      {isActive ? `x${count}` : ""}
    </span>
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
          const progressStack = markers?.progressStack;

          return date ? (
            <button
              key={date}
              type="button"
              onClick={() => {
                onSelectDate(date);
              }}
              className={
                isSelected
                  ? `${calendarCellBase} border-teal-600 bg-teal-50 font-semibold text-teal-950 dark:border-teal-400 dark:bg-teal-950/50 dark:text-teal-100`
                  : `${calendarCellBase} border-slate-200 bg-white text-slate-800 transition hover:border-teal-300 hover:bg-teal-50 dark:border-neutral-800 dark:bg-black dark:text-neutral-200 dark:hover:border-teal-800 dark:hover:bg-teal-950/30`
              }
            >
              <span className="relative flex h-4 w-full shrink-0 items-center justify-center">
                <span
                  className={
                    isToday
                      ? "inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-slate-900 px-1 text-[11px] font-semibold text-white dark:bg-neutral-100 dark:text-black"
                      : "inline-flex h-4 min-w-4 items-center justify-center px-1 text-[11px] font-semibold"
                  }
                >
                  {Number(date.slice(-2))}
                </span>
                {markers?.notes ? (
                  <span
                    title="메모 있음"
                    aria-label="메모 있음"
                    className="absolute right-1 h-1.5 w-1.5 rounded-full bg-slate-500 dark:bg-neutral-300"
                  />
                ) : null}
              </span>
              {renderPlanMarker(taskMarker)}
              <span className="grid h-[18px] w-full shrink-0 grid-rows-2 overflow-hidden text-[9px] font-semibold leading-[9px]">
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
              <span className="grid min-h-[42px] flex-1 w-full grid-rows-6 gap-0 overflow-hidden">
                {progressRails.map((rail) => renderProgressRail(
                  progressStack ?? emptyProgressStack,
                  rail,
                ))}
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
