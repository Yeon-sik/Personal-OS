import type { Project } from "../../../types";
import { getRemoteVerificationState, type GitHubProjectReadState } from "./githubTypes";

function formatTimestamp(value: string | null | undefined): string {
  if (!value) return "-";
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleString();
}

const verificationLabels = {
  "verified-latest": "검증 최신",
  "changed-since-verification": "검증 이후 변경 있음",
  "no-verification": "검증 정보 없음",
  "remote-error": "원격 조회 실패",
} as const;

export function GitHubRepositoryObservation({
  project,
  readState,
  onRefresh,
  onLoadMore,
}: {
  project: Project;
  readState?: GitHubProjectReadState;
  onRefresh: () => void;
  onLoadMore: () => void;
}) {
  if (!project.githubOwner || !project.githubRepo) return null;

  const model = readState?.model ?? null;
  const commitHistory = readState?.commitHistory ?? {
    commits: [],
    page: 0,
    perPage: 100,
    hasNextPage: false,
    loading: false,
    error: null,
  };
  const verificationState = getRemoteVerificationState(
    model?.remoteHead?.sha,
    project.lastVerifiedCommit,
    readState?.error,
  );

  return (
    <section className="grid gap-2 rounded-lg border border-slate-200 bg-white p-3 dark:border-neutral-800 dark:bg-neutral-950">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-xs font-bold tracking-wide text-slate-700 dark:text-neutral-200">GitHub 저장소 상태</h3>
        <button
          type="button"
          disabled={readState?.loading}
          onClick={onRefresh}
          className="rounded border border-slate-300 px-2 py-1 text-[11px] font-semibold disabled:opacity-50 dark:border-neutral-700"
        >
          새로고침
        </button>
      </div>

      <div className="grid gap-1 text-[11px] text-slate-600 dark:text-neutral-300">
        <p>
          저장소: <strong>{project.githubOwner}/{project.githubRepo}</strong>
        </p>
        <p>추적 브랜치: <strong>{project.branch}</strong></p>
        <p>
          상태: <strong>{readState?.loading ? "조회 중" : verificationLabels[verificationState]}</strong>
        </p>
      </div>

      {readState?.error ? (
        <p role="alert" className="rounded border border-amber-200 bg-amber-50 px-2 py-1.5 text-[11px] text-amber-900 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-100">
          {readState.error}
        </p>
      ) : null}

      {model ? (
        <>
          <div className="grid gap-1 rounded border border-slate-200 p-2 text-[11px] dark:border-neutral-800">
            <p className="font-semibold">원격 최신 커밋</p>
            {model.remoteHead ? (
              <>
                <a href={model.remoteHead.htmlUrl} target="_blank" rel="noreferrer" className="break-all font-mono text-teal-700 underline dark:text-teal-300">
                  {model.remoteHead.sha}
                </a>
                <p className="line-clamp-2">{model.remoteHead.message}</p>
                <p className="text-slate-500">{formatTimestamp(model.remoteHead.committedAt)}</p>
              </>
            ) : (
              <p className="text-slate-500">커밋이 없는 브랜치입니다.</p>
            )}
          </div>

          <div className="grid gap-1">
            <p className="text-[11px] font-semibold text-slate-700 dark:text-neutral-200">커밋 이력</p>
            {commitHistory.error ? (
              <p role="alert" className="rounded border border-amber-200 bg-amber-50 px-2 py-1.5 text-[11px] text-amber-900 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-100">
                {commitHistory.error}
              </p>
            ) : null}
            {commitHistory.commits.length === 0 ? (
              <p className="text-[11px] text-slate-500">{commitHistory.loading ? "커밋 이력을 불러오는 중입니다." : "커밋 이력이 없습니다."}</p>
            ) : (
              commitHistory.commits.map((commit) => (
                <a key={commit.sha} href={commit.htmlUrl} target="_blank" rel="noreferrer" className="grid gap-0.5 rounded border border-slate-200 p-2 text-[11px] hover:border-teal-400 dark:border-neutral-800">
                  <span className="break-all font-mono text-teal-700 dark:text-teal-300">{commit.sha}</span>
                  <span className="line-clamp-1">{commit.message.split("\n")[0]}</span>
                  <span className="text-slate-500">{formatTimestamp(commit.committedAt)}{commit.author ? ` · ${commit.author}` : ""}</span>
                </a>
              ))
            )}
            {commitHistory.hasNextPage ? (
              <button
                type="button"
                disabled={commitHistory.loading}
                onClick={onLoadMore}
                className="justify-self-start rounded border border-slate-300 px-2 py-1 text-[11px] font-semibold disabled:opacity-50 dark:border-neutral-700"
              >
                {commitHistory.loading ? "불러오는 중" : "더 보기"}
              </button>
            ) : null}
          </div>

          <div className="grid gap-1">
            <p className="text-[11px] font-semibold text-slate-700 dark:text-neutral-200">열린 변경 요청</p>
            {model.openPullRequests.length === 0 ? (
              <p className="text-[11px] text-slate-500">열린 변경 요청이 없습니다.</p>
            ) : (
              model.openPullRequests.map((pullRequest) => (
                <a key={pullRequest.number} href={pullRequest.htmlUrl} target="_blank" rel="noreferrer" className="rounded border border-slate-200 p-2 text-[11px] hover:border-teal-400 dark:border-neutral-800">
                  <span className="font-semibold">#{pullRequest.number} {pullRequest.title}</span>
                  <span className="block text-slate-500">{pullRequest.headBranch ?? "?"} → {pullRequest.baseBranch ?? "?"}{pullRequest.draft ? " · 초안" : ""}</span>
                </a>
              ))
            )}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 text-[10px] text-slate-500">
            <span>마지막 조회: {formatTimestamp(model.queriedAt)}</span>
            <a href={model.repository.htmlUrl} target="_blank" rel="noreferrer" className="font-semibold text-teal-700 underline dark:text-teal-300">GitHub에서 열기</a>
          </div>
        </>
      ) : (
        <p className="text-[11px] text-slate-500">{readState?.loading ? "GitHub에서 읽는 중입니다." : "새로고침을 눌러 원격 상태를 조회하세요."}</p>
      )}
    </section>
  );
}
