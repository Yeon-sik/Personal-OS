import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";

import type {
  DevActionStatus,
  DevActionType,
  DevHistoryType,
  DevMilestoneStatus,
  DevProjectStatus,
  KnowledgeDocument,
  KnowledgeDocumentType,
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
} from "../../../types";
import {
  DEFAULT_PROJECT_BRANCH,
  getProjectChildren,
  getProjectRepositoryMode,
  normalizeProjectGitHubFields,
  normalizeProjectRepositoryFields,
} from "../devControlService";
import type { DevControlActions } from "../useDevControlActions";
import { ACTION_STATUS_LABELS, ACTION_TYPE_LABELS, HISTORY_TYPE_LABELS, KNOWLEDGE_DOCUMENT_TYPE_LABELS, MILESTONE_STATUS_LABELS } from "../devControlLabels";
import {
  getKnowledgeWorkstreamCandidates,
  getProjectNamesById,
} from "../../knowledge-vault/knowledgeDocumentCreation";
import { buildKnowledgeDocumentRelativePath } from "../../knowledge-vault/knowledgeVaultService";
import { GitHubConnectionBar } from "../github/GitHubConnectionBar";
import { GitHubRepositoryObservation } from "../github/GitHubRepositoryObservation";
import { GitHubRepositoryPicker } from "../github/GitHubRepositoryPicker";
import {
  unavailableGitHubIntegration,
  type GitHubIntegrationController,
  type GitHubRepositoryOption,
} from "../github/githubTypes";
import type { ProjectWorkspaceMode } from "./projectWorkspaceBridge";

type WorkspaceTab = "overview" | "github" | "plan" | "history";

const KNOWLEDGE_DOCUMENT_TYPES: KnowledgeDocumentType[] = ["IDEA", "PLAN", "DESIGN", "RESEARCH", "NOTE"];

const PROJECT_STATUSES: DevProjectStatus[] = ["ACTIVE", "PLANNED", "COMPLETED"];
const MILESTONE_STATUSES: DevMilestoneStatus[] = ["PLANNED", "IN_PROGRESS", "COMPLETED"];
const ACTION_TYPES: DevActionType[] = ["NEXT", "LATER", "BLOCKED"];
const ACTION_STATUSES: DevActionStatus[] = ["OPEN", "DONE"];
const HISTORY_TYPES: DevHistoryType[] = ["STATUS_CHANGE", "MILESTONE", "RELEASE", "NOTE"];
const WORKSTREAM_STATUS_LABELS: Record<Workstream["status"], string> = {
  ACTIVE: "진행 중",
  PLANNED: "예정",
  COMPLETED: "완료",
};

const statusLabels: Record<DevProjectStatus, string> = {
  ACTIVE: "진행 중",
  PLANNED: "예정",
  COMPLETED: "완료",
};

function formatTimestamp(value: string): string {
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleString();
}

function toDateTimeLocal(value: string | null): string {
  if (!value) return "";
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? "" : parsed.toISOString().slice(0, 16);
}

function toIsoOrNull(value: string): string | null {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  multiline = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  multiline?: boolean;
}) {
  const className = "w-full rounded border border-slate-300 bg-white px-2 py-1.5 text-xs outline-none focus:border-teal-500 dark:border-neutral-700 dark:bg-neutral-950";
  return (
    <label className="grid gap-1 text-[11px] font-medium text-slate-600 dark:text-neutral-300">
      <span>{label}</span>
      {multiline ? (
        <textarea className={`${className} min-h-16 resize-y`} value={value} placeholder={placeholder} onChange={(event) => onChange(event.target.value)} />
      ) : (
        <input className={className} value={value} placeholder={placeholder} onChange={(event) => onChange(event.target.value)} />
      )}
    </label>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-3 dark:border-neutral-800 dark:bg-neutral-950">
      <h3 className="mb-2 text-xs font-bold tracking-wide text-slate-700 dark:text-neutral-200">{title}</h3>
      {children}
    </section>
  );
}

export interface ProjectWorkspaceProps {
  mode: ProjectWorkspaceMode;
  project: Project | null;
  projects: Project[];
  projectMilestones: ProjectMilestone[];
  projectActions: ProjectAction[];
  projectIdeas: ProjectIdea[];
  projectHistory: ProjectHistory[];
  workstreams: Workstream[];
  workstreamProjects: WorkstreamProject[];
  workstreamMilestones: WorkstreamMilestone[];
  workstreamActions: WorkstreamAction[];
  workstreamActionProjects: WorkstreamActionProject[];
  workstreamActionDependencies: WorkstreamActionDependency[];
  knowledgeDocuments: KnowledgeDocument[];
  actions: DevControlActions;
  github?: GitHubIntegrationController;
}

export function ProjectWorkspace({
  mode,
  project,
  projects,
  projectMilestones,
  projectActions,
  projectIdeas,
  projectHistory,
  workstreams,
  workstreamProjects,
  workstreamActions,
  knowledgeDocuments,
  actions,
  github = unavailableGitHubIntegration,
}: ProjectWorkspaceProps) {
  const [activeTab, setActiveTab] = useState<WorkspaceTab>("overview");
  const [repositoryMode, setRepositoryMode] = useState<"github" | "text">("github");
  const [projectFormError, setProjectFormError] = useState<string | null>(null);
  const [projectDraft, setProjectDraft] = useState({
    name: "",
    repository: "",
    branch: DEFAULT_PROJECT_BRANCH,
    githubRepositoryId: null as string | null,
    githubOwner: null as string | null,
    githubRepo: null as string | null,
    status: "PLANNED" as DevProjectStatus,
    description: "",
    currentSummary: "",
    targetSummary: "",
    lastVerifiedCommit: "",
    lastVerifiedAt: "",
  });
  const [milestoneTitle, setMilestoneTitle] = useState("");
  const [actionTitle, setActionTitle] = useState("");
  const [actionType, setActionType] = useState<DevActionType>("NEXT");
  const [ideaTitle, setIdeaTitle] = useState("");
  const [historyDraft, setHistoryDraft] = useState({
    summary: "",
    type: "NOTE" as DevHistoryType,
    occurredAt: "",
    githubRef: "",
  });
  const [knowledgeTitle, setKnowledgeTitle] = useState("");
  const [knowledgeType, setKnowledgeType] = useState<KnowledgeDocumentType>("PLAN");
  const [knowledgeError, setKnowledgeError] = useState<string | null>(null);
  const [knowledgeComposerOpen, setKnowledgeComposerOpen] = useState(false);
  const [knowledgeProjectIds, setKnowledgeProjectIds] = useState<string[]>([]);
  const [knowledgeWorkstreamId, setKnowledgeWorkstreamId] = useState<string | null>(null);
  const [knowledgeOwnerMode, setKnowledgeOwnerMode] = useState<"existing" | "new">("existing");
  const [knowledgeAddProjectIds, setKnowledgeAddProjectIds] = useState<string[]>([]);
  const [knowledgeNewWorkstreamName, setKnowledgeNewWorkstreamName] = useState("");
  const [knowledgeSubmitting, setKnowledgeSubmitting] = useState(false);

  useEffect(() => {
    setActiveTab("overview");
    setProjectFormError(null);
    if (mode === "create" || !project) {
      setRepositoryMode("github");
      setProjectDraft({
        name: "",
        repository: "",
        branch: DEFAULT_PROJECT_BRANCH,
        githubRepositoryId: null,
        githubOwner: null,
        githubRepo: null,
        status: "PLANNED",
        description: "",
        currentSummary: "",
        targetSummary: "",
        lastVerifiedCommit: "",
        lastVerifiedAt: "",
      });
      return;
    }

    const nextRepositoryMode = getProjectRepositoryMode(project);
    setRepositoryMode(nextRepositoryMode);
    setProjectDraft({
      name: project.name,
      repository: project.repository ?? "",
      branch: project.branch ?? (nextRepositoryMode === "github" ? DEFAULT_PROJECT_BRANCH : ""),
      githubRepositoryId: project.githubRepositoryId,
      githubOwner: project.githubOwner,
      githubRepo: project.githubRepo,
      status: project.status,
      description: project.description,
      currentSummary: project.currentSummary,
      targetSummary: project.targetSummary,
      lastVerifiedCommit: project.lastVerifiedCommit ?? "",
      lastVerifiedAt: toDateTimeLocal(project.lastVerifiedAt),
    });
  }, [mode, project?.id]);

  useEffect(() => {
    setKnowledgeProjectIds(project ? [project.id] : []);
    setKnowledgeTitle("");
    setKnowledgeType("PLAN");
    setKnowledgeWorkstreamId(null);
    setKnowledgeOwnerMode("existing");
    setKnowledgeAddProjectIds([]);
    setKnowledgeNewWorkstreamName("");
    setKnowledgeComposerOpen(false);
    setKnowledgeError(null);
  }, [project?.id]);

  const selectedMilestones = useMemo(
    () => (project ? getProjectChildren(project.id, projects, projectMilestones) : []),
    [project, projectMilestones, projects],
  );
  const selectedActions = useMemo(
    () => (project ? getProjectChildren(project.id, projects, projectActions) : []),
    [project, projectActions, projects],
  );
  const selectedIdeas = useMemo(
    () => (project ? getProjectChildren(project.id, projects, projectIdeas) : []),
    [project, projectIdeas, projects],
  );
  const selectedHistory = useMemo(
    () => (project ? getProjectChildren(project.id, projects, projectHistory).sort((a, b) => b.occurredAt.localeCompare(a.occurredAt)) : []),
    [project, projectHistory, projects],
  );
  const selectedWorkstreams = useMemo(
    () =>
      project
        ? workstreams.filter(
            (workstream) =>
              workstream.deletedAt === null &&
              workstreamProjects.some(
                (link) =>
                  link.deletedAt === null &&
                  link.workstreamId === workstream.id &&
                  link.projectId === project.id,
              ),
          )
        : [],
    [project, workstreamProjects, workstreams],
  );
  const selectedKnowledgeDocuments = useMemo(() => {
    if (!project) return [];
    const workstreamIds = new Set(selectedWorkstreams.map((item) => item.id));
    return knowledgeDocuments
      .filter(
        (document) =>
          document.deletedAt === null &&
          (document.projectId === project.id ||
            (document.workstreamId !== null && workstreamIds.has(document.workstreamId))),
      )
      .sort((first, second) => first.title.localeCompare(second.title));
  }, [knowledgeDocuments, project, selectedWorkstreams]);
  const knowledgeCandidates = useMemo(
    () => getKnowledgeWorkstreamCandidates(workstreams, workstreamProjects, knowledgeProjectIds),
    [knowledgeProjectIds, workstreamProjects, workstreams],
  );
  const selectedKnowledgeCandidate = useMemo(
    () => knowledgeCandidates.find((candidate) => candidate.workstream.id === knowledgeWorkstreamId) ?? null,
    [knowledgeCandidates, knowledgeWorkstreamId],
  );
  const knowledgePreviewPath = useMemo(() => {
    const title = knowledgeTitle.trim() || "Untitled";
    if (knowledgeProjectIds.length === 1) {
      const selected = projects.find((item) => item.id === knowledgeProjectIds[0]);
      return buildKnowledgeDocumentRelativePath({
        title,
        type: knowledgeType,
        projectId: knowledgeProjectIds[0],
        projectName: selected?.name,
      });
    }
    const workstreamName = knowledgeOwnerMode === "new"
      ? knowledgeNewWorkstreamName.trim() || title
      : selectedKnowledgeCandidate?.workstream.name;
    return buildKnowledgeDocumentRelativePath({
      title,
      type: knowledgeType,
      workstreamId: knowledgeWorkstreamId ?? "new-workstream",
      workstreamName,
    });
  }, [knowledgeNewWorkstreamName, knowledgeOwnerMode, knowledgeProjectIds, knowledgeTitle, knowledgeType, knowledgeWorkstreamId, projects, selectedKnowledgeCandidate]);
  const readState = project ? github.readStates[project.id] : undefined;

  function handleRepositoryModeChange(nextMode: "github" | "text") {
    setRepositoryMode(nextMode);
    setProjectFormError(null);
    if (nextMode === "github") {
      setProjectDraft((draft) => ({ ...draft, branch: draft.branch.trim() || DEFAULT_PROJECT_BRANCH }));
    } else {
      setProjectDraft((draft) => ({ ...draft, githubRepositoryId: null, githubOwner: null, githubRepo: null }));
    }
  }

  function handleRepositorySelection(option: GitHubRepositoryOption) {
    setProjectDraft((draft) => ({
      ...draft,
      repository: option.htmlUrl,
      branch: option.defaultBranch,
      githubRepositoryId: option.id,
      githubOwner: option.owner,
      githubRepo: option.name,
      name: draft.name.trim() ? draft.name : option.name,
    }));
  }

  function submitProject(event: FormEvent) {
    event.preventDefault();
    if (!projectDraft.name.trim()) {
      setProjectFormError("프로젝트 이름을 입력하세요.");
      return;
    }

    const repositoryFields = normalizeProjectRepositoryFields(
      repositoryMode,
      projectDraft.repository,
      projectDraft.branch,
      projectDraft.lastVerifiedCommit,
      toIsoOrNull(projectDraft.lastVerifiedAt),
      readState?.model ? [readState.model.remoteHead?.sha, ...readState.model.recentCommits.map((commit) => commit.sha)] : [],
    );
    if (repositoryFields.error) {
      setProjectFormError(repositoryFields.error);
      return;
    }

    const { error: _error, ...normalizedRepositoryFields } = repositoryFields;
    setProjectFormError(null);
    const input = {
      name: projectDraft.name,
      ...normalizedRepositoryFields,
      ...normalizeProjectGitHubFields(repositoryMode, projectDraft.githubRepositoryId, projectDraft.githubOwner, projectDraft.githubRepo),
      status: projectDraft.status,
      description: projectDraft.description,
      currentSummary: projectDraft.currentSummary,
      targetSummary: projectDraft.targetSummary,
    };
    if (mode === "create" || !project) {
      actions.addProject({
        ...input,
        backfillInput: undefined,
      });
    } else {
      actions.updateProject(project.id, input);
    }
  }

  function toggleKnowledgeProject(projectId: string) {
    setKnowledgeProjectIds((current) =>
      current.includes(projectId)
        ? current.filter((id) => id !== projectId)
        : [...current, projectId],
    );
    setKnowledgeAddProjectIds((current) => current.filter((id) => id !== projectId));
  }

  function openKnowledgeComposer() {
    if (!project) return;
    setKnowledgeProjectIds([project.id]);
    setKnowledgeTitle("");
    setKnowledgeType("PLAN");
    setKnowledgeWorkstreamId(null);
    setKnowledgeOwnerMode("existing");
    setKnowledgeAddProjectIds([]);
    setKnowledgeNewWorkstreamName("");
    setKnowledgeError(null);
    setKnowledgeComposerOpen(true);
  }

  async function submitKnowledgeDocument(event: FormEvent) {
    event.preventDefault();
    if (!project || !knowledgeTitle.trim() || knowledgeProjectIds.length === 0) return;
    setKnowledgeError(null);
    setKnowledgeSubmitting(true);
    try {
      await actions.createKnowledgeDocumentForProjects({
        title: knowledgeTitle,
        type: knowledgeType,
        projectIds: knowledgeProjectIds,
        workstreamId: knowledgeProjectIds.length > 1 && knowledgeOwnerMode === "existing" ? knowledgeWorkstreamId : null,
        addProjectIds: knowledgeProjectIds.length > 1 && knowledgeOwnerMode === "existing" ? knowledgeAddProjectIds : undefined,
        newWorkstream: knowledgeProjectIds.length > 1 && knowledgeOwnerMode === "new"
          ? { name: knowledgeNewWorkstreamName.trim() || knowledgeTitle.trim(), status: "PLANNED" }
          : undefined,
      });
      setKnowledgeTitle("");
      setKnowledgeComposerOpen(false);
    } catch (caughtError) {
      setKnowledgeError(caughtError instanceof Error ? caughtError.message : "문서를 만들지 못했습니다.");
    } finally {
      setKnowledgeSubmitting(false);
    }
  }

  function submitMilestone(event: FormEvent) {
    event.preventDefault();
    if (!project || !milestoneTitle.trim()) return;
    actions.addProjectMilestone(project.id, milestoneTitle, "PLANNED");
    setMilestoneTitle("");
  }

  function submitAction(event: FormEvent) {
    event.preventDefault();
    if (!project || !actionTitle.trim()) return;
    actions.addProjectAction(project.id, actionTitle, actionType, "OPEN");
    setActionTitle("");
  }

  function submitIdea(event: FormEvent) {
    event.preventDefault();
    if (!project || !ideaTitle.trim()) return;
    actions.addProjectIdea(project.id, ideaTitle);
    setIdeaTitle("");
  }

  function submitHistory(event: FormEvent) {
    event.preventDefault();
    if (!project || !historyDraft.summary.trim()) return;
    actions.addProjectHistory(project.id, historyDraft.summary, historyDraft.type, toIsoOrNull(historyDraft.occurredAt) ?? undefined, historyDraft.githubRef.trim() || null);
    setHistoryDraft({ summary: "", type: "NOTE", occurredAt: "", githubRef: "" });
  }

  if (mode === "view" && !project) {
    return <div className="flex h-full items-center justify-center p-6 text-sm text-slate-500">프로젝트를 선택하세요.</div>;
  }

  return (
    <div className="app-shell flex w-full min-w-0 justify-center bg-slate-200 text-slate-900 dark:bg-black dark:text-neutral-100">
      <div className="flex h-full min-h-0 w-full min-w-0 max-w-[1100px] flex-col bg-slate-100 p-4 dark:bg-black">
        <header className="mb-3 flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[10px] font-bold tracking-[0.18em] text-teal-700 dark:text-teal-300">프로젝트 작업 공간</p>
            <h1 className="truncate text-xl font-semibold text-slate-950 dark:text-neutral-50">{mode === "create" ? "새 프로젝트" : project?.name}</h1>
            <p className="text-xs text-slate-500 dark:text-neutral-400">프로젝트 상태와 계획, 변경 이력을 관리하세요</p>
          </div>
          {project ? <span className="rounded-full border border-slate-300 px-2 py-1 text-[11px] font-semibold text-slate-600 dark:border-neutral-700 dark:text-neutral-300">{statusLabels[project.status]}</span> : null}
        </header>

        <nav className="mb-3 grid grid-cols-2 gap-1 rounded-lg border border-slate-200 bg-white p-1 dark:border-neutral-800 dark:bg-neutral-950 sm:grid-cols-4">
          {(["overview", "github", "plan", "history"] as const).map((tab) => (
            <button key={tab} type="button" onClick={() => setActiveTab(tab)} className={`rounded px-2 py-1.5 text-xs font-semibold transition ${activeTab === tab ? "bg-slate-900 text-white dark:bg-white dark:text-black" : "text-slate-500 hover:bg-slate-100 dark:text-neutral-400 dark:hover:bg-neutral-900"}`}>
              {tab === "overview" ? "개요" : tab === "github" ? "GitHub" : tab === "plan" ? "계획" : "변경 이력"}
            </button>
          ))}
        </nav>

        <main className="min-h-0 flex-1 overflow-auto pr-1">
          {activeTab === "overview" ? (
            <div className="grid gap-3">
              <Section title="프로젝트 개요">
                <form className="grid gap-2" onSubmit={submitProject}>
                  <Field label="이름" value={projectDraft.name} onChange={(value) => setProjectDraft((draft) => ({ ...draft, name: value }))} />
                  <Field label="설명" value={projectDraft.description} multiline onChange={(value) => setProjectDraft((draft) => ({ ...draft, description: value }))} placeholder="프로젝트의 목적과 맥락" />
                  <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                    <Field label="현재 상태" value={projectDraft.currentSummary} multiline onChange={(value) => setProjectDraft((draft) => ({ ...draft, currentSummary: value }))} placeholder="현재 상태" />
                    <Field label="목표 상태" value={projectDraft.targetSummary} multiline onChange={(value) => setProjectDraft((draft) => ({ ...draft, targetSummary: value }))} placeholder="도달하려는 상태" />
                  </div>
                  <label className="grid gap-1 text-[11px] font-medium text-slate-600 dark:text-neutral-300"><span>상태</span><select className="rounded border border-slate-300 bg-white px-2 py-1.5 text-xs dark:border-neutral-700 dark:bg-neutral-950" value={projectDraft.status} onChange={(event) => setProjectDraft((draft) => ({ ...draft, status: event.target.value as DevProjectStatus }))}>{PROJECT_STATUSES.map((status) => <option key={status} value={status}>{statusLabels[status]}</option>)}</select></label>
                  <fieldset className="grid gap-2 rounded border border-slate-200 p-2 dark:border-neutral-800"><legend className="px-1 text-[11px] font-semibold text-slate-600 dark:text-neutral-300">저장소 연결</legend><div className="flex flex-wrap gap-3 text-xs"><label className="inline-flex items-center gap-2"><input type="radio" checked={repositoryMode === "github"} onChange={() => handleRepositoryModeChange("github")} />GitHub 저장소</label><label className="inline-flex items-center gap-2"><input type="radio" checked={repositoryMode === "text"} onChange={() => handleRepositoryModeChange("text")} />GitHub 미연결</label></div>{repositoryMode === "github" ? <GitHubRepositoryPicker integration={github} repository={projectDraft.repository} branch={projectDraft.branch} githubRepositoryId={projectDraft.githubRepositoryId} githubOwner={projectDraft.githubOwner} githubRepo={projectDraft.githubRepo} onRepositoryChange={(value) => setProjectDraft((draft) => ({ ...draft, repository: value, githubRepositoryId: null, githubOwner: null, githubRepo: null }))} onBranchChange={(value) => setProjectDraft((draft) => ({ ...draft, branch: value }))} onIdentityChange={handleRepositorySelection} /> : <p className="text-[11px] text-slate-500">GitHub 연결 없이 상태를 관리합니다.</p>}</fieldset>
                  {repositoryMode === "github" ? <div className="grid grid-cols-1 gap-2 md:grid-cols-2"><Field label="마지막 검증 커밋" value={projectDraft.lastVerifiedCommit} onChange={(value) => setProjectDraft((draft) => ({ ...draft, lastVerifiedCommit: value }))} /><Field label="마지막 검증 시각" value={projectDraft.lastVerifiedAt} onChange={(value) => setProjectDraft((draft) => ({ ...draft, lastVerifiedAt: value }))} /></div> : null}
                  {projectFormError ? <p role="alert" className="rounded border border-red-200 bg-red-50 px-2 py-1.5 text-xs text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200">{projectFormError}</p> : null}
                  <div className="flex flex-wrap gap-2"><button type="submit" className="rounded bg-teal-700 px-3 py-1.5 text-xs font-semibold text-white">저장</button>{project ? <button type="button" onClick={() => actions.deleteProject(project.id)} className="rounded border border-rose-300 px-3 py-1.5 text-xs font-semibold text-rose-700">프로젝트 삭제</button> : null}</div>
                </form>
              </Section>
              {project ? <Section title="검증 상태"><div className="grid grid-cols-1 gap-2 text-xs text-slate-600 dark:text-neutral-300 md:grid-cols-2"><p>저장소: <strong>{project.repository || "-"}</strong></p><p>추적 브랜치: <strong>{project.branch || "-"}</strong></p><p>마지막 검증 커밋: <strong className="font-mono">{project.lastVerifiedCommit || "-"}</strong></p><p>마지막 검증 시각: <strong>{project.lastVerifiedAt ? formatTimestamp(project.lastVerifiedAt) : "-"}</strong></p></div></Section> : null}
              {project ? <Section title="워크스트림"><div className="grid gap-1">{selectedWorkstreams.length === 0 ? <p className="text-xs text-slate-500 dark:text-neutral-400">참여 중인 워크스트림이 없습니다.</p> : selectedWorkstreams.map((workstream) => { const openActions = workstreamActions.filter((action) => action.deletedAt === null && action.workstreamId === workstream.id && action.status === "OPEN").length; return <div key={workstream.id} className="flex flex-wrap items-center justify-between gap-2 rounded border border-slate-200 p-2 text-xs dark:border-neutral-800"><span className="min-w-0 truncate font-semibold">{workstream.name}</span><span className="shrink-0 text-[10px] text-slate-500">{WORKSTREAM_STATUS_LABELS[workstream.status]} · 미완료 {openActions}</span></div>; })}</div><p className="mt-2 text-[10px] text-slate-500 dark:text-neutral-400">워크스트림 작업은 워크스트림 화면에서 관리하며, 여기서는 프로젝트 참여 상태를 확인할 수 있습니다.</p></Section> : null}
              {project ? <Section title="지식 문서">
                <button type="button" onClick={openKnowledgeComposer} className="mb-2 rounded bg-teal-700 px-3 py-1.5 text-xs font-semibold text-white">새 문서</button>
                {knowledgeComposerOpen ? <form className="mb-3 grid gap-3 rounded-lg border border-teal-200 bg-teal-50/50 p-3 dark:border-teal-900 dark:bg-teal-950/20" onSubmit={(event) => void submitKnowledgeDocument(event)}>
                  <div className="flex items-center justify-between gap-2"><p className="text-xs font-semibold text-slate-700 dark:text-neutral-200">새 지식 문서</p><button type="button" onClick={() => setKnowledgeComposerOpen(false)} className="text-[11px] text-slate-500 hover:underline">닫기</button></div>
                  <div className="grid grid-cols-1 gap-2 md:grid-cols-[1fr_auto]">
                    <input autoFocus className="min-w-0 rounded border border-slate-300 bg-white px-2 py-1.5 text-xs dark:border-neutral-700 dark:bg-neutral-950" placeholder="문서 제목" value={knowledgeTitle} onChange={(event) => setKnowledgeTitle(event.target.value)} />
                    <select className="rounded border border-slate-300 bg-white px-2 py-1.5 text-[10px] dark:border-neutral-700 dark:bg-neutral-950" value={knowledgeType} onChange={(event) => setKnowledgeType(event.target.value as KnowledgeDocumentType)}>
                      {KNOWLEDGE_DOCUMENT_TYPES.map((type) => <option key={type} value={type}>{KNOWLEDGE_DOCUMENT_TYPE_LABELS[type]}</option>)}
                    </select>
                  </div>
                  <fieldset className="grid gap-1"><legend className="text-[11px] font-semibold text-slate-600 dark:text-neutral-300">연결 프로젝트</legend>{projects.filter((item) => item.deletedAt === null).sort((a, b) => a.name.localeCompare(b.name)).map((item) => <label key={item.id} className="flex items-center gap-2 rounded px-1 py-1 text-xs hover:bg-white dark:hover:bg-neutral-900"><input type="checkbox" checked={knowledgeProjectIds.includes(item.id)} onChange={() => toggleKnowledgeProject(item.id)} /><span>{item.name}</span>{item.id === project.id ? <span className="text-[10px] text-teal-700 dark:text-teal-300">현재 프로젝트</span> : null}</label>)}</fieldset>
                  {knowledgeProjectIds.length > 1 ? <div className="grid gap-2 rounded border border-slate-200 bg-white/70 p-2 dark:border-neutral-800 dark:bg-neutral-950/60">
                    <p className="text-[11px] font-semibold text-slate-600 dark:text-neutral-300">다중 프로젝트 문서 소유자</p>
                    <label className="flex items-center gap-2 text-xs"><input type="radio" checked={knowledgeOwnerMode === "existing"} onChange={() => { setKnowledgeOwnerMode("existing"); setKnowledgeAddProjectIds([]); }} />기존 워크스트림 사용</label>
                    {knowledgeOwnerMode === "existing" ? <div className="grid gap-1 pl-5">{knowledgeCandidates.length === 0 ? <p className="text-[11px] text-slate-500">기존 워크스트림이 없습니다.</p> : knowledgeCandidates.map((candidate) => <label key={candidate.workstream.id} className="grid gap-1 rounded border border-slate-200 p-2 text-[11px] dark:border-neutral-800"><span className="flex items-center gap-2"><input type="radio" name="knowledge-workstream" checked={knowledgeWorkstreamId === candidate.workstream.id} onChange={() => { setKnowledgeWorkstreamId(candidate.workstream.id); setKnowledgeAddProjectIds([]); }} /><strong>{candidate.workstream.name}</strong><span className="text-[10px] text-slate-500">{candidate.rank === 0 ? "선택 프로젝트에 모두 참여" : candidate.rank === 1 ? "일부 참여" : "기타"}</span></span>{candidate.missingProjectIds.length > 0 ? <span className="pl-5 text-amber-700 dark:text-amber-300">누락: {getProjectNamesById(projects, candidate.missingProjectIds).join(", ")}</span> : null}{knowledgeWorkstreamId === candidate.workstream.id && candidate.missingProjectIds.length > 0 ? <span className="grid gap-1 pl-5">{candidate.missingProjectIds.map((missingId) => <label key={missingId} className="flex items-center gap-2"><input type="checkbox" checked={knowledgeAddProjectIds.includes(missingId)} onChange={() => setKnowledgeAddProjectIds((current) => current.includes(missingId) ? current.filter((id) => id !== missingId) : [...current, missingId])} />{getProjectNamesById(projects, [missingId])[0]}를 참여 프로젝트로 추가</label>)}</span> : null}</label>)}</div> : null}
                    <label className="flex items-center gap-2 text-xs"><input type="radio" checked={knowledgeOwnerMode === "new"} onChange={() => { setKnowledgeOwnerMode("new"); setKnowledgeWorkstreamId(null); setKnowledgeAddProjectIds([]); setKnowledgeNewWorkstreamName(knowledgeNewWorkstreamName || knowledgeTitle); }} />새 워크스트림 생성</label>
                    {knowledgeOwnerMode === "new" ? <div className="grid gap-1 pl-5"><input className="rounded border border-slate-300 bg-white px-2 py-1.5 text-xs dark:border-neutral-700 dark:bg-neutral-950" placeholder="워크스트림 이름" value={knowledgeNewWorkstreamName} onChange={(event) => setKnowledgeNewWorkstreamName(event.target.value)} /><span className="text-[10px] text-slate-500">상태: 예정 · 선택한 프로젝트가 모두 참여 프로젝트로 연결됩니다.</span></div> : null}
                  </div> : null}
                  <div className="rounded border border-slate-200 bg-white/70 px-2 py-1.5 text-[11px] dark:border-neutral-800 dark:bg-neutral-950/60">생성 위치: <span className="font-mono">{knowledgePreviewPath}</span></div>
                  {knowledgeError ? <p role="alert" className="text-[11px] text-rose-700 dark:text-rose-300">{knowledgeError}</p> : null}
                  <button type="submit" disabled={knowledgeSubmitting || !knowledgeTitle.trim() || knowledgeProjectIds.length === 0 || (knowledgeProjectIds.length > 1 && knowledgeOwnerMode === "existing" && !knowledgeWorkstreamId) || (knowledgeProjectIds.length > 1 && knowledgeOwnerMode === "new" && !knowledgeNewWorkstreamName.trim() && !knowledgeTitle.trim()) || (knowledgeProjectIds.length > 1 && knowledgeOwnerMode === "existing" && Boolean(selectedKnowledgeCandidate?.missingProjectIds.some((id) => !knowledgeAddProjectIds.includes(id))))} className="justify-self-start rounded bg-teal-700 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50">{knowledgeSubmitting ? "생성 중..." : "생성"}</button>
                </form> : null}
                <div className="grid gap-1">
                  {selectedKnowledgeDocuments.length === 0 ? <p className="text-xs text-slate-500 dark:text-neutral-400">관련 문서가 없습니다.</p> : selectedKnowledgeDocuments.map((document) => <div key={document.id} className="grid gap-1 rounded border border-slate-200 p-2 text-xs dark:border-neutral-800">
                    <div className="flex flex-wrap items-center gap-2">
                      <input className="min-w-0 flex-1 bg-transparent font-medium" value={document.title} onChange={(event) => void actions.updateKnowledgeDocument(document.id, { title: event.target.value })} />
                      <select className="rounded border border-slate-200 bg-transparent text-[10px] dark:border-neutral-700" value={document.type} onChange={(event) => void actions.updateKnowledgeDocument(document.id, { type: event.target.value as KnowledgeDocumentType })}>{KNOWLEDGE_DOCUMENT_TYPES.map((type) => <option key={type} value={type}>{KNOWLEDGE_DOCUMENT_TYPE_LABELS[type]}</option>)}</select>
                      <button type="button" onClick={() => void actions.openKnowledgeDocument(document)} className="text-teal-700 hover:underline dark:text-teal-300">열기</button>
                    </div>
                    <span className="truncate text-[10px] text-slate-500 dark:text-neutral-400">{document.workstreamId ? `워크스트림 · ${workstreams.find((item) => item.id === document.workstreamId)?.name ?? document.workstreamId}` : "프로젝트"} · {document.relativePath}</span>
                  </div>)}
                </div>
                {knowledgeError ? <p role="alert" className="mt-2 text-[11px] text-rose-700 dark:text-rose-300">{knowledgeError}</p> : null}
                <p className="mt-2 text-[10px] text-slate-500 dark:text-neutral-400">프로젝트 홈 문서는 앱 데이터에서 자동 생성됩니다.</p>
              </Section> : null}
            </div>
          ) : null}

          {activeTab === "github" ? (
            <div className="grid gap-3">
              <GitHubConnectionBar integration={github} />
              {project ? <GitHubRepositoryObservation project={project} readState={readState} onRefresh={() => void github.refreshProject(project)} onLoadMore={() => void github.loadMoreCommitHistory(project)} /> : <Section title="GitHub"><p className="text-xs text-slate-500">프로젝트를 저장한 뒤 원격 저장소 상태를 조회할 수 있습니다.</p></Section>}
            </div>
          ) : null}

          {activeTab === "plan" ? (
            <div className="grid gap-3">
              <Section title="마일스톤"><form className="mb-2 flex gap-2" onSubmit={submitMilestone}><input className="min-w-0 flex-1 rounded border border-slate-300 bg-white px-2 py-1.5 text-xs dark:border-neutral-700 dark:bg-neutral-950" placeholder="마일스톤 추가" value={milestoneTitle} onChange={(event) => setMilestoneTitle(event.target.value)} /><button type="submit" disabled={!project} className="rounded bg-slate-800 px-2 text-xs text-white disabled:opacity-50">추가</button></form><div className="grid gap-1">{selectedMilestones.map((item) => <div key={item.id} className="flex flex-wrap items-center gap-2 rounded border border-slate-200 p-2 text-xs dark:border-neutral-800"><input className="min-w-0 flex-1 bg-transparent" value={item.title} onChange={(event) => actions.updateProjectMilestone(item.id, { title: event.target.value })} /><select className="rounded border border-slate-200 bg-transparent text-[10px] dark:border-neutral-700" value={item.status} onChange={(event) => actions.updateProjectMilestone(item.id, { status: event.target.value as DevMilestoneStatus })}>{MILESTONE_STATUSES.map((status) => <option key={status} value={status}>{MILESTONE_STATUS_LABELS[status]}</option>)}</select><button type="button" onClick={() => actions.deleteProjectMilestone(item.id)} className="text-rose-600">삭제</button></div>)}</div></Section>
              <Section title="다음 작업 / 나중에 / 차단됨"><form className="mb-2 flex flex-wrap gap-2" onSubmit={submitAction}><input className="min-w-0 flex-1 rounded border border-slate-300 bg-white px-2 py-1.5 text-xs dark:border-neutral-700 dark:bg-neutral-950" placeholder="다음 작업 추가" value={actionTitle} onChange={(event) => setActionTitle(event.target.value)} /><select className="rounded border border-slate-300 bg-transparent text-[10px] dark:border-neutral-700" value={actionType} onChange={(event) => setActionType(event.target.value as DevActionType)}>{ACTION_TYPES.map((type) => <option key={type} value={type}>{ACTION_TYPE_LABELS[type]}</option>)}</select><button type="submit" disabled={!project} className="rounded bg-slate-800 px-2 text-xs text-white disabled:opacity-50">추가</button></form><div className="grid gap-1">{ACTION_TYPES.map((type) => <div key={type} className="grid gap-1"><p className="text-[10px] font-semibold text-slate-500">{ACTION_TYPE_LABELS[type]}</p>{selectedActions.filter((item) => item.type === type).map((item) => <div key={item.id} className="flex flex-wrap items-center gap-2 rounded border border-slate-200 p-2 text-xs dark:border-neutral-800"><input className="min-w-0 flex-1 bg-transparent" value={item.title} onChange={(event) => actions.updateProjectAction(item.id, { title: event.target.value })} /><select className="rounded border border-slate-200 bg-transparent text-[10px] dark:border-neutral-700" value={item.status} onChange={(event) => actions.updateProjectAction(item.id, { status: event.target.value as DevActionStatus })}>{ACTION_STATUSES.map((status) => <option key={status} value={status}>{ACTION_STATUS_LABELS[status]}</option>)}</select><button type="button" onClick={() => actions.deleteProjectAction(item.id)} className="text-rose-600">삭제</button></div>)}</div>)}</div></Section>
              <Section title="아이디어"><form className="mb-2 flex gap-2" onSubmit={submitIdea}><input className="min-w-0 flex-1 rounded border border-slate-300 bg-white px-2 py-1.5 text-xs dark:border-neutral-700 dark:bg-neutral-950" placeholder="아이디어 추가" value={ideaTitle} onChange={(event) => setIdeaTitle(event.target.value)} /><button type="submit" disabled={!project} className="rounded bg-slate-800 px-2 text-xs text-white disabled:opacity-50">추가</button></form><div className="grid gap-1">{selectedIdeas.map((item) => <div key={item.id} className="flex items-center gap-2 rounded border border-slate-200 p-2 text-xs dark:border-neutral-800"><input className="min-w-0 flex-1 bg-transparent" value={item.title} onChange={(event) => actions.updateProjectIdea(item.id, { title: event.target.value })} /><button type="button" onClick={() => actions.deleteProjectIdea(item.id)} className="text-rose-600">삭제</button></div>)}</div></Section>
            </div>
          ) : null}

          {activeTab === "history" ? (
            <div className="grid gap-3">
              <Section title="프로젝트 변경 이력"><form className="grid gap-2" onSubmit={submitHistory}><Field label="요약" value={historyDraft.summary} onChange={(value) => setHistoryDraft((draft) => ({ ...draft, summary: value }))} /><div className="grid grid-cols-1 gap-2 md:grid-cols-2"><label className="grid gap-1 text-[11px] font-medium text-slate-600 dark:text-neutral-300"><span>유형</span><select className="rounded border border-slate-300 bg-white px-2 py-1.5 text-xs dark:border-neutral-700 dark:bg-neutral-950" value={historyDraft.type} onChange={(event) => setHistoryDraft((draft) => ({ ...draft, type: event.target.value as DevHistoryType }))}>{HISTORY_TYPES.map((type) => <option key={type} value={type}>{HISTORY_TYPE_LABELS[type]}</option>)}</select></label><Field label="발생 시각" value={historyDraft.occurredAt} onChange={(value) => setHistoryDraft((draft) => ({ ...draft, occurredAt: value }))} /></div><Field label="GitHub 참조 (선택)" value={historyDraft.githubRef} onChange={(value) => setHistoryDraft((draft) => ({ ...draft, githubRef: value }))} /><button type="submit" disabled={!project} className="justify-self-start rounded bg-slate-800 px-3 py-1.5 text-xs text-white disabled:opacity-50">이력 추가</button></form><div className="mt-3 grid gap-1">{selectedHistory.map((item) => <div key={item.id} className="grid gap-2 rounded border border-slate-200 p-2 text-xs dark:border-neutral-800"><div className="grid grid-cols-1 gap-2 md:grid-cols-[auto_1fr_auto]"><select className="rounded border border-slate-200 bg-transparent text-[10px] dark:border-neutral-700" value={item.type} onChange={(event) => actions.updateProjectHistory(item.id, { type: event.target.value as DevHistoryType })}>{HISTORY_TYPES.map((type) => <option key={type} value={type}>{HISTORY_TYPE_LABELS[type]}</option>)}</select><input className="min-w-0 bg-transparent" value={item.summary} onChange={(event) => actions.updateProjectHistory(item.id, { summary: event.target.value })} /><button type="button" onClick={() => actions.deleteProjectHistory(item.id)} className="text-rose-600">삭제</button></div><div className="grid grid-cols-1 gap-2 md:grid-cols-2"><input type="datetime-local" className="rounded border border-slate-200 bg-transparent px-2 py-1 text-[11px] dark:border-neutral-700" value={toDateTimeLocal(item.occurredAt)} onChange={(event) => actions.updateProjectHistory(item.id, { occurredAt: toIsoOrNull(event.target.value) ?? item.occurredAt })} /><input className="rounded border border-slate-200 bg-transparent px-2 py-1 text-[11px] dark:border-neutral-700" value={item.githubRef ?? ""} placeholder="GitHub 참조" onChange={(event) => actions.updateProjectHistory(item.id, { githubRef: event.target.value || null })} /></div><span className="text-[10px] text-slate-500">{formatTimestamp(item.occurredAt)}</span></div>)}</div></Section>
            </div>
          ) : null}
        </main>
      </div>
    </div>
  );
}
