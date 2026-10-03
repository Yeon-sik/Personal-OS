import { useEffect, useState, type FormEvent } from "react";
import { CheckCircle2, Github, Save, Trash2 } from "lucide-react";

import { githubApi } from "../../features/dev-control/github/githubApi";
import type {
  GitHubConfigService,
  GitHubConfigStatus,
} from "../../features/dev-control/github/githubTypes";

interface GitHubSettingsSectionProps {
  onRefreshGitHubStatus: () => Promise<void>;
  service?: GitHubConfigService;
}

const emptyConfigStatus: GitHubConfigStatus = {
  clientId: "",
  configured: false,
  appSlug: null,
  source: "none",
};

const sourceLabels: Record<GitHubConfigStatus["source"], string> = {
  "local-settings": "앱 설정",
  env: "환경 변수",
  file: "설정 파일",
  none: "미설정",
};

function errorMessage(error: unknown): string {
  if (typeof error === "string" && error.trim()) return error;
  if (error instanceof Error && error.message.trim()) return error.message;
  if (typeof error === "object" && error !== null && "message" in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === "string" && message.trim()) return message;
  }
  return "GitHub 설정을 처리하지 못했습니다.";
}

export function GitHubSettingsSection({
  onRefreshGitHubStatus,
  service = githubApi,
}: GitHubSettingsSectionProps) {
  const [configStatus, setConfigStatus] = useState(emptyConfigStatus);
  const [clientId, setClientId] = useState("");
  const [appSlug, setAppSlug] = useState("");
  const [operation, setOperation] = useState<
    "idle" | "loading" | "saving" | "deleting" | "saved" | "error"
  >("loading");
  const [error, setError] = useState<string | null>(null);

  async function refreshConfig() {
    setOperation("loading");
    setError(null);
    try {
      const nextStatus = await service.getConfigStatus();
      setConfigStatus(nextStatus);
      setClientId(nextStatus.clientId);
      setAppSlug(nextStatus.appSlug ?? "");
      setOperation("idle");
    } catch (refreshError) {
      setOperation("error");
      setError(errorMessage(refreshError));
    }
  }

  useEffect(() => {
    void refreshConfig();
  }, [service]);

  async function handleSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setOperation("saving");
    setError(null);
    try {
      const nextStatus = await service.saveConfig({
        clientId,
        appSlug: appSlug.trim() || null,
      });
      setConfigStatus(nextStatus);
      setClientId(nextStatus.clientId);
      setAppSlug(nextStatus.appSlug ?? "");
      await onRefreshGitHubStatus();
      setOperation("saved");
    } catch (saveError) {
      setOperation("error");
      setError(errorMessage(saveError));
    }
  }

  async function handleDelete() {
    setOperation("deleting");
    setError(null);
    try {
      const nextStatus = await service.deleteConfig();
      setConfigStatus(nextStatus);
      setClientId(nextStatus.clientId);
      setAppSlug(nextStatus.appSlug ?? "");
      await onRefreshGitHubStatus();
      setOperation("saved");
    } catch (deleteError) {
      setOperation("error");
      setError(errorMessage(deleteError));
    }
  }

  const disabled =
    operation === "loading" || operation === "saving" || operation === "deleting";

  return (
    <section className="rounded-md border border-slate-200 bg-white p-3 dark:border-neutral-800 dark:bg-black">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-sm font-semibold text-slate-800 dark:text-neutral-100">
          <Github
            className="h-4 w-4 text-slate-700 dark:text-neutral-200"
            aria-hidden="true"
          />
          <span>GitHub</span>
        </div>
        <span className="text-xs font-medium text-slate-500 dark:text-neutral-400">
          설정 출처: {sourceLabels[configStatus.source]}
        </span>
      </div>

      <form onSubmit={handleSave} className="mt-3 space-y-3">
        <label className="block space-y-1.5">
          <span className="text-xs font-medium text-slate-600 dark:text-neutral-400">
            클라이언트 ID
          </span>
          <input
            type="text"
            value={clientId}
            onChange={(event) => {
              setClientId(event.target.value);
              setOperation("idle");
            }}
            autoComplete="off"
            spellCheck={false}
            className="h-9 w-full rounded-md border border-slate-300 bg-white px-3 font-mono text-sm text-slate-900 outline-none transition focus:border-slate-600 focus:ring-2 focus:ring-slate-100 dark:border-neutral-800 dark:bg-black dark:text-neutral-100 dark:focus:border-neutral-400 dark:focus:ring-neutral-900"
          />
        </label>

        <label className="block space-y-1.5">
          <span className="text-xs font-medium text-slate-600 dark:text-neutral-400">
            앱 식별명 (선택)
          </span>
          <input
            type="text"
            value={appSlug}
            onChange={(event) => {
              setAppSlug(event.target.value);
              setOperation("idle");
            }}
            autoComplete="off"
            spellCheck={false}
            className="h-9 w-full rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none transition focus:border-slate-600 focus:ring-2 focus:ring-slate-100 dark:border-neutral-800 dark:bg-black dark:text-neutral-100 dark:focus:border-neutral-400 dark:focus:ring-neutral-900"
          />
        </label>

        <p className="text-[11px] leading-4 text-slate-500 dark:text-neutral-400">
          클라이언트 ID와 앱 식별명은 공개 식별자입니다. 비밀 키와 개인 키는 입력하지 않습니다.
        </p>

        <div className="flex items-center gap-2">
          <button
            type="submit"
            disabled={disabled || !clientId.trim()}
            className="inline-flex h-9 flex-1 items-center justify-center gap-2 rounded-md bg-slate-900 px-3 text-sm font-medium text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:bg-slate-400 dark:bg-neutral-100 dark:text-black dark:hover:bg-white dark:disabled:bg-neutral-800 dark:disabled:text-neutral-400"
          >
            <Save className="h-4 w-4" aria-hidden="true" />
            <span>{operation === "saving" ? "저장 중" : "저장"}</span>
          </button>
          <button
            type="button"
            disabled={disabled}
            onClick={() => void handleDelete()}
            className="inline-flex h-9 items-center justify-center gap-2 rounded-md border border-rose-300 px-3 text-sm font-medium text-rose-700 transition hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-rose-900 dark:text-rose-300 dark:hover:bg-rose-950/30"
          >
            <Trash2 className="h-4 w-4" aria-hidden="true" />
            <span>{operation === "deleting" ? "삭제 중" : "설정 삭제"}</span>
          </button>
          {operation === "saved" ? (
            <span className="inline-flex h-9 items-center gap-1.5 rounded-md border border-emerald-200 px-2 text-xs font-medium text-emerald-700 dark:border-emerald-800 dark:text-emerald-300">
              <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
              완료
            </span>
          ) : null}
        </div>
      </form>

      {error ? (
        <p
          role="alert"
          className="mt-2 rounded border border-red-200 bg-red-50 px-2 py-1.5 text-[11px] text-red-800 dark:border-red-900 dark:bg-red-950/30 dark:text-red-200"
        >
          {error}
        </p>
      ) : null}
    </section>
  );
}
