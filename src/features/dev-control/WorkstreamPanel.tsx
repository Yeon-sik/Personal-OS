import { useEffect, useMemo, useState, type FormEvent } from "react";

import type {
  DevActionStatus,
  DevActionType,
  DevMilestoneStatus,
  DevWorkstreamStatus,
  KnowledgeDocument,
  KnowledgeDocumentType,
  Project,
  Workstream,
  WorkstreamAction,
  WorkstreamActionDependency,
  WorkstreamActionProject,
  WorkstreamMilestone,
  WorkstreamProject,
} from "../../types";
import {
  isWorkstreamActionDependencyAllowed,
  type WorkstreamChanges,
} from "./devControlService";
import type { DevControlActions } from "./useDevControlActions";
import { ACTION_STATUS_LABELS, ACTION_TYPE_LABELS, KNOWLEDGE_DOCUMENT_TYPE_LABELS, MILESTONE_STATUS_LABELS } from "./devControlLabels";

const WORKSTREAM_STATUSES: DevWorkstreamStatus[] = [
  "ACTIVE",
  "PLANNED",
  "COMPLETED",
];
const MILESTONE_STATUSES: DevMilestoneStatus[] = [
  "PLANNED",
  "IN_PROGRESS",
  "COMPLETED",
];
const ACTION_TYPES: DevActionType[] = ["NEXT", "LATER", "BLOCKED"];
const ACTION_STATUSES: DevActionStatus[] = ["OPEN", "DONE"];
const KNOWLEDGE_DOCUMENT_TYPES: KnowledgeDocumentType[] = ["IDEA", "PLAN", "DESIGN", "RESEARCH", "NOTE"];

const WORKSTREAM_STATUS_LABELS: Record<DevWorkstreamStatus, string> = {
  ACTIVE: "진행 중",
  PLANNED: "예정",
  COMPLETED: "완료",
};

interface WorkstreamPanelProps {
  workstreams: Workstream[];
  projects: Project[];
  workstreamProjects: WorkstreamProject[];
  workstreamMilestones: WorkstreamMilestone[];
  workstreamActions: WorkstreamAction[];
  workstreamActionProjects: WorkstreamActionProject[];
  workstreamActionDependencies: WorkstreamActionDependency[];
  knowledgeDocuments: KnowledgeDocument[];
  selectedWorkstreamId: string | null;
  onOpenWorkstream: (workstreamId: string) => void;
  onCreateWorkstream: () => void;
  onOpenProjectWorkspace: (projectId: string) => void;
  actions: DevControlActions;
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-3 dark:border-neutral-800 dark:bg-neutral-950">
      <h3 className="mb-2 text-xs font-bold tracking-wide text-slate-700 dark:text-neutral-200">
        {title}
      </h3>
      {children}
    </section>
  );
}

function Field({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="grid gap-1 text-[11px] font-medium text-slate-600 dark:text-neutral-300">
      <span>{label}</span>
      <input
        className="w-full rounded border border-slate-300 bg-white px-2 py-1.5 text-xs outline-none focus:border-teal-500 dark:border-neutral-700 dark:bg-neutral-950"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  );
}

function sortByUpdatedAt<T extends { updatedAt: string }>(items: T[]): T[] {
  return [...items].sort((first, second) =>
    second.updatedAt.localeCompare(first.updatedAt),
  );
}

export function WorkstreamPanel({
  workstreams,
  projects,
  workstreamProjects,
  workstreamMilestones,
  workstreamActions,
  workstreamActionProjects,
  workstreamActionDependencies,
  knowledgeDocuments,
  selectedWorkstreamId,
  onOpenWorkstream,
  onCreateWorkstream,
  onOpenProjectWorkspace,
  actions,
}: WorkstreamPanelProps) {
  const [isCreating, setIsCreating] = useState(false);
  const [draft, setDraft] = useState({
    name: "",
    status: "PLANNED" as DevWorkstreamStatus,
    projectIds: [] as string[],
  });
  const [milestoneTitle, setMilestoneTitle] = useState("");
  const [actionTitle, setActionTitle] = useState("");
  const [actionType, setActionType] = useState<DevActionType>("NEXT");
  const [dependencyTargets, setDependencyTargets] = useState<
    Record<string, string>
  >({});
  const [dependencyError, setDependencyError] = useState<string | null>(null);
  const [knowledgeTitle, setKnowledgeTitle] = useState("");
  const [knowledgeType, setKnowledgeType] = useState<KnowledgeDocumentType>("PLAN");
  const [knowledgeError, setKnowledgeError] = useState<string | null>(null);

  const workstream =
    workstreams.find((item) => item.id === selectedWorkstreamId) ?? null;
  const participatingLinks = useMemo(
    () =>
      workstream
        ? workstreamProjects.filter(
            (link) =>
              link.workstreamId === workstream.id && link.deletedAt === null,
          )
        : [],
    [workstream, workstreamProjects],
  );
  const participatingProjectIds = useMemo(
    () => new Set(participatingLinks.map((link) => link.projectId)),
    [participatingLinks],
  );
  const selectedMilestones = useMemo(
    () =>
      workstream
        ? sortByUpdatedAt(
            workstreamMilestones.filter(
              (item) =>
                item.workstreamId === workstream.id && item.deletedAt === null,
            ),
          )
        : [],
    [workstream, workstreamMilestones],
  );
  const selectedActions = useMemo(
    () =>
      workstream
        ? sortByUpdatedAt(
            workstreamActions.filter(
              (item) =>
                item.workstreamId === workstream.id && item.deletedAt === null,
            ),
          )
        : [],
    [workstream, workstreamActions],
  );
  const selectedDocuments = useMemo(
    () =>
      workstream
        ? knowledgeDocuments
            .filter(
              (document) =>
                document.deletedAt === null && document.workstreamId === workstream.id,
            )
            .sort((first, second) => first.title.localeCompare(second.title))
        : [],
    [knowledgeDocuments, workstream],
  );

  useEffect(() => {
    setDependencyError(null);
    if (isCreating || !workstream) {
      if (!workstream && !isCreating) {
        setDraft({ name: "", status: "PLANNED", projectIds: [] });
      }
      return;
    }

    setDraft({
      name: workstream.name,
      status: workstream.status,
      projectIds: workstreamProjects
        .filter(
          (link) =>
            link.workstreamId === workstream.id && link.deletedAt === null,
        )
        .map((link) => link.projectId),
    });
  }, [isCreating, workstream, workstreamProjects]);

  function openCreate() {
    setIsCreating(true);
    setDraft({ name: "", status: "PLANNED", projectIds: [] });
    setDependencyError(null);
    onCreateWorkstream();
  }

  function openDetail(id: string) {
    setIsCreating(false);
    onOpenWorkstream(id);
  }

  function submitWorkstream(event: FormEvent) {
    event.preventDefault();
    if (!draft.name.trim()) return;

    if (isCreating) {
      actions.addWorkstream({
        name: draft.name,
        status: draft.status,
        projectIds: draft.projectIds,
      });
      setIsCreating(false);
      return;
    }

    if (workstream) {
      const changes: WorkstreamChanges = {
        name: draft.name,
        status: draft.status,
      };
      actions.updateWorkstream(workstream.id, changes);
    }
  }

  function toggleProject(projectId: string) {
    if (isCreating) {
      setDraft((current) => ({
        ...current,
        projectIds: current.projectIds.includes(projectId)
          ? current.projectIds.filter((id) => id !== projectId)
          : [...current.projectIds, projectId],
      }));
      return;
    }

    if (!workstream) return;
    const existing = participatingLinks.find(
      (link) => link.projectId === projectId,
    );
    if (existing) {
      actions.deleteWorkstreamProject(existing.id);
    } else {
      actions.addWorkstreamProject(workstream.id, projectId);
    }
  }

  function submitMilestone(event: FormEvent) {
    event.preventDefault();
    if (!workstream || !milestoneTitle.trim()) return;
    actions.addWorkstreamMilestone(workstream.id, milestoneTitle);
    setMilestoneTitle("");
  }

  function submitAction(event: FormEvent) {
    event.preventDefault();
    if (!workstream || !actionTitle.trim()) return;
    actions.addWorkstreamAction(workstream.id, actionTitle, actionType);
    setActionTitle("");
  }

  async function submitKnowledgeDocument(event: FormEvent) {
    event.preventDefault();
    if (!workstream || !knowledgeTitle.trim()) return;
    setKnowledgeError(null);
    try {
      await actions.addKnowledgeDocument({
        title: knowledgeTitle,
        type: knowledgeType,
        projectId: null,
        workstreamId: workstream.id,
      });
      setKnowledgeTitle("");
    } catch (caughtError) {
      setKnowledgeError(caughtError instanceof Error ? caughtError.message : "문서를 만들지 못했습니다.");
    }
  }

  function toggleActionProject(action: WorkstreamAction, projectId: string) {
    const existing = workstreamActionProjects.find(
      (link) =>
        link.actionId === action.id &&
        link.projectId === projectId &&
        link.deletedAt === null,
    );
    if (existing) {
      actions.deleteWorkstreamActionProject(existing.id);
    } else {
      actions.addWorkstreamActionProject(action.id, projectId);
    }
  }

  function addDependency(actionId: string) {
    const dependsOnActionId = dependencyTargets[actionId];
    if (!dependsOnActionId) return;
    if (
      !isWorkstreamActionDependencyAllowed(
        workstreamActionDependencies,
        actionId,
        dependsOnActionId,
      )
    ) {
      setDependencyError(
        "순환 dependency 또는 중복 dependency는 추가할 수 없습니다.",
      );
      return;
    }
    setDependencyError(null);
    actions.addWorkstreamActionDependency(actionId, dependsOnActionId);
    setDependencyTargets((current) => ({ ...current, [actionId]: "" }));
  }

  function renderWorkstreamList() {
    if (workstreams.length === 0) {
      return (
        <p className="rounded border border-dashed border-slate-300 p-4 text-xs text-slate-500 dark:border-neutral-800 dark:text-neutral-400">
          워크스트림이 없습니다. 여러 프로젝트를 관통하는 공통 작업을 만들어 보세요.
        </p>
      );
    }

    return WORKSTREAM_STATUSES.map((status) => {
      const items = workstreams.filter((item) => item.status === status);
      if (items.length === 0) return null;
      return (
        <section key={status} className="grid gap-2">
          <h3 className="text-xs font-bold tracking-wide text-slate-500 dark:text-neutral-400">
            {WORKSTREAM_STATUS_LABELS[status]}
          </h3>
          {items.map((item) => {
            const projectCount = workstreamProjects.filter(
              (link) =>
                link.workstreamId === item.id && link.deletedAt === null,
            ).length;
            const openActionCount = workstreamActions.filter(
              (action) =>
                action.workstreamId === item.id &&
                action.deletedAt === null &&
                action.status === "OPEN",
            ).length;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => openDetail(item.id)}
                className={
                  selectedWorkstreamId === item.id
                    ? "grid gap-1 rounded-lg border border-teal-500 bg-teal-50 p-3 text-left transition dark:bg-teal-950/30"
                    : "grid gap-1 rounded-lg border border-slate-200 bg-white p-3 text-left transition hover:border-slate-400 dark:border-neutral-800 dark:bg-neutral-950"
                }
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate text-sm font-semibold">
                    {item.name}
                  </span>
                  <span className="shrink-0 text-[10px] text-slate-500">
                    {WORKSTREAM_STATUS_LABELS[item.status]}
                  </span>
                </div>
                <div className="flex flex-wrap gap-3 text-[10px] text-slate-500 dark:text-neutral-400">
                  <span>프로젝트 {projectCount}</span>
                  <span>미완료 작업 {openActionCount}</span>
                </div>
              </button>
            );
          })}
        </section>
      );
    });
  }

  return (
    <div className="grid min-h-0 gap-3 overflow-auto pr-1">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-slate-950 dark:text-neutral-50">
            워크스트림
          </h2>
          <p className="text-[11px] text-slate-500 dark:text-neutral-400">
            여러 프로젝트를 관통하는 기능·변경·출시 단위
          </p>
        </div>
        <button
          type="button"
          onClick={openCreate}
          className="rounded bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-700 dark:bg-white dark:text-black"
        >
          새 워크스트림
        </button>
      </div>

      <div className="grid gap-2">{renderWorkstreamList()}</div>

      {(isCreating || workstream) && (
        <div className="grid gap-3">
          <Section title={isCreating ? "새 워크스트림" : "워크스트림 개요"}>
            <form className="grid gap-2" onSubmit={submitWorkstream}>
              <Field
                label="이름"
                value={draft.name}
                onChange={(value) =>
                  setDraft((current) => ({ ...current, name: value }))
                }
              />
              <label className="grid gap-1 text-[11px] font-medium text-slate-600 dark:text-neutral-300">
                <span>상태</span>
                <select
                  className="rounded border border-slate-300 bg-white px-2 py-1.5 text-xs dark:border-neutral-700 dark:bg-neutral-950"
                  value={draft.status}
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      status: event.target.value as DevWorkstreamStatus,
                    }))
                  }
                >
                  {WORKSTREAM_STATUSES.map((status) => (
                    <option key={status} value={status}>
                      {WORKSTREAM_STATUS_LABELS[status]}
                    </option>
                  ))}
                </select>
              </label>
              <div className="flex flex-wrap gap-2">
                <button
                  type="submit"
                  className="rounded bg-teal-700 px-3 py-1.5 text-xs font-semibold text-white"
                >
                  저장
                </button>
                {!isCreating && workstream ? (
                  <button
                    type="button"
                    onClick={() => {
                      actions.deleteWorkstream(workstream.id);
                      setIsCreating(false);
                    }}
                    className="rounded border border-rose-300 px-3 py-1.5 text-xs font-semibold text-rose-700"
                  >
                    워크스트림 삭제
                  </button>
                ) : null}
              </div>
            </form>
          </Section>

          <Section title="참여 프로젝트">
            <div className="grid gap-1">
              {projects.length === 0 ? (
                <p className="text-xs text-slate-500">
                  먼저 프로젝트를 만들어 주세요.
                </p>
              ) : (
                projects.map((project) => {
                  const checked = isCreating
                    ? draft.projectIds.includes(project.id)
                    : participatingProjectIds.has(project.id);
                  return (
                    <div
                      key={project.id}
                      className="flex items-center justify-between gap-2 rounded border border-slate-200 px-2 py-1.5 text-xs dark:border-neutral-800"
                    >
                      <label className="flex min-w-0 items-center gap-2">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleProject(project.id)}
                        />
                        <span className="truncate">{project.name}</span>
                      </label>
                      <button
                        type="button"
                        onClick={() => onOpenProjectWorkspace(project.id)}
                        className="shrink-0 text-[10px] font-semibold text-teal-700 hover:underline dark:text-teal-300"
                      >
                        작업 공간
                      </button>
                    </div>
                  );
                })
              )}
            </div>
            <p className="mt-2 text-[10px] text-slate-500 dark:text-neutral-400">
              작업의 영향 프로젝트는 여기서 선택한 참여 프로젝트 안에서만 지정됩니다.
            </p>
          </Section>

          {!isCreating && workstream ? (
            <>
              <Section title="마일스톤">
                <form className="mb-2 flex gap-2" onSubmit={submitMilestone}>
                  <input
                    className="min-w-0 flex-1 rounded border border-slate-300 bg-white px-2 py-1.5 text-xs dark:border-neutral-700 dark:bg-neutral-950"
                    placeholder="마일스톤 추가"
                    value={milestoneTitle}
                    onChange={(event) => setMilestoneTitle(event.target.value)}
                  />
                  <button
                    type="submit"
                    className="rounded bg-slate-800 px-2 text-xs text-white"
                  >
                    추가
                  </button>
                </form>
                <div className="grid gap-1">
                  {selectedMilestones.map((milestone) => (
                    <div
                      key={milestone.id}
                      className="flex flex-wrap items-center gap-2 rounded border border-slate-200 p-2 text-xs dark:border-neutral-800"
                    >
                      <input
                        className="min-w-0 flex-1 bg-transparent"
                        value={milestone.title}
                        onChange={(event) =>
                          actions.updateWorkstreamMilestone(milestone.id, {
                            title: event.target.value,
                          })
                        }
                      />
                      <select
                        className="rounded border border-slate-200 bg-transparent text-[10px] dark:border-neutral-700"
                        value={milestone.status}
                        onChange={(event) =>
                          actions.updateWorkstreamMilestone(milestone.id, {
                            status: event.target.value as DevMilestoneStatus,
                          })
                        }
                      >
                        {MILESTONE_STATUSES.map((status) => (
                          <option key={status} value={status}>
                            {MILESTONE_STATUS_LABELS[status]}
                          </option>
                        ))}
                      </select>
                      <button
                        type="button"
                        onClick={() =>
                          actions.deleteWorkstreamMilestone(milestone.id)
                        }
                        className="text-rose-600"
                      >
                        삭제
                      </button>
                    </div>
                  ))}
                </div>
              </Section>

              <Section title="작업">
                <form
                  className="mb-2 flex flex-wrap gap-2"
                  onSubmit={submitAction}
                >
                  <input
                    className="min-w-0 flex-1 rounded border border-slate-300 bg-white px-2 py-1.5 text-xs dark:border-neutral-700 dark:bg-neutral-950"
                    placeholder="공통 작업 추가"
                    value={actionTitle}
                    onChange={(event) => setActionTitle(event.target.value)}
                  />
                  <select
                    className="rounded border border-slate-300 bg-transparent text-[10px] dark:border-neutral-700"
                    value={actionType}
                    onChange={(event) =>
                      setActionType(event.target.value as DevActionType)
                    }
                  >
                    {ACTION_TYPES.map((type) => (
                      <option key={type} value={type}>
                        {ACTION_TYPE_LABELS[type]}
                      </option>
                    ))}
                  </select>
                  <button
                    type="submit"
                    className="rounded bg-slate-800 px-2 text-xs text-white"
                  >
                    추가
                  </button>
                </form>
                <div className="grid gap-2">
                  {ACTION_TYPES.map((type) => {
                    const typedActions = selectedActions.filter(
                      (action) => action.type === type,
                    );
                    if (typedActions.length === 0) return null;
                    return (
                      <div key={type} className="grid gap-1">
                        <p className="text-[10px] font-semibold text-slate-500">
                          {ACTION_TYPE_LABELS[type]}
                        </p>
                        {typedActions.map((action) => {
                          const impactedLinks = workstreamActionProjects.filter(
                            (link) =>
                              link.actionId === action.id &&
                              link.deletedAt === null,
                          );
                          const dependencies =
                            workstreamActionDependencies.filter(
                              (dependency) =>
                                dependency.actionId === action.id &&
                                dependency.deletedAt === null,
                            );
                          const dependencyOptions = selectedActions.filter(
                            (candidate) =>
                              candidate.id !== action.id &&
                              !dependencies.some(
                                (dependency) =>
                                  dependency.dependsOnActionId === candidate.id,
                              ),
                          );
                          return (
                            <div
                              key={action.id}
                              className="grid gap-2 rounded border border-slate-200 p-2 text-xs dark:border-neutral-800"
                            >
                              <div className="flex flex-wrap items-center gap-2">
                                <input
                                  className="min-w-0 flex-1 bg-transparent"
                                  value={action.title}
                                  onChange={(event) =>
                                    actions.updateWorkstreamAction(action.id, {
                                      title: event.target.value,
                                    })
                                  }
                                />
                                <select
                                  className="rounded border border-slate-200 bg-transparent text-[10px] dark:border-neutral-700"
                                  value={action.status}
                                  onChange={(event) =>
                                    actions.updateWorkstreamAction(action.id, {
                                      status: event.target.value as DevActionStatus,
                                    })
                                  }
                                >
                                  {ACTION_STATUSES.map((status) => (
                                    <option key={status} value={status}>
                                      {ACTION_STATUS_LABELS[status]}
                                    </option>
                                  ))}
                                </select>
                                <button
                                  type="button"
                                  onClick={() =>
                                    actions.deleteWorkstreamAction(action.id)
                                  }
                                  className="text-rose-600"
                                >
                                  삭제
                                </button>
                              </div>
                              <div className="grid gap-1">
                                <p className="text-[10px] font-semibold text-slate-500">
                                  영향 프로젝트
                                </p>
                                <div className="flex flex-wrap gap-x-3 gap-y-1">
                                  {projects
                                    .filter((project) =>
                                      participatingProjectIds.has(project.id),
                                    )
                                    .map((project) => {
                                      const checked = impactedLinks.some(
                                        (link) =>
                                          link.projectId === project.id,
                                      );
                                      return (
                                        <label
                                          key={project.id}
                                          className="inline-flex items-center gap-1 text-[11px]"
                                        >
                                          <input
                                            type="checkbox"
                                            checked={checked}
                                            onChange={() =>
                                              toggleActionProject(
                                                action,
                                                project.id,
                                              )
                                            }
                                          />
                                          {project.name}
                                        </label>
                                      );
                                    })}
                                </div>
                                {impactedLinks.length === 0 ? (
                                  <span className="text-[10px] text-teal-700 dark:text-teal-300">
                                    공통 작업 · 워크스트림 전체
                                  </span>
                                ) : null}
                              </div>
                              <div className="grid gap-1">
                                <p className="text-[10px] font-semibold text-slate-500">
                                  선행 작업
                                </p>
                                {dependencies.map((dependency) => {
                                  const prerequisite = selectedActions.find(
                                    (candidate) =>
                                      candidate.id ===
                                      dependency.dependsOnActionId,
                                  );
                                  return (
                                    <div
                                      key={dependency.id}
                                      className="flex items-center justify-between gap-2 text-[10px] text-slate-600 dark:text-neutral-300"
                                    >
                                      <span className="truncate">
                                        ←{" "}
                                        {prerequisite?.title ??
                                          dependency.dependsOnActionId}
                                      </span>
                                      <button
                                        type="button"
                                        onClick={() =>
                                          actions.deleteWorkstreamActionDependency(
                                            dependency.id,
                                          )
                                        }
                                        className="text-rose-600"
                                      >
                                        제거
                                      </button>
                                    </div>
                                  );
                                })}
                                <div className="flex flex-wrap gap-2">
                                  <select
                                    className="min-w-0 flex-1 rounded border border-slate-200 bg-transparent px-1 py-1 text-[10px] dark:border-neutral-700"
                                    value={dependencyTargets[action.id] ?? ""}
                                    onChange={(event) =>
                                      setDependencyTargets((current) => ({
                                        ...current,
                                        [action.id]: event.target.value,
                                      }))
                                    }
                                  >
                                    <option value="">선행 작업 선택</option>
                                    {dependencyOptions.map((candidate) => (
                                      <option
                                        key={candidate.id}
                                        value={candidate.id}
                                      >
                                        {candidate.title}
                                      </option>
                                    ))}
                                  </select>
                                  <button
                                    type="button"
                                    onClick={() => addDependency(action.id)}
                                    className="rounded border border-slate-300 px-2 py-1 text-[10px] dark:border-neutral-700"
                                  >
                                    선행 작업 추가
                                  </button>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    );
                  })}
                </div>
                {dependencyError ? (
                  <p className="mt-2 rounded border border-rose-200 bg-rose-50 px-2 py-1.5 text-[11px] text-rose-700 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-300">
                    {dependencyError}
                  </p>
                ) : null}
              </Section>

              <Section title="지식 문서">
                <form className="mb-2 flex flex-wrap gap-2" onSubmit={(event) => void submitKnowledgeDocument(event)}>
                  <input className="min-w-0 flex-1 rounded border border-slate-300 bg-white px-2 py-1.5 text-xs dark:border-neutral-700 dark:bg-neutral-950" placeholder="새 문서 제목" value={knowledgeTitle} onChange={(event) => setKnowledgeTitle(event.target.value)} />
                  <select className="rounded border border-slate-300 bg-transparent text-[10px] dark:border-neutral-700" value={knowledgeType} onChange={(event) => setKnowledgeType(event.target.value as KnowledgeDocumentType)}>
                    {KNOWLEDGE_DOCUMENT_TYPES.map((type) => <option key={type} value={type}>{KNOWLEDGE_DOCUMENT_TYPE_LABELS[type]}</option>)}
                  </select>
                  <button type="submit" disabled={!knowledgeTitle.trim()} className="rounded bg-teal-700 px-2 text-xs text-white disabled:opacity-50">새 문서</button>
                </form>
                <div className="grid gap-1">
                  {selectedDocuments.length === 0 ? <p className="text-xs text-slate-500 dark:text-neutral-400">관련 문서가 없습니다.</p> : selectedDocuments.map((document) => <div key={document.id} className="grid gap-1 rounded border border-slate-200 p-2 text-xs dark:border-neutral-800">
                    <div className="flex flex-wrap items-center gap-2">
                      <input className="min-w-0 flex-1 bg-transparent font-medium" value={document.title} onChange={(event) => void actions.updateKnowledgeDocument(document.id, { title: event.target.value })} />
                      <select className="rounded border border-slate-200 bg-transparent text-[10px] dark:border-neutral-700" value={document.type} onChange={(event) => void actions.updateKnowledgeDocument(document.id, { type: event.target.value as KnowledgeDocumentType })}>{KNOWLEDGE_DOCUMENT_TYPES.map((type) => <option key={type} value={type}>{KNOWLEDGE_DOCUMENT_TYPE_LABELS[type]}</option>)}</select>
                      <button type="button" onClick={() => void actions.openKnowledgeDocument(document)} className="text-teal-700 hover:underline dark:text-teal-300">열기</button>
                    </div>
                    <span className="truncate text-[10px] text-slate-500 dark:text-neutral-400">{document.relativePath}</span>
                  </div>)}
                </div>
                {knowledgeError ? <p role="alert" className="mt-2 text-[11px] text-rose-700 dark:text-rose-300">{knowledgeError}</p> : null}
                <p className="mt-2 text-[10px] text-slate-500 dark:text-neutral-400">워크스트림 문서는 참여 중인 모든 프로젝트 홈 문서에 관련 문서 링크로 표시됩니다.</p>
              </Section>
            </>
          ) : null}
        </div>
      )}
    </div>
  );
}
