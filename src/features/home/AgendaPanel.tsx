import { useMemo } from "react";
import type { Task } from "../../types";
import { ROLE_LABELS } from "../actions/actionCalendar";
import { getAgenda } from "./agenda";

interface AgendaPanelProps {
  tasks: Task[];
  now: number;
  onOpenTask: (task: Task, date?: string) => void;
  onOpenCalendar: () => void;
}

export function AgendaPanel({ tasks, now, onOpenTask, onOpenCalendar }: AgendaPanelProps) {
  const agenda = useMemo(() => getAgenda(tasks, now), [tasks, now]);
  return <section aria-labelledby="home-agenda-heading" className="rounded-md border border-slate-300 bg-white p-4 dark:border-neutral-800 dark:bg-black">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <h2 id="home-agenda-heading" className="text-base font-semibold">일정과 마감</h2>
      <button type="button" onClick={onOpenCalendar} className="min-h-11 text-sm font-medium text-cyan-800 hover:underline dark:text-cyan-300">달력 · 일정 가져오기</button>
    </div>
    <p className="text-sm text-slate-600 dark:text-neutral-400">오늘부터 7일 · 서울 기준 · 완료한 일정 제외</p>
    {([
      ["지난 마감", agenda.overdue], ["오늘", agenda.today], ["다가오는 일정", agenda.upcoming],
      ...(agenda.review.length ? [["완료·재계획 확인", agenda.review] as const] : []),
    ] as const).map(([label, entries]) => <div key={label} className="mt-4">
      <h3 className="text-sm font-semibold">{label} <span className="tabular-nums">{entries.length}개</span></h3>
      {entries.length ? <ul className="mt-1 divide-y divide-slate-200 dark:divide-neutral-800">
        {entries.slice(0, 5).map(entry => <li key={entry.task.id}>
          <button type="button" onClick={() => onOpenTask(entry.task, entry.date)} className="min-h-11 w-full py-3 text-left hover:text-cyan-800 dark:hover:text-cyan-300">
            <span className="block break-words text-base font-medium">{entry.task.text}</span>
            <span className="mt-1 block text-sm text-slate-600 dark:text-neutral-400">{entry.date} · {entry.roles.map(role => ROLE_LABELS[role]).join(" · ")} · {entry.state}</span>
            {entry.task.dueDate && <span className="mt-1 block text-sm text-slate-600 dark:text-neutral-400">마감 {entry.task.dueDate} {entry.task.dueTime ?? "시간 미확인"} · {entry.task.timeZone ?? "Asia/Seoul"}</span>}
            {entry.task.eventStartDate && <span className="mt-1 block text-sm text-slate-600 dark:text-neutral-400">시작 {entry.task.eventStartDate} {entry.task.eventStartTime ?? "시간 미확인"} · {entry.task.timeZone ?? "Asia/Seoul"}</span>}
            {entry.task.verificationStatus === "UNVERIFIED" && <span className="mt-1 block text-sm text-amber-800 dark:text-amber-300">외부 출처 미확인</span>}
          </button>
        </li>)}
      </ul> : <p className="mt-2 text-sm text-slate-600 dark:text-neutral-400">{label === "지난 마감" ? "미완료 마감이 없습니다." : "예정된 일정이 없습니다."}</p>}
      {entries.length > 5 && <details><summary className="min-h-11 cursor-pointer py-3 text-sm text-cyan-800 dark:text-cyan-300">나머지 {entries.length - 5}개 보기</summary>
        {entries.slice(5).map(entry => <button key={entry.task.id} type="button" onClick={() => onOpenTask(entry.task, entry.date)} className="block min-h-11 w-full break-words py-2 text-left text-sm">{entry.date} · {entry.task.text}</button>)}
      </details>}
    </div>)}
    {([["검토할 후보", agenda.candidates], ["날짜 미정", agenda.undated]] as const).map(([label, items]) => items.length > 0 && <details key={label} className="mt-3 border-t border-slate-200 dark:border-neutral-800">
      <summary className="min-h-11 cursor-pointer py-3 text-sm font-medium">{label} {items.length}개</summary>
      {items.map(task => <button key={task.id} type="button" onClick={() => onOpenTask(task)} className="block min-h-11 w-full break-words py-2 text-left text-base text-cyan-800 hover:underline dark:text-cyan-300">{task.text}</button>)}
    </details>)}
  </section>;
}
