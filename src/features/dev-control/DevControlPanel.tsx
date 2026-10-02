import { useEffect, useState } from "react";

import type {
  Project,
  ProjectAction,
  ProjectHistory,
  ProjectIdea,
  ProjectMilestone,
  Workstream,
  WorkstreamAction,
  WorkstreamActionDependency,
  WorkstreamActionProject,
  WorkstreamMilestone,
  WorkstreamProject,
  KnowledgeDocument,
} from "../../types";
import {
  getOpenNextCount,
  getProjectChildren,
  getProjectLastUpdated,
  hasBlockedAction,
} from "./devControlService";
import {
  unavailableGitHubIntegration,
  type GitHubIntegrationController,
} from "./github/githubTypes";
import { WorkstreamPanel } from "./WorkstreamPanel";
import type { DevControlActions } from "./useDevControlActions";

export interface DevControlPanelProps {
  projects: Project[];
  projectMilestones: ProjectMilestone[];
  projectActions: ProjectAction[];
  projectIdeas: ProjectIdea[];
  projectHistory: ProjectHistory[];
  workstreams?: Workstream[];
  workstreamProjects?: WorkstreamProject[];
  workstreamMilestones?: WorkstreamMilestone[];
  workstreamActions?: WorkstreamAction[];
  workstreamActionProjects?: WorkstreamActionProject[];
  workstreamActionDependencies?: WorkstreamActionDependency[];
  knowledgeDocuments?: KnowledgeDocument[];
  selectedProjectId: string | null;
  selectedWorkstreamId?: string | null;
  onOpenProjectWorkspace: (projectId: string) => void;
  onCreateProjectWorkspace: () => void;
  onOpenWorkstream?: (workstreamId: string) => void;
  onCreateWorkstream?: () => void;
  actions?: DevControlActions;
  github?: GitHubIntegrationController;
}

const PROJECT_STATUS_LABELS: Record<Project["status"], string> = {
  ACTIVE: "진행 중",
  PLANNED: "예정",
  COMPLETED: "완료",
};

function formatTimestamp(value: string): string {
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleString();
}

function shortSha(value: string | null | undefined): string {
  return value ? value.slice(0, 7) : "-";
}

export function getDerivedProjectCardSummary(
  project: Pick<Project, "status">,
  actions: Pick<ProjectAction, "deletedAt" | "type" | "status" | "title">[],
  remoteHeadMessage?: string | null,
): string {
  const nextAction = actions.find(
    (action) =>
      action.deletedAt === null &&
      action.type === "NEXT" &&
      action.status === "OPEN" &&
      action.title.trim(),
  );
  if (nextAction) return nextAction.title.trim();

  const remoteSummary = remoteHeadMessage?.split("\n")[0]?.trim();
  return remoteSummary || PROJECT_STATUS_LABELS[project.status];
}

export function DevControlPanel({
  projects,
  projectMilestones,
  projectActions,
  projectIdeas,
  projectHistory,
  workstreams = [],
  workstreamProjects = [],
  workstreamMilestones = [],
  workstreamActions = [],
  workstreamActionProjects = [],
  workstreamActionDependencies = [],
  knowledgeDocuments = [],
  selectedProjectId,
  selectedWorkstreamId = null,
  onOpenProjectWorkspace,
  onCreateProjectWorkspace,
  onOpenWorkstream = () => undefined,
  onCreateWorkstream = () => undefined,
  actions,
  github = unavailableGitHubIntegration,
}: DevControlPanelProps) {
  const [activeSection, setActiveSection] = useState<"projects" | "workstreams">(
    "projects",
  );
  useEffect(() => {
    if (!github.status.connected) return;

    for (const project of projects) {
      if (project.githubOwner && project.githubRepo && project.branch) {
        void github.refreshProject(project);
      }
    }
  }, [github.refreshProject, github.status.connected, projects]);

  return (
    <div className="os-project-content flex h-full min-h-0 flex-col gap-3 overflow-auto pr-1">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-slate-950 dark:text-neutral-50">
            프로젝트
          </h2>
          <p className="text-[11px] text-slate-500 dark:text-neutral-400">
            프로젝트 운영 상태를 한눈에 확인하세요
          </p>
        </div>
        <div className="flex flex-wrap justify-end gap-2">
          <button
            type="button"
            onClick={() => setActiveSection("projects")}
            className={
              activeSection === "projects"
                ? "rounded bg-slate-900 px-2.5 py-1.5 text-xs font-semibold text-white dark:bg-white dark:text-black"
                : "rounded border border-slate-300 px-2.5 py-1.5 text-xs font-semibold text-slate-600 dark:border-neutral-700 dark:text-neutral-300"
            }
          >
            프로젝트
          </button>
          <button
            type="button"
            onClick={() => setActiveSection("workstreams")}
            className={
              activeSection === "workstreams"
                ? "rounded bg-teal-700 px-2.5 py-1.5 text-xs font-semibold text-white"
                : "rounded border border-slate-300 px-2.5 py-1.5 text-xs font-semibold text-slate-600 dark:border-neutral-700 dark:text-neutral-300"
            }
          >
            워크스트림
          </button>
          {activeSection === "projects" ? (
            <button
              type="button"
              onClick={onCreateProjectWorkspace}
              className="rounded bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-700 dark:bg-white dark:text-black"
            >
              새 프로젝트
            </button>
          ) : null}
        </div>
      </div>

      {activeSection === "workstreams" ? (
        actions ? (
          <WorkstreamPanel
            workstreams={workstreams}
            projects={projects}
            workstreamProjects={workstreamProjects}
            workstreamMilestones={workstreamMilestones}
            workstreamActions={workstreamActions}
            workstreamActionProjects={workstreamActionProjects}
            workstreamActionDependencies={workstreamActionDependencies}
            knowledgeDocuments={knowledgeDocuments}
            selectedWorkstreamId={selectedWorkstreamId}
            onOpenWorkstream={onOpenWorkstream}
            onCreateWorkstream={onCreateWorkstream}
            onOpenProjectWorkspace={onOpenProjectWorkspace}
            actions={actions}
          />
        ) : (
          <p className="rounded border border-dashed border-slate-300 p-4 text-xs text-slate-500 dark:border-neutral-800 dark:text-neutral-400">
            워크스트림 편집을 초기화하는 중입니다.
          </p>
        )
      ) : (
        <>
      {projects.length === 0 ? (
        <p className="rounded border border-dashed border-slate-300 p-4 text-xs text-slate-500 dark:border-neutral-800 dark:text-neutral-400">
          프로젝트가 없습니다. 새 프로젝트를 만들어 보세요.
        </p>
      ) : null}

      {(["ACTIVE", "PLANNED", "COMPLETED"] as const).map((status) => {
        const statusProjects = projects.filter((project) => project.status === status);
        if (statusProjects.length === 0) return null;

        return (
          <section key={status} className="grid gap-2">
            <h3 className="text-xs font-bold tracking-wide text-slate-500 dark:text-neutral-400">
              {PROJECT_STATUS_LABELS[status]}
            </h3>
            {statusProjects.map((project) => {
              const actions = getProjectChildren(project.id, projects, projectActions);
              const lastUpdated = getProjectLastUpdated(
                project,
                projectMilestones.filter((item) => item.projectId === project.id),
                actions,
                projectIdeas.filter((item) => item.projectId === project.id),
                projectHistory.filter((item) => item.projectId === project.id),
              );
              const readState = github.readStates[project.id];
              const model = readState?.model;
              const blocked = hasBlockedAction(actions);

              return (
                <button
                  key={project.id}
                  type="button"
                  onClick={() => onOpenProjectWorkspace(project.id)}
                  className={`grid gap-2 rounded-lg border p-3 text-left transition ${
                    selectedProjectId === project.id
                      ? "border-teal-500 bg-teal-50 dark:bg-teal-950/30"
                      : "border-slate-200 bg-white hover:border-slate-400 dark:border-neutral-800 dark:bg-neutral-950"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate text-sm font-semibold">{project.name}</span>
                    <span className="shrink-0 text-[10px] text-slate-500">
                      {PROJECT_STATUS_LABELS[project.status]}
                    </span>
                  </div>
                  <p className="line-clamp-2 text-xs text-slate-600 dark:text-neutral-300">
                    {getDerivedProjectCardSummary(project, actions, model?.remoteHead?.message)}
                  </p>
                  <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-[10px] text-slate-500 dark:text-neutral-400 sm:grid-cols-4">
                    <span>다음 작업 {getOpenNextCount(actions)}</span>
                    <span className={blocked ? "font-semibold text-rose-600" : ""}>
                      {blocked ? "차단됨" : "차단 없음"}
                    </span>
                    <span className="truncate">브랜치 {project.branch || "-"}</span>
                    <span>열린 변경 요청 {model?.openPullRequests.length ?? "-"}</span>
                    <span>최신 커밋 {shortSha(model?.remoteHead?.sha)}</span>
                    <span className="col-span-2 truncate sm:col-span-3">
                      최근 변경 {formatTimestamp(lastUpdated)}
                    </span>
                  </div>
                </button>
              );
          })}
        </section>
      );
      })}
        </>
      )}
    </div>
  );
}
