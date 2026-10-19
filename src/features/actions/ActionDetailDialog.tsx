import { useState } from "react";
import type { Task } from "../../types";
import type { PendingRevision } from "../../lib/sync/syncState";
import { ActionDialog, actionButtonClass, actionInputClass } from "./ActionDialog";
import { ActionSummary } from "./ActionSummary";
import { ACTION_LABELS, normalizeActionFields } from "./actionModel";
import type { ActionActions } from "./useActionActions";
import type { ActionEdit } from "./actionImport";

export function ActionDetailDialog({ task, proposal, pending, actions, onClose, onDelete, onSync }: {
  task: Task; proposal?: Task; pending?: PendingRevision; actions: ActionActions;
  onClose: () => void; onDelete: (id: string) => void; onSync?: () => Promise<void>;
}) {
  const [revision] = useState(task.updatedAt);
  const [form, setForm] = useState<ActionEdit>(() => ({
    ...normalizeActionFields(task), text: task.text, plannedDate: task.plannedDate, dueDate: task.dueDate, dueTime: task.dueTime,
  }));
  const [sourceChecked, setSourceChecked] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const isEvent = form.kind === "EXAM" || form.kind === "EVENT";
  const isWindow = form.kind === "APPLICATION" || form.kind === "REGISTRATION";
  function field(key: keyof ActionEdit, label: string, type: "date" | "time" | "text" = "text") {
    return <label className="block min-w-0 text-sm font-medium">{label}
      <input type={type} value={form[key] ?? ""} onChange={event => setForm(current => ({ ...current, [key]: event.target.value || null }))}
        className={actionInputClass + " mt-1"} />
    </label>;
  }
  async function run(work: () => Promise<void>, success: string) {
    if (busy) return;
    setBusy(true); setError(null);
    try { await work(); setMessage(success); }
    catch (caught) { setError(caught instanceof Error ? caught.message : "처리하지 못했습니다."); }
    finally { setBusy(false); }
  }
  return <ActionDialog title={task.deletedAt ? "삭제한 일정" : "일정 상세"} onClose={onClose} busy={busy}>
    <div className="space-y-5">
      <h3 className="break-words text-lg font-semibold">{task.text}</h3>
      <ActionSummary task={task} />
      <p className="text-sm text-slate-600 dark:text-neutral-300">
        {task.actionOwnerScope?.startsWith("local:") ? "이 기기에 저장됨" : pending ? pending.conflictTask ? "동기화 차이 검토 필요" : "동기화 대기" : "저장된 일정"}
      </p>
      {task.sourceUrl && /^https?:\/\//.test(task.sourceUrl) && <a href={task.sourceUrl} target="_blank" rel="noreferrer noopener" className="inline-flex min-h-11 items-center break-all text-sm font-semibold text-teal-800 underline underline-offset-4 dark:text-teal-300">출처 열기: {task.sourceLabel ?? task.sourceUrl}</a>}
      {task.sourceExcerpt && <blockquote className="whitespace-pre-wrap break-words rounded-md bg-slate-100 p-3 text-sm dark:bg-neutral-900">{task.sourceExcerpt}</blockquote>}
      {task.sourceReferenceDate && <p className="text-sm">상대 날짜 해석 기준: {task.sourceReferenceDate} · {task.sourceReferenceTimeZone}</p>}
      {task.sourceCheckedAt && <p className="text-sm">사용자 출처 대조 기록: {task.sourceCheckedAt}</p>}
      {pending?.conflictTask && <section className="space-y-3 rounded-md border border-amber-400 p-3">
        <h3 className="font-semibold">서버의 일정과 내 제안이 다릅니다</h3>
        <p className="text-sm">아래 서버 내용과 위의 내 제안을 비교하세요. 선택 전까지 양쪽 내용을 보존합니다.</p>
        <p className="break-words font-medium">{pending.conflictTask.text}{pending.conflictTask.deletedAt ? " · 서버에서 삭제됨" : ""}</p>
        <ActionSummary task={pending.conflictTask} />
        <div className="flex flex-wrap gap-2">
          <button type="button" disabled={busy} className={actionButtonClass} onClick={() => void run(async () => { await actions.resolveActionConflict(task.id, false); await onSync?.(); }, "서버 내용을 선택했습니다. 창을 닫고 최신 일정을 확인하세요.")}>서버 내용 유지</button>
          <button type="button" disabled={busy} className={actionButtonClass} onClick={() => void run(async () => { await actions.resolveActionConflict(task.id, true); await onSync?.(); }, "내 내용을 적용했습니다. 동기화 상태를 확인하세요.")}>{pending.conflictTask.deletedAt ? "복원해서 내 내용 적용" : "내 내용 적용"}</button>
        </div>
      </section>}
      {proposal && <section className="space-y-3 rounded-md border border-amber-400 p-3">
        <h3 className="font-semibold">다시 가져온 제안</h3><ActionSummary task={proposal} />
        <p className="text-sm">기존 제목·계획일·완료 여부를 유지하고 공식 일정과 출처만 아래 편집란에 넣을 수 있습니다. 저장 전까지 기존 일정은 바뀌지 않습니다.</p>
        <button type="button" className={actionButtonClass} onClick={() => {
          const next = normalizeActionFields(proposal);
          setForm(current => ({ ...current, kind: next.kind, windowStartDate: next.windowStartDate, windowStartTime: next.windowStartTime,
            eventStartDate: next.eventStartDate, eventStartTime: next.eventStartTime, eventEndDate: next.eventEndDate, eventEndTime: next.eventEndTime,
            dueDate: proposal.dueDate, dueTime: proposal.dueTime, timeZone: next.timeZone,
            sourceUrl: next.sourceUrl, sourceLabel: next.sourceLabel, sourceExcerpt: next.sourceExcerpt,
            sourceReferenceDate: next.sourceReferenceDate, sourceReferenceTimeZone: next.sourceReferenceTimeZone,
            sourceReportedCheckedAt: next.sourceReportedCheckedAt }));
          setSourceChecked(false);
        }}>새 제안의 일정·출처를 편집란에 채우기</button>
      </section>}
      {task.deletedAt ? <button type="button" disabled={busy} className={actionButtonClass} onClick={() => void run(() => actions.restoreAction(task.id, revision), "같은 일정으로 복원했습니다. 창을 닫고 확인하세요.")}>이 일정 복원</button> :
        <form className="space-y-4" onSubmit={event => { event.preventDefault(); void run(() => actions.updateAction(task.id, revision, form, sourceChecked), "저장했습니다. 창을 닫고 달력에서 확인하세요."); }}>
          <fieldset disabled={busy || Boolean(pending?.conflictTask) || Boolean(message)} className="space-y-4 disabled:opacity-60">
            <legend className="mb-3 font-semibold">일정 수정</legend>
            {field("text", "일정 이름")}
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="text-sm font-medium">등록 상태<select value={form.registrationState} onChange={event => setForm(current => ({ ...current, registrationState: event.target.value as "CANDIDATE" | "CONFIRMED" }))} className={actionInputClass + " mt-1"}><option value="CANDIDATE">후보</option><option value="CONFIRMED">확정 일정</option></select></label>
              {field("plannedDate", "내가 처리할 계획일", "date")}
            </div>
            <p className="text-sm">{ACTION_LABELS[form.kind]} · {task.isDone ? "완료됨. 후보로 바꾸면 완료 표시도 해제됩니다." : "시간이 지나도 자동 완료되지 않습니다."}</p>
            {isWindow && <div className="grid gap-3 sm:grid-cols-2">{field("windowStartDate", "접수 시작일", "date")}{field("windowStartTime", "접수 시작 시각 (선택)", "time")}</div>}
            {!isEvent && <div className="grid gap-3 sm:grid-cols-2">{field("dueDate", "마감일", "date")}{field("dueTime", "마감 시각 (선택)", "time")}</div>}
            {isEvent && <>
              <div className="grid gap-3 sm:grid-cols-2">{field("eventStartDate", "시험·행사 시작일", "date")}{field("eventStartTime", "시작 시각 (선택)", "time")}</div>
              <div className="grid gap-3 sm:grid-cols-2">{field("eventEndDate", "종료일 (선택)", "date")}{field("eventEndTime", "종료 시각 (선택)", "time")}</div>
            </>}
            {field("timeZone", "원본 시간대")}
            {form.sourceType === "EXTERNAL_NOTICE" && <>
              {field("sourceUrl", "출처 주소")}{field("sourceLabel", "출처 이름")}
              <label className="flex min-h-11 items-center gap-3 text-sm"><input type="checkbox" checked={sourceChecked} onChange={event => setSourceChecked(event.target.checked)} className="h-5 w-5 accent-teal-700" />출처를 열어 위 날짜와 내용을 직접 대조했습니다.</label>
            </>}
            <div className="flex flex-wrap gap-2">
              <button type="submit" className={actionButtonClass + " bg-teal-700 !text-white hover:!bg-teal-800"}>변경 저장</button>
              <button type="button" className={actionButtonClass} onClick={() => { onDelete(task.id); onClose(); }}>일정 삭제</button>
            </div>
          </fieldset>
        </form>}
      {error && <p role="alert" className="break-words text-sm text-red-800 dark:text-red-200">{error}</p>}
      {message && <p role="status" className="text-sm font-medium text-teal-800 dark:text-teal-200">{message}</p>}
    </div>
  </ActionDialog>;
}
