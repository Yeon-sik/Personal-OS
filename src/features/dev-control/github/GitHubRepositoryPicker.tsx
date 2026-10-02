import { useState, type KeyboardEvent } from "react";

import { parseGitHubRepositoryUrl } from "../devControlService";
import type {
  GitHubIntegrationController,
  GitHubRepositoryListDiagnostic,
  GitHubRepositoryOption,
} from "./githubTypes";

interface GitHubRepositoryPickerProps {
  integration: GitHubIntegrationController;
  repository: string;
  branch: string;
  githubRepositoryId: string | null;
  githubOwner: string | null;
  githubRepo: string | null;
  onRepositoryChange: (value: string) => void;
  onBranchChange: (value: string) => void;
  onIdentityChange: (repository: GitHubRepositoryOption) => void;
}

function formatStatuses(statuses: readonly number[]): string {
  return statuses.length > 0 ? statuses.join(", ") : "-";
}

function formatDiagnostic(diagnostic: GitHubRepositoryListDiagnostic): string {
  const repositoryRequests = diagnostic.installationRepositories.length > 0
    ? diagnostic.installationRepositories
      .map((installation) => `${formatStatuses(installation.statuses)} (${installation.repositoryCount})`)
      .join(", ")
    : "-";
  return `/user ${diagnostic.userStatus ?? "-"} (${diagnostic.userCount}) · /user/installations ${formatStatuses(diagnostic.installationStatuses)} (${diagnostic.installationCount}) · 설치별 저장소 ${repositoryRequests}`;
}

export function GitHubRepositoryPicker({
  integration,
  repository,
  branch,
  githubRepositoryId,
  githubOwner,
  githubRepo,
  onRepositoryChange,
  onBranchChange,
  onIdentityChange,
}: GitHubRepositoryPickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const repositoryLoadState = integration.repositoryLoadState;
  const repositoryDiagnostic = repositoryLoadState.diagnostic;
  const legacyRepository = !githubRepositoryId
    ? parseGitHubRepositoryUrl(repository)
    : null;

  function openPicker(nextSearch = "") {
    setSearch(nextSearch);
    setIsOpen(true);
    void integration.loadRepositories(nextSearch);
  }

  function loadSearchResults() {
    void integration.loadRepositories(search);
  }

  function handleSearchKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key !== "Enter") return;
    event.preventDefault();
    loadSearchResults();
  }

  function selectRepository(option: GitHubRepositoryOption) {
    onIdentityChange(option);
    setIsOpen(false);
    void integration.loadBranches(option.owner, option.name);
  }

  return (
    <div className="grid gap-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-[11px] font-medium text-slate-600 dark:text-neutral-300">
          {githubOwner && githubRepo
            ? `선택된 저장소: ${githubOwner}/${githubRepo}`
            : legacyRepository
              ? `주소로 연결된 저장소: ${legacyRepository.owner}/${legacyRepository.repo}`
              : "저장소를 선택하세요."}
        </span>
        {integration.status.connected ? (
          <button
            type="button"
            onClick={() =>
              openPicker(
                legacyRepository
                  ? `${legacyRepository.owner}/${legacyRepository.repo}`
                  : "",
              )
            }
            className="rounded border border-teal-300 px-2 py-1 text-[11px] font-semibold text-teal-800 dark:border-teal-800 dark:text-teal-200"
          >
            {legacyRepository ? "GitHub 연결 업그레이드" : "저장소 선택/권한 관리"}
          </button>
        ) : null}
      </div>

      <div className="grid grid-cols-2 gap-2">
        <label className="grid gap-1 text-[11px] font-medium text-slate-600 dark:text-neutral-300">
          <span>저장소 주소 (호환)</span>
          <input
            className="w-full rounded border border-slate-300 bg-white px-2 py-1.5 text-xs dark:border-neutral-700 dark:bg-neutral-950"
            value={repository}
            placeholder="https://github.com/owner/repository"
            onChange={(event) => onRepositoryChange(event.target.value)}
          />
        </label>
        <label className="grid gap-1 text-[11px] font-medium text-slate-600 dark:text-neutral-300">
          <span>추적 브랜치</span>
          {githubOwner && githubRepo && integration.branches.length > 0 ? (
            <select
              className="w-full rounded border border-slate-300 bg-white px-2 py-1.5 text-xs dark:border-neutral-700 dark:bg-neutral-950"
              value={branch}
              onChange={(event) => onBranchChange(event.target.value)}
            >
              {!integration.branches.some((option) => option.name === branch) ? (
                <option value={branch}>{branch}</option>
              ) : null}
              {integration.branches.map((option) => (
                <option key={option.name} value={option.name}>
                  {option.name}{option.protected ? " · 보호됨" : ""}
                </option>
              ))}
            </select>
          ) : (
            <input
              className="w-full rounded border border-slate-300 bg-white px-2 py-1.5 text-xs dark:border-neutral-700 dark:bg-neutral-950"
              value={branch}
              placeholder="main"
              onChange={(event) => onBranchChange(event.target.value)}
            />
          )}
        </label>
      </div>

      {isOpen ? (
        <div className="grid gap-2 rounded border border-slate-200 bg-white p-2 dark:border-neutral-800 dark:bg-neutral-950">
          <div className="flex gap-2">
            <input
              autoFocus
              className="min-w-0 flex-1 rounded border border-slate-300 bg-white px-2 py-1.5 text-xs dark:border-neutral-700 dark:bg-neutral-900"
              value={search}
              placeholder="소유자/저장소 검색"
              onChange={(event) => setSearch(event.target.value)}
              onKeyDown={handleSearchKeyDown}
            />
            <button type="button" onClick={loadSearchResults} className="rounded bg-slate-800 px-2 py-1 text-[11px] text-white">
              검색
            </button>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="rounded border border-slate-300 px-2 py-1 text-[11px] dark:border-neutral-700"
            >
              닫기
            </button>
          </div>
          <div className="grid max-h-48 gap-1 overflow-auto">
            {repositoryLoadState.loading ? (
              <p aria-live="polite" className="p-2 text-[11px] text-slate-500">저장소를 불러오는 중...</p>
            ) : repositoryLoadState.error || repositoryDiagnostic?.state === "api-error" ? (
              <p role="alert" className="p-2 text-[11px] text-rose-700 dark:text-rose-300">
                GitHub API 오류: {repositoryLoadState.error ?? repositoryDiagnostic?.error?.message ?? "저장소 목록을 불러오지 못했습니다."}
              </p>
            ) : repositoryDiagnostic?.state === "no-installations" ? (
              <p className="p-2 text-[11px] text-slate-500">설치된 GitHub 앱이 없습니다. 앱을 설치하고 저장소 접근 권한을 부여하세요.</p>
            ) : repositoryDiagnostic?.state === "no-repositories" ? (
              <p className="p-2 text-[11px] text-slate-500">GitHub 앱이 설치되어 있지만 현재 사용자에게 허용된 저장소가 없습니다.</p>
            ) : repositoryDiagnostic?.state === "no-search-results" ? (
              <p className="p-2 text-[11px] text-slate-500">접근 가능한 저장소는 있지만 현재 검색어와 일치하는 결과가 없습니다.</p>
            ) : integration.repositories.length === 0 ? (
              <p className="p-2 text-[11px] text-slate-500">저장소 검색을 시작하세요.</p>
            ) : (
              integration.repositories.map((option) => (
                <button
                  key={option.id}
                  aria-label={`GitHub 저장소 ${option.fullName}`}
                  type="button"
                  onClick={() => selectRepository(option)}
                  className={`grid gap-0.5 rounded border p-2 text-left text-[11px] hover:border-teal-500 ${githubRepositoryId === option.id ? "border-teal-500 bg-teal-50 dark:bg-teal-950/30" : "border-slate-200 dark:border-neutral-800"}`}
                >
                  <span className="font-semibold">{option.fullName}</span>
                  <span className="text-slate-500">
                    기본 브랜치: {option.defaultBranch}{option.private ? " · 비공개" : ""}
                  </span>
                </button>
              ))
            )}
          </div>
          {repositoryDiagnostic ? (
            <p className="text-[10px] text-slate-500 dark:text-neutral-400">
              API 진단: {formatDiagnostic(repositoryDiagnostic)}
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
