import { Activity, ArrowUpRight } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import type { LocalDataSnapshot } from "../../types";
import { formatKoreanDate } from "../fitness/fitnessDate";
import { describeActivityDay, getActivityTimeline } from "./activity";

const LEVEL_CLASSES = [
  "border-slate-200 bg-slate-100 dark:border-white/[0.06] dark:bg-neutral-900",
  "border-cyan-700/10 bg-cyan-200 dark:border-cyan-400/10 dark:bg-cyan-950",
  "border-cyan-700/15 bg-cyan-400/65 dark:border-cyan-400/15 dark:bg-cyan-800",
  "border-cyan-700/20 bg-cyan-600 dark:border-cyan-400/20 dark:bg-cyan-600",
  "border-cyan-700/20 bg-cyan-700 dark:border-cyan-200/30 dark:bg-cyan-300",
];

function activityLevel(count: number): number {
  return count === 0 ? 0 : count === 1 ? 1 : count <= 3 ? 2 : count <= 6 ? 3 : 4;
}

export function ActivityHeatmap({
  snapshot,
  today,
  onOpenDate,
}: {
  snapshot: LocalDataSnapshot;
  today: string;
  onOpenDate: (date: string) => void;
}) {
  const timeline = useMemo(() => getActivityTimeline(snapshot, { endDate: today }), [snapshot, today]);
  const scrollContainer = useRef<HTMLDivElement>(null);
  const [hoveredDate, setHoveredDate] = useState<string | null>(null);
  const activeDay = timeline.days.find((day) => day.date === hoveredDate) ?? timeline.days[timeline.days.length - 1];
  const columns = Math.ceil(timeline.days.length / 7);
  const monthLabels = Array.from({ length: columns }, (_, index) => {
    const day = timeline.days[index * 7];
    const previous = timeline.days[(index - 1) * 7];
    return day && (!previous || previous.date.slice(0, 7) !== day.date.slice(0, 7))
      ? `${Number(day.date.slice(5, 7))}월`
      : "";
  });
  useEffect(() => {
    const container = scrollContainer.current;
    if (container) container.scrollLeft = container.scrollWidth;
  }, [today]);

  return (
    <section aria-labelledby="home-activity-heading" className="rounded-md border border-slate-300 bg-white p-4 dark:border-neutral-800 dark:bg-black">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 id="home-activity-heading" className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-neutral-100">
            <Activity className="h-4 w-4 text-cyan-700 dark:text-cyan-300" aria-hidden="true" />
            누적 활동
          </h2>
          <p className="mt-1 text-xs text-slate-500 dark:text-neutral-400">최근 26주 · 날짜를 누르면 기록 달력으로 이동합니다.</p>
        </div>
        <div className="text-xs tabular-nums text-slate-600 dark:text-neutral-300">
          <span className="font-semibold text-slate-900 dark:text-neutral-100">{timeline.totalCount.toLocaleString("ko-KR")}건</span>
          <span className="mx-2 text-slate-300 dark:text-neutral-700">/</span>
          활동한 날 {timeline.activeDayCount}일
        </div>
      </div>

      <div ref={scrollContainer} className="mt-4 overflow-x-auto pb-2">
        <div className="min-w-[510px]">
          <div className="mb-1 ml-6 grid gap-[4px] text-[10px] text-slate-500 dark:text-neutral-500" style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }} aria-hidden="true">
            {monthLabels.map((label, index) => <span key={index} className="whitespace-nowrap">{label}</span>)}
          </div>
          <div className="flex gap-2">
            <div className="grid w-4 shrink-0 grid-rows-7 gap-[4px] text-[9px] leading-[15px] text-slate-500 dark:text-neutral-500" aria-hidden="true">
              {["월", "", "수", "", "금", "", ""].map((label, index) => <span key={index}>{label}</span>)}
            </div>
            <div className="grid flex-1 grid-flow-col grid-rows-7 gap-[4px]" style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }} aria-label="일별 기록 활동">
              {timeline.days.map((day) => {
                const label = `${formatKoreanDate(day.date)} · ${day.count}건 · ${describeActivityDay(day)}`;
                return (
                  <button
                    key={day.date}
                    type="button"
                    aria-label={`${label} · 기록 달력 열기`}
                    title={label}
                    onClick={() => onOpenDate(day.date)}
                    onFocus={() => setHoveredDate(day.date)}
                    onMouseEnter={() => setHoveredDate(day.date)}
                    onBlur={() => setHoveredDate(null)}
                    onMouseLeave={() => setHoveredDate(null)}
                    className={`h-[15px] min-w-0 rounded-[3px] border transition-colors duration-150 ${LEVEL_CLASSES[activityLevel(day.count)]} ${day.date === today ? "ring-1 ring-cyan-600/60 ring-offset-1 ring-offset-white dark:ring-cyan-300/60 dark:ring-offset-black" : ""}`}
                  />
                );
              })}
            </div>
          </div>
        </div>
      </div>

      <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-[10px] text-slate-500 dark:text-neutral-500">
        <span>{timeline.startDate} ~ {timeline.endDate}</span>
        <div className="flex items-center gap-1" aria-label="색이 선명할수록 기록이 많습니다">
          <span className="mr-1">적음</span>
          {LEVEL_CLASSES.map((className, index) => <span key={index} className={`h-2.5 w-2.5 rounded-sm border ${className}`} aria-hidden="true" />)}
          <span className="ml-1">많음</span>
        </div>
      </div>

      {activeDay ? (
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-slate-200 pt-3 text-xs dark:border-neutral-800">
          <div className="min-w-0">
            <p className="font-medium text-slate-700 dark:text-neutral-200">{formatKoreanDate(activeDay.date)} · {activeDay.count}건</p>
            <p className="mt-1 text-slate-500 dark:text-neutral-400">{describeActivityDay(activeDay)}</p>
          </div>
          <button type="button" onClick={() => onOpenDate(activeDay.date)} className="inline-flex min-h-8 shrink-0 items-center gap-1 text-xs font-semibold text-cyan-700 transition-colors duration-150 hover:text-cyan-900 dark:text-cyan-300 dark:hover:text-cyan-100">
            기록 달력 <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
        </div>
      ) : null}

      <p className="mt-3 text-[11px] leading-relaxed text-slate-500 dark:text-neutral-500">메모·할 일·지식 문서 등록, 식사·체중 기록, 완료 운동 요약, 프로젝트 이력을 각 1건씩 집계합니다. 수정 횟수는 합산하지 않습니다.</p>

      <details className="mt-3 text-[11px] leading-relaxed text-slate-500 dark:text-neutral-500">
        <summary className="cursor-pointer">활동 집계 기준</summary>
        <p className="mt-2">메모·할 일·지식 문서는 등록일에 각 1건, 식사·체중은 기록 날짜에 각 1건, 운동은 공유된 완료 운동 요약의 날짜에 세션당 1건, 프로젝트 이력은 발생일에 각 1건을 셉니다. 등록일과 발생일은 이 기기의 시간대를 사용합니다.</p>
        <p className="mt-1">수정 횟수나 완료 전환 횟수는 합산하지 않습니다. 삭제된 항목·건강 앱 전용 식사와 체중·이전 운동 상세 데이터는 제외합니다. 현재 남아 있는 기록을 집계하므로 삭제하면 활동 수가 달라질 수 있습니다.</p>
        <p className="mt-1">메모를 수정하거나 할 일 날짜를 옮겨도 등록 활동은 처음 등록한 날짜에 남습니다. 기록 달력에서는 메모의 최근 수정일과 할 일 일정을 확인하며, 프로젝트 이력과 지식 문서는 프로젝트에서 확인합니다.</p>
      </details>
    </section>
  );
}
