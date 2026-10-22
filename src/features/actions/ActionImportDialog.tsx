import { useState } from "react";
import type { Task } from "../../types";
import { ActionDialog, actionButtonClass, actionInputClass } from "./ActionDialog";
import { ActionSummary } from "./ActionSummary";
import { ACTION_GPT_PROMPT, ACTION_IMPORT_EXAMPLE } from "./actionExample";
import { parseActionImport, type ActionImportPreview, type ImportOutcome } from "./actionImport";
import type { ActionActions } from "./useActionActions";

export function ActionImportDialog({ tasks, actions, onClose, onOpenTask }: { tasks: Task[]; actions: ActionActions; onClose: () => void; onOpenTask: (id: string, proposal?: Task) => void }) {
  const [input, setInput] = useState("");
  const [preview, setPreview] = useState<ActionImportPreview | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [independent, setIndependent] = useState<Set<string>>(new Set());
  const [result, setResult] = useState<ImportOutcome[]>([]);
  const [proposals, setProposals] = useState<Record<string, Task>>({});
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  function review() {
    try {
      const next = parseActionImport(input);
      setPreview(next); setSelected(new Set(next.items.filter(item => item.task && !item.issues.length).map(item => item.itemKey)));
      setIndependent(new Set()); setResult([]); setError(null);
    } catch (caught) { setPreview(null); setError(caught instanceof Error ? caught.message : "입력을 확인해 주세요."); }
  }
  async function save(state: "CANDIDATE" | "CONFIRMED") {
    if (!preview || busy) return;
    setBusy(true); setError(null);
    try {
      const items = preview.items.filter(item => item.task && selected.has(item.itemKey) && !item.issues.length);
      const outcomes = await actions.importActions(items.map(item => ({ task: item.task!, state, independent: independent.has(item.itemKey) })));
      setProposals(Object.fromEntries(outcomes.flatMap((outcome, index) => outcome.taskId && items[index].task ? [[outcome.taskId, items[index].task!]] : [])));
      setResult(outcomes); setPreview(null);
    } catch (caught) { setError(caught instanceof Error ? caught.message : "저장하지 못했습니다. 입력을 유지했습니다."); }
    finally { setBusy(false); }
  }
  async function copyPrompt() {
    try { await navigator.clipboard.writeText(ACTION_GPT_PROMPT); setMessage("GPT에 전달할 입력 양식을 복사했습니다."); }
    catch { setMessage("아래 입력 양식을 펼쳐 직접 복사해 주세요."); }
  }
  const resultLabels = { CREATED: "로컬 저장 완료", MATCHED: "기존 일정 유지", REVIEW_REQUIRED: "기존 일정과 다름 · 자동 변경 없음", DELETED_MATCH: "삭제한 일정 · 자동 복원 없음" };
  return <ActionDialog title="일정 가져오기" onClose={onClose} busy={busy}>
    <div className="space-y-4">
      <p className="text-sm leading-relaxed text-slate-600 dark:text-neutral-300">GPT가 정리한 일정을 붙여넣고 날짜와 출처를 확인하세요. 등록한 일정은 기존 달력에서 볼 수 있습니다.</p>
      <div className="flex flex-wrap gap-2">
        <button type="button" className={actionButtonClass} onClick={copyPrompt}>GPT 입력 양식 복사</button>
        <button type="button" className={actionButtonClass} disabled={busy} onClick={() => { setInput(ACTION_IMPORT_EXAMPLE); setPreview(null); setResult([]); }}>가상 예시 넣기</button>
      </div>
      {message && <p role="status" className="text-sm">{message}</p>}
      <details className="text-sm"><summary className="cursor-pointer py-2">입력 양식 직접 보기</summary><pre className="max-h-64 overflow-auto whitespace-pre-wrap break-words text-xs">{ACTION_GPT_PROMPT}</pre></details>
      <label className="block text-sm font-semibold">일정 JSON
        <textarea value={input} disabled={busy} onChange={event => { setInput(event.target.value); setPreview(null); setResult([]); }} rows={8} className={actionInputClass + " mt-2 font-mono"} placeholder="GPT가 만든 JSON을 붙여넣으세요." spellCheck={false} />
      </label>
      <button type="button" className={actionButtonClass} onClick={review} disabled={!input.trim() || busy}>내용 검토</button>
      {error && <p role="alert" className="break-words rounded-md bg-red-50 p-3 text-sm text-red-800 dark:bg-red-950 dark:text-red-200">{error}</p>}
      {preview && <div className="space-y-4">
        <p className="text-sm font-semibold">총 {preview.items.length}개 · 선택 {selected.size}개</p>
        <ul className="divide-y divide-slate-200 dark:divide-neutral-800">
          {preview.items.map(item => {
            const existing = item.task?.externalKey ? tasks.find(task => task.sourceNamespace === item.task?.sourceNamespace && task.externalKey === item.task?.externalKey) : undefined;
            return <li key={item.itemKey} className="space-y-2 py-4">
              <label className="flex min-h-11 items-center gap-3 font-semibold">
                <input type="checkbox" checked={selected.has(item.itemKey)} disabled={!item.task || Boolean(item.issues.length) || busy}
                  onChange={event => setSelected(current => { const next = new Set(current); if (event.target.checked) next.add(item.itemKey); else next.delete(item.itemKey); return next; })} className="h-5 w-5 accent-teal-700" />
                <span className="min-w-0 break-words">{item.task?.text ?? item.itemKey}</span>
              </label>
              {item.task && <ActionSummary task={item.task} />}
              {item.task?.sourceLabel && <p className="text-sm">출처: {item.task.sourceLabel}</p>}
              {item.task?.sourceUrl && <p className="break-all text-xs text-slate-600 dark:text-neutral-300">{item.task.sourceUrl}</p>}
              {existing && <p className="text-sm font-medium text-amber-800 dark:text-amber-200">기존 {existing.deletedAt ? "삭제된 " : ""}일정이 있습니다. 저장 시 기존 내용을 유지합니다.</p>}
              {item.task && !item.task.externalKey && <label className="flex min-h-11 items-center gap-2 text-sm">
                <input type="checkbox" checked={independent.has(item.itemKey)} onChange={event => setIndependent(current => { const next = new Set(current); if (event.target.checked) next.add(item.itemKey); else next.delete(item.itemKey); return next; })} className="h-5 w-5" />
                기존 일정과 별개의 일정으로 생성 (기기 간 자동 중복 확인 없음)
              </label>}
              {item.issues.map(issue => <p key={issue.fieldPath} role="alert" className="text-sm text-red-800 dark:text-red-200">{issue.fieldPath}: {issue.message}</p>)}
            </li>;
          })}
        </ul>
        <p className="text-sm text-slate-600 dark:text-neutral-300">‘일정으로 등록’해도 외부 출처는 미확인 상태로 유지됩니다. 출처 대조는 일정 상세에서 별도로 기록합니다.</p>
        <div className="flex flex-wrap gap-2">
          <button type="button" className={actionButtonClass} disabled={!selected.size || busy} onClick={() => void save("CANDIDATE")}>후보로 보관</button>
          <button type="button" className={actionButtonClass + " bg-teal-700 !text-white hover:!bg-teal-800"} disabled={!selected.size || busy} onClick={() => void save("CONFIRMED")}>{busy ? "저장 중…" : "일정으로 등록"}</button>
        </div>
      </div>}
      {result.length > 0 && <div role="status" className="space-y-3">
        <p className="text-sm">로컬 처리 결과입니다. 다른 기기에서는 서버 동기화가 끝난 뒤 확인할 수 있습니다.</p>
        {result.map((item, index) => <div key={index} className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-200 pt-3 dark:border-neutral-800">
          <div className="min-w-0"><p className="break-words font-semibold">{item.text}</p><p className="text-sm">{resultLabels[item.outcome]}</p></div>
          {item.taskId && <button type="button" className={actionButtonClass} onClick={() => onOpenTask(item.taskId!, item.outcome === "REVIEW_REQUIRED" ? proposals[item.taskId!] : undefined)}>일정 확인</button>}
        </div>)}
      </div>}
    </div>
  </ActionDialog>;
}
