import { useEffect, useState } from "react";
import { FolderOpen, RefreshCw, Save } from "lucide-react";

import type { KnowledgeVaultRuntime } from "../../features/knowledge-vault/useKnowledgeVaultRuntime";

export function KnowledgeVaultSettingsSection({
  vault,
}: {
  vault: KnowledgeVaultRuntime;
}) {
  const [pathDraft, setPathDraft] = useState(vault.config.vaultPath ?? "");
  const [isSaving, setIsSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    setPathDraft(vault.config.vaultPath ?? "");
  }, [vault.config.vaultPath]);

  const supported = vault.config.supported;

  async function savePath() {
    if (!pathDraft.trim()) {
      setFormError("지식 보관함 폴더 경로를 입력하세요.");
      return;
    }
    setIsSaving(true);
    setFormError(null);
    try {
      await vault.savePath(pathDraft);
    } catch (caughtError) {
      setFormError(caughtError instanceof Error ? caughtError.message : "지식 보관함 경로를 저장하지 못했습니다.");
    } finally {
      setIsSaving(false);
    }
  }

  async function choosePath() {
    setIsSaving(true);
    setFormError(null);
    try {
      await vault.choosePath();
    } catch (caughtError) {
      setFormError(caughtError instanceof Error ? caughtError.message : "지식 보관함 폴더를 선택하지 못했습니다.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <section className="rounded-md border border-slate-200 bg-white p-3 dark:border-neutral-800 dark:bg-black">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-sm font-semibold text-slate-800 dark:text-neutral-100">
          <FolderOpen className="h-4 w-4 text-teal-700 dark:text-teal-300" aria-hidden="true" />
          <span>지식 보관함</span>
        </div>
        <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
          !supported
            ? "bg-slate-100 text-slate-600 dark:bg-neutral-900 dark:text-neutral-300"
            : vault.config.vaultPath
              ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"
              : "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300"
        }`}>
          {!supported ? "지원되지 않음" : vault.config.vaultPath ? "연결됨" : "미설정"}
        </span>
      </div>

      <p className="mt-2 text-xs text-slate-500 dark:text-neutral-400">
        일반 마크다운 문서는 보관함 파일이 원본이며, 프로젝트·워크스트림 홈 문서는 앱 데이터에서 생성됩니다.
      </p>

      {supported ? (
        <div className="mt-3 grid gap-2">
          <label className="grid gap-1 text-[11px] font-medium text-slate-600 dark:text-neutral-300">
            <span>보관함 절대 경로</span>
            <input
              value={pathDraft}
              onChange={(event) => setPathDraft(event.target.value)}
              placeholder="C:\\Users\\name\\Documents\\Knowledge"
              className="h-9 w-full rounded-md border border-slate-300 bg-white px-2 text-xs text-slate-900 outline-none focus:border-teal-600 dark:border-neutral-800 dark:bg-black dark:text-neutral-100"
            />
          </label>
          <div className="flex flex-wrap gap-2">
            <button type="button" disabled={isSaving} onClick={() => void choosePath()} className="inline-flex h-9 items-center gap-1.5 rounded-md border border-slate-300 px-3 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50 dark:border-neutral-800 dark:text-neutral-200 dark:hover:bg-neutral-900">
              <FolderOpen className="h-3.5 w-3.5" aria-hidden="true" /> 폴더 선택
            </button>
            <button type="button" disabled={isSaving} onClick={() => void savePath()} className="inline-flex h-9 items-center gap-1.5 rounded-md bg-teal-700 px-3 text-xs font-medium text-white hover:bg-teal-600 disabled:opacity-50">
              <Save className="h-3.5 w-3.5" aria-hidden="true" /> 경로 저장
            </button>
            <button type="button" disabled={vault.isReconciling || isSaving || !vault.config.vaultPath} onClick={() => void vault.reconcile()} className="inline-flex h-9 items-center gap-1.5 rounded-md border border-slate-300 px-3 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50 dark:border-neutral-800 dark:text-neutral-200 dark:hover:bg-neutral-900">
              <RefreshCw className={`h-3.5 w-3.5 ${vault.isReconciling ? "animate-spin" : ""}`} aria-hidden="true" /> 문서 갱신
            </button>
          </div>
          {vault.config.vaultPath ? <p className="break-all text-[11px] text-slate-500 dark:text-neutral-400">현재 경로: {vault.config.vaultPath}</p> : <p className="text-[11px] text-amber-700 dark:text-amber-300">지식 보관함을 연결하지 않아도 앱의 로컬 저장과 동기화는 계속 사용할 수 있습니다.</p>}
          {vault.missingDocumentIds.length > 0 ? <p className="text-[11px] text-amber-700 dark:text-amber-300">등록 정보는 있지만 파일이 없는 문서 {vault.missingDocumentIds.length}개가 있습니다. 파일은 자동 생성하지 않았습니다.</p> : null}
          {vault.isReconciling ? <p className="text-[11px] text-slate-500 dark:text-neutral-400">홈 문서를 갱신하는 중입니다…</p> : null}
        </div>
      ) : (
        <p className="mt-3 text-[11px] text-slate-500 dark:text-neutral-400">현재 실행 환경에서는 데스크톱 지식 보관함 기능을 사용할 수 없습니다.</p>
      )}
      {formError || vault.error ? <p role="alert" className="mt-2 rounded border border-rose-200 bg-rose-50 px-2 py-1.5 text-[11px] text-rose-700 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-300">{formError ?? vault.error}</p> : null}
    </section>
  );
}
