import { Database, ExternalLink, LoaderCircle } from "lucide-react";
import { useState } from "react";
import { normalizeDbEditorError } from "./model";
import { openDbEditorWindow } from "./window";

export function DbEditorLauncher() {
  const [isOpening, setIsOpening] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleOpen() {
    setIsOpening(true);
    setError(null);

    try {
      await openDbEditorWindow();
    } catch (caughtError) {
      setError(normalizeDbEditorError(caughtError).message);
    } finally {
      setIsOpening(false);
    }
  }

  return (
    <section className="rounded-md border border-slate-200 bg-slate-50 p-3 dark:border-neutral-800 dark:bg-neutral-950">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-2">
          <Database
            className="mt-0.5 h-4 w-4 shrink-0 text-teal-700 dark:text-teal-300"
            aria-hidden="true"
          />
          <div className="min-w-0">
            <h2 className="text-sm font-semibold text-slate-900 dark:text-neutral-100">
              Supabase 데이터 편집기
            </h2>
            <p className="mt-1 text-xs leading-5 text-slate-600 dark:text-neutral-400">
              별도 전체 폭 창에서 개인 액세스 토큰으로 접근 가능한 프로젝트와 테이블을
              읽고, 기본 키가 있는 한 행의 변경 컬럼만 수정합니다.
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => void handleOpen()}
          disabled={isOpening}
          className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-md border border-slate-300 bg-white px-3 text-xs font-semibold text-slate-800 transition hover:border-teal-500 hover:text-teal-800 disabled:cursor-wait disabled:opacity-60 dark:border-neutral-700 dark:bg-black dark:text-neutral-100 dark:hover:border-teal-400 dark:hover:text-teal-300"
        >
          {isOpening ? (
            <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" />
          ) : (
            <ExternalLink className="h-4 w-4" aria-hidden="true" />
          )}
          <span>열기</span>
        </button>
      </div>
      {error ? (
        <p
          role="alert"
          className="mt-2 rounded border border-red-200 bg-red-50 px-2 py-1.5 text-xs text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200"
        >
          {error}
        </p>
      ) : null}
    </section>
  );
}
