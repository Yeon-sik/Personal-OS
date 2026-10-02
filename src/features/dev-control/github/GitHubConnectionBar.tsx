import type { GitHubIntegrationController } from "./githubTypes";

export function GitHubConnectionBar({
  integration,
}: {
  integration: GitHubIntegrationController;
}) {
  const { status, statusCheckError, deviceFlow, busy, error } = integration;
  const accountLabel = status.accountName || status.accountLogin;
  const displayError = statusCheckError
    ? `GitHub 연결 상태 확인 실패: ${statusCheckError}`
    : status.error || error;

  return (
    <section className="grid gap-2 rounded-lg border border-slate-300 bg-slate-50 p-3 dark:border-neutral-800 dark:bg-neutral-950">
      <div className="flex items-center justify-between gap-2">
        <div>
          <p className="text-xs font-bold tracking-wide text-slate-700 dark:text-neutral-200">GitHub</p>
          <p className="text-[11px] text-slate-500 dark:text-neutral-400">
            {statusCheckError
              ? "GitHub 연결 상태 확인 실패"
              : status.connected
              ? `연결됨${accountLabel ? ` · ${accountLabel}` : ""}`
              : status.configured
                ? "연결되지 않음"
                : "클라이언트 ID 설정 필요"}
          </p>
        </div>
        {status.connected ? (
          <div className="flex gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={() => void integration.connect()}
              className="rounded border border-slate-300 px-2 py-1 text-[11px] font-semibold dark:border-neutral-700 disabled:opacity-50"
            >
              재연결
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => void integration.disconnect()}
              className="rounded border border-rose-300 px-2 py-1 text-[11px] font-semibold text-rose-700 disabled:opacity-50"
            >
              연결 해제
            </button>
          </div>
        ) : (
          <button
            type="button"
            disabled={busy || !status.configured}
            onClick={() => void integration.connect()}
            className="rounded bg-slate-900 px-2.5 py-1.5 text-[11px] font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50 dark:bg-white dark:text-black"
          >
            GitHub 연결
          </button>
        )}
      </div>

      {status.managementUrl ? (
        <div className="flex flex-wrap items-center gap-2 text-[11px]">
          <a
            href={status.managementUrl}
            target="_blank"
            rel="noreferrer"
            className="font-semibold text-teal-700 underline dark:text-teal-300"
          >
            {status.connected ? "저장소 선택/권한 관리" : "GitHub 앱 설치/저장소 권한 관리"}
          </a>
        </div>
      ) : null}

      {!status.configured && !statusCheckError ? (
        <p className="text-[11px] leading-4 text-slate-500 dark:text-neutral-400">
          설정에서 공개 GitHub 클라이언트 ID를 추가하면 기기 인증으로 연결할 수 있습니다.
        </p>
      ) : null}

      {deviceFlow ? (
        <div className="grid gap-2 rounded border border-teal-200 bg-teal-50 p-2 text-[11px] dark:border-teal-900 dark:bg-teal-950/30">
          <p className="font-semibold text-teal-900 dark:text-teal-100">GitHub 인증을 완료하세요.</p>
          <a
            href={deviceFlow.verificationUri}
            target="_blank"
            rel="noreferrer"
            className="text-teal-800 underline dark:text-teal-200"
          >
            GitHub에서 인증 열기
          </a>
          <p>
            코드: <strong className="select-all font-mono text-sm">{deviceFlow.userCode}</strong>
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={() => void integration.pollDeviceFlow()}
              className="rounded bg-teal-700 px-2 py-1 font-semibold text-white disabled:opacity-50"
            >
              연결 완료 확인
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => void integration.cancelDeviceFlow()}
              className="rounded border border-slate-300 px-2 py-1 dark:border-neutral-700"
            >
              취소
            </button>
          </div>
        </div>
      ) : null}

      {displayError ? (
        <p role="alert" className="rounded border border-amber-200 bg-amber-50 px-2 py-1.5 text-[11px] text-amber-900 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-100">
          {displayError}
        </p>
      ) : null}
    </section>
  );
}
