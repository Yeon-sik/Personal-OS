import { useEffect, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import type { Task, TaskDetailsChanges, TaskRecurrence, TaskChecklistItem } from "../../../types";
import { createId } from "../../../lib/storage/id";
import { actionButtonClass, actionInputClass } from "../../actions/ActionDialog";
import { validDate } from "../../actions/actionTime";
import { TASK_CATEGORIES } from "../taskPlanningPresentation";

interface TaskDetailsEditorProps {
  task: Task;
  onSave: (id: string, changes: TaskDetailsChanges) => void | Promise<void>;
  onSkipOccurrence?: (id: string) => void | Promise<void>;
  onSaved?: () => void;
  onCancel?: () => void;
  onDirtyChange?: (dirty: boolean) => void;
  embedded?: boolean;
  onDraftChange?: (changes: TaskDetailsChanges, valid: boolean) => void;
}

function draftFor(task: Task) {
  return {
    description: task.description ?? "",
    category: task.category ?? "",
    checklist: (task.checklist ?? []).map(item => ({ ...item })),
    recurrence: task.recurrence ? { ...task.recurrence } : null,
  };
}

export function TaskDetailsEditor({ task, onSave, onSkipOccurrence, onSaved, onCancel, onDirtyChange, embedded = false, onDraftChange }: TaskDetailsEditorProps) {
  const [draft, setDraft] = useState(() => draftFor(task));
  const [baseRevision, setBaseRevision] = useState(task.updatedAt);
  const [dirty, setDirty] = useState(false);
  const [stepText, setStepText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const hasDraft = dirty || Boolean(stepText.trim());
  const changedElsewhere = hasDraft && task.updatedAt !== baseRevision;
  useEffect(() => { onDirtyChange?.(hasDraft); }, [hasDraft, onDirtyChange]);
  const availableAnchor = task.plannedDate ?? task.dueDate ?? task.eventStartDate ?? task.windowStartDate ?? "";
  const recurrenceInvalid = Boolean(draft.recurrence && (!validDate(draft.recurrence.anchorDate) || !Number.isInteger(draft.recurrence.interval) || draft.recurrence.interval < 1 || draft.recurrence.interval > 365));
  const canRepeat = !task.projectActionId && !task.isDone && !task.skippedAt;

  useEffect(() => {
    if (!hasDraft) {
      setDraft(draftFor(task));
      setBaseRevision(task.updatedAt);
    }
  }, [task, hasDraft]);

  function publishDraft(next: typeof draft, pendingStep = stepText) {
    const valid = !pendingStep.trim() && next.checklist.length <= 100 && !next.checklist.some(item => !item.text.trim()) && (!next.recurrence || (validDate(next.recurrence.anchorDate) && Number.isInteger(next.recurrence.interval) && next.recurrence.interval >= 1 && next.recurrence.interval <= 365));
    onDraftChange?.({ ...next, category: next.category || null, checklist: next.checklist.map(item => ({ ...item, text: item.text.trim() })) }, valid);
  }
  function change(changes: Partial<typeof draft>, pendingStep = stepText) {
    const next = { ...draft, ...changes };
    setDraft(next);
    publishDraft(next, pendingStep);
    setDirty(true);
    setError(null);
    setMessage("");
  }
  function discardDraft() {
    const next = draftFor(task);
    setDraft(next); setBaseRevision(task.updatedAt); setDirty(false); setStepText("");
    setError(null); setMessage(""); publishDraft(next, "");
  }
  function updateStep(id: string, changes: Partial<TaskChecklistItem>) {
    change({ checklist: draft.checklist.map(item => item.id === id ? { ...item, ...changes } : item) });
  }
  function addStep() {
    if (!stepText.trim() || draft.checklist.length >= 100) return;
    change({ checklist: [...draft.checklist, { id: createId(), text: stepText.trim(), isDone: false }] }, "");
    setStepText("");
  }
  async function save() {
    if (busy || changedElsewhere || recurrenceInvalid) return;
    if (stepText.trim()) { setError("작성 중인 하위 항목을 추가하거나 비워 주세요."); return; }
    if (draft.checklist.some(item => !item.text.trim())) { setError("빈 하위 항목은 내용을 입력하거나 삭제해 주세요."); return; }
    setBusy(true); setError(null);
    try {
      await onSave(task.id, {
        description: draft.description,
        category: draft.category || null,
        checklist: draft.checklist.map(item => ({ ...item, text: item.text.trim() })),
        recurrence: draft.recurrence,
      });
      setDirty(false); setMessage("세부 내용을 저장했습니다."); onSaved?.();
    } catch (caught) { setError(caught instanceof Error ? caught.message : "저장하지 못했습니다. 다시 시도해 주세요."); }
    finally { setBusy(false); }
  }
  async function skip() {
    if (busy || !onSkipOccurrence || hasDraft) return;
    setBusy(true); setError(null);
    try { await onSkipOccurrence(task.id); setMessage("이번 회차를 건너뛰었습니다."); onSaved?.(); }
    catch (caught) { setError(caught instanceof Error ? caught.message : "건너뛰지 못했습니다. 다시 시도해 주세요."); }
    finally { setBusy(false); }
  }

  return <section aria-label="할 일 세부 편집" className="space-y-4 py-3">
    {!embedded && changedElsewhere && <div role="alert" className="space-y-2 text-sm text-amber-900 dark:text-amber-200">
      <p>다른 화면이나 기기에서 이 할 일이 바뀌었습니다. 작성 중인 내용은 보존했습니다. 최신 내용을 확인한 뒤 다시 편집해 주세요.</p>
      <button type="button" className={actionButtonClass} onClick={discardDraft}>내 편집 버리고 최신 내용 불러오기</button>
    </div>}
    <fieldset disabled={busy || Boolean(task.deletedAt)} className="min-w-0 space-y-4 disabled:opacity-60">
      <label className="block text-sm font-medium">설명·참고 링크
        <textarea value={draft.description} onChange={event => change({ description: event.target.value })} rows={4} maxLength={10000} className={actionInputClass + " mt-1 resize-y"} placeholder="작업 메모, 준비물, 참고 주소를 남기세요." />
      </label>
      <label className="block text-sm font-medium">분류
        <select value={draft.category} onChange={event => change({ category: event.target.value })} className={actionInputClass + " mt-1"}>
          <option value="">분류 없음</option>
          {TASK_CATEGORIES.map(category => <option key={category} value={category}>{category}</option>)}
          {draft.category && !TASK_CATEGORIES.some(category => category === draft.category) && <option value={draft.category}>{draft.category}</option>}
        </select>
      </label>
      <section aria-label="하위 체크리스트" className="space-y-2">
        <h4 className="text-sm font-semibold">하위 체크리스트 <span className="tabular-nums">{draft.checklist.filter(item => item.isDone).length}/{draft.checklist.length}</span></h4>
        {draft.checklist.map((item, index) => <div key={item.id} className="flex min-w-0 items-center gap-2">
          <label className="flex min-h-11 min-w-11 shrink-0 items-center justify-center"><input type="checkbox" checked={item.isDone} onChange={event => updateStep(item.id, { isDone: event.target.checked })} aria-label={`${index + 1}번 하위 항목 완료`} className="h-5 w-5 accent-teal-700" /></label>
          <input value={item.text} onChange={event => updateStep(item.id, { text: event.target.value })} maxLength={500} aria-label={`${index + 1}번 하위 항목 내용`} className={actionInputClass + " min-w-0 flex-1"} />
          <button type="button" className={actionButtonClass + " shrink-0"} aria-label={`${index + 1}번 하위 항목 삭제`} onClick={() => change({ checklist: draft.checklist.filter(step => step.id !== item.id) })}><Trash2 size={18} aria-hidden="true" /></button>
        </div>)}
        <div className="flex min-w-0 gap-2">
          <input value={stepText} onChange={event => { setStepText(event.target.value); publishDraft(draft, event.target.value); }} onKeyDown={event => { if (event.key === "Enter" && !event.nativeEvent.isComposing && event.keyCode !== 229) { event.preventDefault(); addStep(); } }} maxLength={500} placeholder="작은 단계 추가" aria-label="새 하위 항목" className={actionInputClass + " min-w-0 flex-1"} />
          <button type="button" disabled={!stepText.trim() || draft.checklist.length >= 100} className={actionButtonClass + " shrink-0"} onClick={addStep} aria-label="하위 항목 추가"><Plus size={18} aria-hidden="true" /></button>
        </div>
      </section>
      <section aria-label="반복 설정" className="space-y-3">
        <label className="block text-sm font-medium">반복
          <select value={draft.recurrence?.frequency ?? ""} disabled={!canRepeat} onChange={event => change({ recurrence: event.target.value ? { frequency: event.target.value as TaskRecurrence["frequency"], interval: draft.recurrence?.interval ?? 1, anchorDate: draft.recurrence?.anchorDate ?? availableAnchor } : null })} className={actionInputClass + " mt-1"}>
            <option value="">반복 안 함</option><option value="DAILY">매일</option><option value="WEEKLY">매주</option><option value="MONTHLY">매월</option>
          </select>
        </label>
        {draft.recurrence && <div className="grid gap-3 sm:grid-cols-2">
          <label className="block text-sm font-medium">반복 간격
            <input type="number" min={1} max={365} step={1} value={draft.recurrence.interval} disabled={!canRepeat} onChange={event => change({ recurrence: { ...draft.recurrence!, interval: Number(event.target.value) } })} className={actionInputClass + " mt-1"} />
            <span className="mt-1 block text-sm text-slate-600 dark:text-neutral-300">{draft.recurrence.frequency === "DAILY" ? "일" : draft.recurrence.frequency === "WEEKLY" ? "주" : "개월"}마다 반복</span>
          </label>
          <label className="block text-sm font-medium">반복 기준 날짜
            <input type="date" value={draft.recurrence.anchorDate} disabled={!canRepeat} onChange={event => change({ recurrence: { ...draft.recurrence!, anchorDate: event.target.value } })} className={actionInputClass + " mt-1"} />
          </label>
        </div>}
        {draft.recurrence && <p className="text-sm text-slate-600 dark:text-neutral-300">기준 날짜의 요일·일자를 유지합니다. 없는 월말 날짜는 그달 마지막 날로 조정합니다. 완료하거나 건너뛸 때 다음 회차를 만들고 이전 기록을 남깁니다.</p>}
        {task.projectActionId && <p className="text-sm text-slate-600 dark:text-neutral-300">프로젝트와 연결된 작업에는 반복을 설정할 수 없습니다.</p>}
        {recurrenceInvalid && <p role="alert" className="text-sm text-red-800 dark:text-red-200">반복 기준 날짜와 1~365 사이의 정수 간격을 입력해 주세요.</p>}
      </section>
      {!embedded && <div className="flex flex-wrap gap-2">
        <button type="button" disabled={!dirty || changedElsewhere || recurrenceInvalid || Boolean(stepText.trim())} className={actionButtonClass + " bg-teal-700 !text-white hover:!bg-teal-800"} onClick={() => void save()}>{busy ? "저장 중…" : "세부 내용 저장"}</button>
        <button type="button" className={actionButtonClass} onClick={() => { discardDraft(); onCancel?.(); }}>편집 취소</button>
        {task.recurrence && !task.isDone && !task.skippedAt && onSkipOccurrence && <button type="button" disabled={hasDraft} className={actionButtonClass} onClick={() => void skip()}>이번 회차 건너뛰기</button>}
      </div>}
      {stepText.trim() && <p className="text-sm text-slate-600 dark:text-neutral-300">작성한 하위 항목을 추가한 뒤 저장해 주세요.</p>}
      {!embedded && hasDraft && task.recurrence && <p className="text-sm text-slate-600 dark:text-neutral-300">편집 내용을 저장한 뒤 이번 회차를 건너뛸 수 있습니다.</p>}
    </fieldset>
    {error && <p role="alert" className="text-sm text-red-800 dark:text-red-200">{error}</p>}
    {message && <p role="status" className="text-sm text-teal-800 dark:text-teal-200">{message}</p>}
  </section>;
}
