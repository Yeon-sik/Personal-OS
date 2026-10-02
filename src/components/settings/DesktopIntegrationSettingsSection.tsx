import { useEffect, useState, type FormEvent } from "react";
import {
  CheckCircle2,
  Keyboard,
  Power,
  RefreshCw,
  Save,
} from "lucide-react";
import type { DesktopQuickCaptureShortcutStatus } from "../../lib/desktop/quickCapture";

interface DesktopIntegrationSettingsSectionProps {
  autostartEnabled: boolean;
  autostartSupported: boolean;
  quickCaptureShortcutPreference: string;
  quickCaptureShortcutStatus: DesktopQuickCaptureShortcutStatus;
  onRefreshQuickCaptureShortcutStatus: () => Promise<void>;
  onSaveQuickCaptureShortcutPreference: (shortcut: string) => void;
  onToggleAutostart: (enabled: boolean) => Promise<void>;
}

export function DesktopIntegrationSettingsSection({
  autostartEnabled,
  autostartSupported,
  quickCaptureShortcutPreference,
  quickCaptureShortcutStatus,
  onRefreshQuickCaptureShortcutStatus,
  onSaveQuickCaptureShortcutPreference,
  onToggleAutostart,
}: DesktopIntegrationSettingsSectionProps) {
  const [quickCaptureShortcutDraft, setQuickCaptureShortcutDraft] = useState(
    quickCaptureShortcutPreference,
  );
  const [quickCaptureShortcutSaveStatus, setQuickCaptureShortcutSaveStatus] =
    useState<"idle" | "saved">("idle");

  useEffect(() => {
    setQuickCaptureShortcutDraft(quickCaptureShortcutPreference);
  }, [quickCaptureShortcutPreference]);

  function handleQuickCaptureShortcutSubmit(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();
    onSaveQuickCaptureShortcutPreference(quickCaptureShortcutDraft);
    setQuickCaptureShortcutSaveStatus("saved");
  }

  const quickCaptureStatusLabel = !quickCaptureShortcutStatus.supported
    ? "앱 내 단축키"
    : quickCaptureShortcutStatus.registered
      ? "등록됨"
      : "사용 불가";

  return (
    <>
      <section className="rounded-md border border-slate-200 bg-white p-3 dark:border-neutral-800 dark:bg-black">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-sm font-semibold text-slate-800 dark:text-neutral-100">
            <Power
              className="h-4 w-4 text-teal-700 dark:text-teal-300"
              aria-hidden="true"
            />
            <span>자동 실행</span>
          </div>
          <label className="relative inline-flex cursor-pointer items-center">
            <input
              type="checkbox"
              checked={autostartEnabled}
              disabled={!autostartSupported}
              onChange={(event) => void onToggleAutostart(event.target.checked)}
              className="peer sr-only"
            />
            <span className="h-6 w-11 rounded-full bg-slate-300 transition peer-checked:bg-teal-700 peer-disabled:bg-slate-200 dark:bg-neutral-800 dark:peer-checked:bg-teal-500 dark:peer-disabled:bg-neutral-900" />
            <span className="absolute left-1 h-4 w-4 rounded-full bg-white transition peer-checked:translate-x-5" />
          </label>
        </div>
        <p className="mt-2 text-xs text-slate-500 dark:text-neutral-400">
          {autostartSupported
            ? autostartEnabled
              ? "Windows 시작 시 자동 실행됩니다."
              : "Windows 시작 시 자동 실행하지 않습니다."
            : "현재 실행 환경에서는 자동 실행 설정을 사용할 수 없습니다."}
        </p>
      </section>

      <section className="rounded-md border border-slate-200 bg-white p-3 dark:border-neutral-800 dark:bg-black">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-sm font-semibold text-slate-800 dark:text-neutral-100">
            <Keyboard
              className="h-4 w-4 text-violet-700 dark:text-violet-300"
              aria-hidden="true"
            />
            <span>빠른 기록</span>
          </div>
          <span
            className={
              quickCaptureShortcutStatus.registered
                ? "rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"
                : "rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600 dark:bg-neutral-900 dark:text-neutral-300"
            }
          >
            {quickCaptureStatusLabel}
          </span>
        </div>

        <dl className="mt-3 space-y-2 text-xs text-slate-600 dark:text-neutral-400">
          <div className="flex items-center justify-between gap-3">
            <dt>현재 등록</dt>
            <dd className="font-medium text-slate-800 dark:text-neutral-200">
              {quickCaptureShortcutStatus.shortcut}
            </dd>
          </div>
          {quickCaptureShortcutStatus.error ? (
            <div className="flex items-start justify-between gap-3">
              <dt>상태</dt>
              <dd className="min-w-0 text-right text-red-700 dark:text-red-300">
                {quickCaptureShortcutStatus.error}
              </dd>
            </div>
          ) : null}
        </dl>

        <form
          onSubmit={handleQuickCaptureShortcutSubmit}
          className="mt-3 space-y-2"
        >
          <label className="block space-y-1.5">
            <span className="text-xs font-medium text-slate-600 dark:text-neutral-400">
              대체 단축키
            </span>
            <input
              type="text"
              value={quickCaptureShortcutDraft}
              onChange={(event) => {
                setQuickCaptureShortcutDraft(event.target.value);
                setQuickCaptureShortcutSaveStatus("idle");
              }}
              className="h-9 w-full rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-violet-600 focus:ring-2 focus:ring-violet-100 dark:border-neutral-800 dark:bg-black dark:text-neutral-100 dark:focus:border-violet-400 dark:focus:ring-violet-950"
              placeholder="Ctrl+Alt+Space"
            />
          </label>

          <div className="flex items-center gap-2">
            <button
              type="submit"
              className="inline-flex h-9 flex-1 items-center justify-center gap-2 rounded-md bg-violet-700 px-3 text-sm font-medium text-white transition hover:bg-violet-600 dark:bg-violet-500 dark:text-black dark:hover:bg-violet-400"
            >
              <Save className="h-4 w-4" aria-hidden="true" />
              <span>저장</span>
            </button>
            <button
              type="button"
              onClick={() => void onRefreshQuickCaptureShortcutStatus()}
              className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-slate-300 text-slate-600 transition hover:bg-slate-50 hover:text-slate-900 dark:border-neutral-800 dark:text-neutral-300 dark:hover:bg-neutral-900 dark:hover:text-neutral-100"
              aria-label="빠른 기록 단축키 상태 새로고침"
              title="새로고침"
            >
              <RefreshCw className="h-4 w-4" aria-hidden="true" />
            </button>
            {quickCaptureShortcutSaveStatus === "saved" ? (
              <span className="inline-flex h-9 items-center gap-1.5 rounded-md border border-emerald-200 px-2 text-xs font-medium text-emerald-700 dark:border-emerald-800 dark:text-emerald-300">
                <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
                저장됨
              </span>
            ) : null}
          </div>
        </form>
      </section>
    </>
  );
}
