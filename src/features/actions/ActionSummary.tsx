import type { Task } from "../../types";
import { ACTION_LABELS, normalizeActionFields } from "./actionModel";
import { actionStateLabel } from "./actionCalendar";

export function ActionSummary({ task }: { task: Task }) {
  const a = normalizeActionFields(task);
  const when = (date: string | null, time?: string | null) => date ? date + (time ? " " + time : " · 시간 미확인") : "미확인";
  return <div className="space-y-1 break-words text-sm leading-relaxed text-slate-600 dark:text-neutral-300">
    <p className="font-medium text-slate-800 dark:text-neutral-100">{ACTION_LABELS[a.kind]} · {actionStateLabel(task)}{a.sourceType === "EXTERNAL_NOTICE" ? a.verificationStatus === "SOURCE_CHECKED" ? " · 출처 대조됨" : " · 출처 미확인" : " · 개인 계획"}</p>
    {a.windowStartDate && <p>접수: {when(a.windowStartDate, a.windowStartTime)} ~ {when(task.dueDate, task.dueTime)}</p>}
    {task.dueDate && !a.windowStartDate && <p>마감: {when(task.dueDate, task.dueTime)}</p>}
    {a.eventStartDate && <p>시험·행사: {when(a.eventStartDate, a.eventStartTime)}{a.eventEndDate ? " ~ " + when(a.eventEndDate, a.eventEndTime) : " · 종료 미확인"}</p>}
    {task.plannedDate && <p>내 계획일: {task.plannedDate}</p>}
    {!task.plannedDate && !task.dueDate && !a.windowStartDate && !a.eventStartDate && <p>날짜 미정</p>}
    <p className="text-xs">원본 시간대 {a.timeZone} · 달력 Asia/Seoul</p>
  </div>;
}
