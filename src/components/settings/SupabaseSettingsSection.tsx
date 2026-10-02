import { useEffect, useState, type FormEvent } from "react";
import {
  CheckCircle2,
  KeyRound,
  Link as LinkIcon,
  LogOut,
  RefreshCw,
  Save,
  Server,
  User,
} from "lucide-react";
import type {
  RuntimeConfig,
  SupabaseConfigInput,
} from "../../lib/config/runtimeConfig";
import { isManagedSupabaseConfig } from "../../lib/config/runtimeConfig";
import type { SyncStatus } from "../../lib/sync/syncTypes";
import { getSyncStatusDescription, getSyncStatusLabel } from "../syncStatusPresentation";

interface SupabaseSettingsSectionProps {
  authEmail: string | null;
  isAuthenticated: boolean;
  isManualSyncing: boolean;
  isSupabaseConfigured: boolean;
  supabaseConfig: RuntimeConfig;
  syncStatus: SyncStatus;
  userId: string;
  onManualSync: () => Promise<void>;
  onSaveSupabaseConfig: (config: SupabaseConfigInput) => Promise<void>;
  onSignIn: (email: string, password: string) => Promise<void>;
  onSignOut: () => Promise<void>;
}

export function SupabaseSettingsSection({
  authEmail,
  isAuthenticated,
  isManualSyncing,
  isSupabaseConfigured,
  supabaseConfig,
  syncStatus,
  userId,
  onManualSync,
  onSaveSupabaseConfig,
  onSignIn,
  onSignOut,
}: SupabaseSettingsSectionProps) {
  const [supabaseUrl, setSupabaseUrl] = useState(supabaseConfig.supabaseUrl);
  const [supabaseAnonKey, setSupabaseAnonKey] = useState(
    supabaseConfig.supabaseAnonKey,
  );
  const [authEmailInput, setAuthEmailInput] = useState(authEmail ?? "");
  const [authPassword, setAuthPassword] = useState("");
  const [authStatus, setAuthStatus] = useState<
    "idle" | "signing-in" | "signed-in" | "error"
  >("idle");
  const [supabaseSaveStatus, setSupabaseSaveStatus] = useState<
    "idle" | "saving" | "saved" | "error"
  >("idle");
  const usesManagedConfig = isManagedSupabaseConfig(supabaseConfig);
  const configSourceLabel = usesManagedConfig
    ? "앱 관리"
    : supabaseConfig.loaded
      ? "수동 연결"
      : "미설정";

  useEffect(() => {
    setSupabaseUrl(supabaseConfig.supabaseUrl);
    setSupabaseAnonKey(supabaseConfig.supabaseAnonKey);
  }, [supabaseConfig.supabaseAnonKey, supabaseConfig.supabaseUrl]);

  useEffect(() => {
    setAuthEmailInput(authEmail ?? "");
  }, [authEmail]);

  async function handleSupabaseConfigSubmit(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();
    setSupabaseSaveStatus("saving");

    try {
      await onSaveSupabaseConfig({
        supabaseUrl,
        supabaseAnonKey,
      });
      setSupabaseSaveStatus("saved");
    } catch {
      setSupabaseSaveStatus("error");
    }
  }

  async function handleSignIn(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setAuthStatus("signing-in");
    try {
      await onSignIn(authEmailInput, authPassword);
      setAuthPassword("");
      setAuthStatus("signed-in");
    } catch {
      setAuthStatus("error");
    }
  }

  return (
    <>
      <section className="rounded-md border border-slate-200 bg-slate-50 p-3 dark:border-neutral-800 dark:bg-neutral-950">
        <div className="flex items-center gap-2 text-sm font-semibold text-slate-800 dark:text-neutral-100">
          <Server
            className="h-4 w-4 text-indigo-700 dark:text-indigo-300"
            aria-hidden="true"
          />
          <span>연결 상태</span>
        </div>

        <dl className="mt-3 space-y-2 text-xs text-slate-600 dark:text-neutral-400">
          <div className="flex items-center justify-between gap-3">
            <dt>Supabase</dt>
            <dd className="font-medium text-slate-800 dark:text-neutral-200">
              {isSupabaseConfigured ? "연결 설정됨" : "로컬 저장 전용"}
            </dd>
          </div>
          <div className="flex items-center justify-between gap-3">
            <dt>동기화</dt>
            <dd className="min-w-0 truncate font-medium text-slate-800 dark:text-neutral-200">
              {getSyncStatusLabel(syncStatus.mode)}
            </dd>
          </div>
          <div className="flex items-center justify-between gap-3">
            <dt>사용자</dt>
            <dd className="max-w-48 truncate font-mono text-slate-800 dark:text-neutral-200">
              {userId}
            </dd>
          </div>
        </dl>
        <p className="mt-2 text-[11px] leading-4 text-slate-500 dark:text-neutral-400">
          {getSyncStatusDescription(syncStatus)}
        </p>

        <button
          type="button"
          onClick={() => void onManualSync()}
          disabled={isManualSyncing}
          className="mt-4 inline-flex h-9 w-full items-center justify-center gap-2 rounded-md bg-slate-900 px-3 text-sm font-medium text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:bg-slate-400 dark:bg-neutral-100 dark:text-black dark:hover:bg-white dark:disabled:bg-neutral-800 dark:disabled:text-neutral-400"
        >
          <RefreshCw
            className={isManualSyncing ? "h-4 w-4 animate-spin" : "h-4 w-4"}
            aria-hidden="true"
          />
          <span>{isManualSyncing ? "동기화 중" : "수동 동기화"}</span>
        </button>
      </section>

      {usesManagedConfig ? (
        <section className="rounded-md border border-cyan-200 bg-cyan-50 p-3 dark:border-cyan-900 dark:bg-cyan-950/30">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-800 dark:text-neutral-100">
              <KeyRound
                className="h-4 w-4 text-cyan-700 dark:text-cyan-300"
                aria-hidden="true"
              />
              <span>앱에서 관리되는 Supabase 연결</span>
            </div>
            <span className="max-w-36 truncate text-xs font-medium text-slate-500 dark:text-neutral-400">
              {configSourceLabel}
            </span>
          </div>
          <p className="mt-2 text-xs leading-5 text-slate-600 dark:text-neutral-300">
            서버 연결은 앱 환경설정으로 관리됩니다. 각 사용자는 자신의
            이메일과 비밀번호로 사용자별 인증 계정에 로그인합니다.
          </p>
        </section>
      ) : (
        <section className="rounded-md border border-slate-200 bg-white p-3 dark:border-neutral-800 dark:bg-black">
          <form onSubmit={handleSupabaseConfigSubmit} className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-sm font-semibold text-slate-800 dark:text-neutral-100">
                <KeyRound
                  className="h-4 w-4 text-cyan-700 dark:text-cyan-300"
                  aria-hidden="true"
                />
                <span>수동 Supabase 연결</span>
              </div>
              <span className="max-w-36 truncate text-xs font-medium text-slate-500 dark:text-neutral-400">
                {configSourceLabel}
              </span>
            </div>

            <p className="text-xs leading-5 text-slate-500 dark:text-neutral-400">
              앱에서 관리되는 연결이 없을 때만 사용하는 로컬 대체 설정입니다.
            </p>

            <label className="block space-y-1.5">
              <span className="flex items-center gap-1.5 text-xs font-medium text-slate-600 dark:text-neutral-400">
                <LinkIcon className="h-3.5 w-3.5" aria-hidden="true" />
                Supabase 주소
              </span>
              <input
                type="url"
                value={supabaseUrl}
                onChange={(event) => {
                  setSupabaseUrl(event.target.value);
                  setSupabaseSaveStatus("idle");
                }}
                autoComplete="off"
                spellCheck={false}
                className="h-9 w-full rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-cyan-600 focus:ring-2 focus:ring-cyan-100 dark:border-neutral-800 dark:bg-black dark:text-neutral-100 dark:focus:border-cyan-400 dark:focus:ring-cyan-950"
              />
            </label>

            <label className="block space-y-1.5">
              <span className="flex items-center gap-1.5 text-xs font-medium text-slate-600 dark:text-neutral-400">
                <KeyRound className="h-3.5 w-3.5" aria-hidden="true" />
                공개 키
              </span>
              <input
                type="password"
                value={supabaseAnonKey}
                onChange={(event) => {
                  setSupabaseAnonKey(event.target.value);
                  setSupabaseSaveStatus("idle");
                }}
                autoComplete="off"
                spellCheck={false}
                className="h-9 w-full rounded-md border border-slate-300 bg-white px-3 font-mono text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-cyan-600 focus:ring-2 focus:ring-cyan-100 dark:border-neutral-800 dark:bg-black dark:text-neutral-100 dark:focus:border-cyan-400 dark:focus:ring-cyan-950"
              />
            </label>

            <div className="flex items-center gap-2">
              <button
                type="submit"
                disabled={supabaseSaveStatus === "saving"}
                className="inline-flex h-9 flex-1 items-center justify-center gap-2 rounded-md bg-cyan-700 px-3 text-sm font-medium text-white transition hover:bg-cyan-600 disabled:cursor-not-allowed disabled:bg-slate-400 dark:bg-cyan-500 dark:text-black dark:hover:bg-cyan-400 dark:disabled:bg-neutral-800 dark:disabled:text-neutral-400"
              >
                <Save className="h-4 w-4" aria-hidden="true" />
                <span>
                  {supabaseSaveStatus === "saving" ? "저장 중" : "수동 설정 저장"}
                </span>
              </button>
              {supabaseSaveStatus === "saved" ? (
                <span className="inline-flex h-9 items-center gap-1.5 rounded-md border border-emerald-200 px-2 text-xs font-medium text-emerald-700 dark:border-emerald-800 dark:text-emerald-300">
                  <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
                  저장됨
                </span>
              ) : null}
              {supabaseSaveStatus === "error" ? (
                <span className="inline-flex h-9 items-center rounded-md border border-red-200 px-2 text-xs font-medium text-red-700 dark:border-red-900 dark:text-red-300">
                  실패
                </span>
              ) : null}
            </div>
          </form>
        </section>
      )}

      <section className="rounded-md border border-slate-200 bg-white p-3 dark:border-neutral-800 dark:bg-black">
        {isAuthenticated ? (
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-sm font-semibold text-slate-800 dark:text-neutral-100">
                <User className="h-4 w-4" aria-hidden="true" />
                <span>{authEmail ?? userId}</span>
              </div>
              <span className="text-xs font-medium text-emerald-700 dark:text-emerald-300">
                로그인됨
              </span>
            </div>
            <button
              type="button"
              onClick={() => void onSignOut()}
              className="inline-flex h-9 w-full items-center justify-center gap-2 rounded-md border border-slate-300 px-3 text-sm font-medium dark:border-neutral-700"
            >
              <LogOut className="h-4 w-4" aria-hidden="true" />
              로그아웃
            </button>
          </div>
        ) : (
          <form onSubmit={handleSignIn} className="space-y-3">
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-800 dark:text-neutral-100">
              <User className="h-4 w-4" aria-hidden="true" />
              <span>Supabase 로그인</span>
            </div>
            <input
              type="email"
              value={authEmailInput}
              onChange={(event) => setAuthEmailInput(event.target.value)}
              placeholder="email@example.com"
              autoComplete="username"
              className="h-9 w-full rounded-md border border-slate-300 bg-white px-3 text-sm dark:border-neutral-800 dark:bg-black"
            />
            <input
              type="password"
              value={authPassword}
              onChange={(event) => setAuthPassword(event.target.value)}
              placeholder="비밀번호"
              autoComplete="current-password"
              className="h-9 w-full rounded-md border border-slate-300 bg-white px-3 text-sm dark:border-neutral-800 dark:bg-black"
            />
            <button
              type="submit"
              disabled={!isSupabaseConfigured || authStatus === "signing-in"}
              className="h-9 w-full rounded-md bg-cyan-700 px-3 text-sm font-medium text-white disabled:bg-slate-400"
            >
              {authStatus === "signing-in" ? "로그인 중" : "로그인"}
            </button>
            {authStatus === "error" ? (
              <p className="text-xs text-red-700 dark:text-red-300">
                로그인에 실패했습니다. 계정과 Supabase 설정을 확인하세요.
              </p>
            ) : null}
          </form>
        )}
      </section>
    </>
  );
}
