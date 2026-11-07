import { useMemo } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { Task } from "../../types";
import { ROLE_LABELS } from "../actions/actionCalendar";
import { addDays, calendarDate } from "../actions/actionTime";
import { minuteLabel, timelineDays, timelineLayout, type TimelineEntry } from "./scheduleTimelineModel";

interface Props {
  tasks: Task[];
  selectedDate: string;
  view: "week" | "day";
  onSelectDate: (date: string) => void;
  onOpenTask?: (id: string) => void;
}
const buttonClass = "min-h-11 rounded border border-slate-300 px-3 text-sm hover:bg-slate-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-teal-600 dark:border-neutral-700 dark:hover:bg-neutral-900";
function entryLabel(entry: TimelineEntry): string {
  return entry.startMinute === null ? "시간 미정 · " + entry.roles.map(role => ROLE_LABELS[role]).join(" · ")
    : minuteLabel(entry.startMinute) + (entry.endMinute === null ? "" : "–" + minuteLabel(entry.endMinute));
}

export function ScheduleTimeline({ tasks, selectedDate, view, onSelectDate, onOpenTask }: Props) {
  const days = useMemo(() => timelineDays(tasks, selectedDate, view), [tasks, selectedDate, view]);
  const conflictCount = new Set(days.flatMap(day => day.entries.filter(entry => entry.conflictIds.length).map(entry => entry.task.id))).size;
  const step = view === "week" ? 7 : 1;
  return <section aria-label={view === "week" ? "주간 일정" : "일간 일정"} className="space-y-3 rounded-md border border-slate-300 bg-white p-3 dark:border-neutral-800 dark:bg-black">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <button type="button" className={buttonClass} aria-label={view === "week" ? "이전 주" : "이전 날"} onClick={() => onSelectDate(addDays(selectedDate, -step))}><ChevronLeft size={18} /></button>
      <div className="text-center text-sm font-semibold"><p>{days[0]?.date}{view === "week" ? ` ~ ${days[6]?.date}` : ""}</p><p className="text-xs font-normal text-slate-600 dark:text-neutral-300">서울 시간 · 날짜를 선택하면 기록 보기</p></div>
      <button type="button" className={buttonClass} aria-label={view === "week" ? "다음 주" : "다음 날"} onClick={() => onSelectDate(addDays(selectedDate, step))}><ChevronRight size={18} /></button>
      <button type="button" className={buttonClass} onClick={() => onSelectDate(calendarDate())}>오늘</button>
    </div>
    {conflictCount > 0 && <p role="status" className="text-sm font-medium text-amber-900 dark:text-amber-200">시간이 겹치는 일정 {conflictCount}개가 있습니다.</p>}
    <div className="space-y-4 md:hidden">
      {days.map(day => <section key={day.date} aria-label={`${day.date} 일정`}>
        <button type="button" className={buttonClass + " mb-1 w-full text-left font-semibold"} aria-pressed={day.date === selectedDate} onClick={() => onSelectDate(day.date)}>{day.date} {new Date(day.date + "T00:00:00Z").toLocaleDateString("ko-KR", { weekday: "short", timeZone: "UTC" })}</button>
        {day.entries.length === 0 ? <p className="py-2 text-sm text-slate-600 dark:text-neutral-300">등록된 일정이 없습니다.</p> : <ul className="divide-y divide-slate-200 dark:divide-neutral-800">{day.entries.map(entry => <li key={entry.task.id}><button type="button" disabled={!onOpenTask} className="min-h-11 w-full py-3 text-left disabled:opacity-70" onClick={() => onOpenTask?.(entry.task.id)}>
          <span className="block text-xs text-slate-600 dark:text-neutral-300">{entryLabel(entry)}</span><span className="block break-words text-sm">{entry.task.text}</span>
          {entry.task.isDone && <span className="text-xs">완료</span>}{entry.task.registrationState === "CANDIDATE" && <span className="text-xs">후보</span>}{entry.conflictIds.length > 0 && <span className="block text-xs text-amber-900 dark:text-amber-200">다른 일정 {entry.conflictIds.length}개와 겹침</span>}
        </button></li>)}</ul>}
      </section>)}
    </div>
    <div className="hidden md:block">
      <div className="grid gap-1" style={{ gridTemplateColumns: `3rem repeat(${days.length}, minmax(0, 1fr))` }}>
        <span className="text-xs text-slate-600 dark:text-neutral-300">시간</span>
        {days.map(day => <button key={day.date} type="button" className={buttonClass + " px-1 font-semibold"} aria-pressed={day.date === selectedDate} onClick={() => onSelectDate(day.date)}>{day.date.slice(5)}</button>)}
        <span className="py-2 text-xs text-slate-600 dark:text-neutral-300">미정</span>
        {days.map(day => <div key={day.date} className="min-w-0 space-y-1 py-2">{day.entries.filter(entry => entry.startMinute === null).map(entry => <button key={entry.task.id} type="button" title={entry.task.text} disabled={!onOpenTask} onClick={() => onOpenTask?.(entry.task.id)} className="block min-h-11 w-full break-words rounded bg-slate-100 p-1 text-left text-xs dark:bg-neutral-900">{entry.task.text}</button>)}</div>)}
      </div>
      <div className="max-h-[36rem] overflow-y-auto border-t border-slate-200 dark:border-neutral-800">
        <div className="grid" style={{ gridTemplateColumns: `3rem repeat(${days.length}, minmax(0, 1fr))` }}>
          <div className="relative h-[72rem]">{Array.from({ length: 24 }, (_, hour) => <span key={hour} className="absolute text-xs tabular-nums text-slate-600 dark:text-neutral-300" style={{ top: `${hour / 24 * 100}%` }}>{minuteLabel(hour * 60)}</span>)}</div>
          {days.map(day => <div key={day.date} className="relative h-[72rem] min-w-0 border-l border-slate-200 dark:border-neutral-800">
            {Array.from({ length: 24 }, (_, hour) => <div key={hour} className="absolute w-full border-t border-slate-100 dark:border-neutral-900" style={{ top: `${hour / 24 * 100}%` }} />)}
            {timelineLayout(day.entries).map(({ entry, lane, lanes, visualEnd }) => {
              return <button key={entry.task.id} type="button" disabled={!onOpenTask} title={`${entry.task.text} · ${entryLabel(entry)}${entry.conflictIds.length ? " · 겹침" : ""}`} onClick={() => onOpenTask?.(entry.task.id)}
                className={`absolute overflow-hidden rounded border p-1 text-left text-xs ${entry.conflictIds.length ? "border-amber-600 bg-amber-50 text-amber-950 dark:bg-amber-950 dark:text-amber-100" : "border-teal-700 bg-teal-50 text-teal-950 dark:bg-teal-950 dark:text-teal-100"}`}
                style={{ top: `${entry.startMinute! / 1440 * 100}%`, height: `${(visualEnd - entry.startMinute!) / 1440 * 100}%`, width: `${100 / lanes}%`, left: `${lane / lanes * 100}%`, minHeight: 44 }}>
                <span className="block truncate font-semibold">{entry.task.text}</span><span className="block">{entryLabel(entry)}</span>{entry.conflictIds.length > 0 && <span>겹침</span>}
              </button>;
            })}
          </div>)}
        </div>
      </div>
    </div>
  </section>;
}
