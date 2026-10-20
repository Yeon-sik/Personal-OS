import { Bell } from "lucide-react";
import type { DeadlineNotificationsRuntime } from "../../features/deadline-notifications/useDeadlineNotifications";

export function DeadlineNotificationSettingsSection({ notifications: runtime }: { notifications: DeadlineNotificationsRuntime }) {
  const unsupported = runtime.status.permission === "unsupported";
  const permission = unsupported ? "Android 앱에서 사용할 수 있습니다." : runtime.status.permission === "granted"
    ? runtime.status.exactGranted ? "알림·정확한 예약 권한 허용됨" : "정확한 알림 권한 필요"
    : runtime.status.permission === "denied" ? "알림 권한 없음" : "알림 권한 확인 중";
  return (
    <section className="rounded-md border border-slate-200 bg-white p-3 dark:border-neutral-800 dark:bg-black" aria-labelledby="deadline-notification-title">
      <div className="flex items-center justify-between gap-3">
        <h2 id="deadline-notification-title" className="flex items-center gap-2 text-sm font-semibold text-slate-800 dark:text-neutral-100">
          <Bell className="h-4 w-4" aria-hidden="true" />마감 알림
        </h2>
        <label className="inline-flex min-h-11 items-center gap-2 text-sm text-slate-700 dark:text-neutral-200">
          <input type="checkbox" aria-label="마감 알림 사용" checked={runtime.enabled}
            disabled={runtime.blocked || runtime.busy || unsupported || runtime.status.permission === "unknown"}
            onChange={event => void runtime.setEnabled(event.target.checked)} className="h-5 w-5 accent-blue-600" />사용
        </label>
      </div>
      <p className="mt-2 text-xs leading-relaxed text-slate-600 dark:text-neutral-300">마감·시작일 3일 전부터 당일까지 하루 한 번 알립니다. 각 일정의 시간대를 기준으로 합니다.</p>
      <label className="mt-3 flex flex-wrap items-center justify-between gap-2 text-sm text-slate-700 dark:text-neutral-200">
        알림 시각
        <input type="time" aria-label="마감 알림 시각" value={runtime.settings.time || ""} disabled={runtime.blocked || unsupported || runtime.busy}
          onChange={event => runtime.setTime(event.target.value)}
          className="min-h-11 rounded-md border border-slate-300 bg-white px-3 text-base text-slate-900 disabled:opacity-60 dark:border-neutral-600 dark:bg-neutral-950 dark:text-neutral-100" />
      </label>
      <p className="mt-2 text-xs text-slate-600 dark:text-neutral-300" role="status">{permission}{runtime.enabled ? ` · 미래 예약 ${runtime.status.count}개` : ""}</p>
      {!unsupported && runtime.status.permission === "granted" && !runtime.status.exactGranted ? (
        <button type="button" onClick={() => void runtime.openExactSettings()} className="mt-2 min-h-11 rounded-md border border-slate-300 px-3 text-sm text-slate-800 dark:border-neutral-600 dark:text-neutral-100">Android 정확한 알림 설정</button>
      ) : null}
      {runtime.error ? <p className="mt-2 whitespace-pre-line text-xs text-red-700 dark:text-red-300" role="alert">{runtime.error}</p> : null}
    </section>
  );
}
