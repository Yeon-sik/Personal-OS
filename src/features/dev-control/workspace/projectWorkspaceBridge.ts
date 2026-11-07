import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { getPlatformCapabilities } from "../../../lib/platform/capabilities";
import type {
  DevActionStatus,
  DevActionType,
  DevHistoryType,
  DevMilestoneStatus,
  KnowledgeDocument,
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
import type { DevControlActions } from "../useDevControlActions";
import {
  disconnectedGitHubStatus,
  unavailableGitHubIntegration,
  type GitHubIntegrationController,
  type GitHubProjectReadState,
  type GitHubRepositoryLoadState,
  type GitHubRepositoryOption,
} from "../github/githubTypes";
import { openProjectWorkspaceWindow } from "./window";

export const PROJECT_WORKSPACE_READY_EVENT = "project-workspace:ready";
export const PROJECT_WORKSPACE_STATE_EVENT = "project-workspace:state";
export const PROJECT_WORKSPACE_OPEN_EVENT = "project-workspace:open";
export const PROJECT_WORKSPACE_MUTATION_EVENT = "project-workspace:mutation";
export const PROJECT_WORKSPACE_GITHUB_EVENT = "project-workspace:github";

export type ProjectWorkspaceMode = "view" | "create";

export interface ProjectWorkspaceSelection {
  mode: ProjectWorkspaceMode;
  projectId: string | null;
}

export interface ProjectWorkspaceGitHubState {
  status: GitHubIntegrationController["status"];
  deviceFlow: GitHubIntegrationController["deviceFlow"];
  repositories: GitHubRepositoryOption[];
  repositoryLoadState: GitHubRepositoryLoadState;
  branches: GitHubIntegrationController["branches"];
  readStates: Record<string, GitHubProjectReadState>;
  statusCheckError: string | null;
  error: string | null;
  busy: boolean;
}

export interface ProjectWorkspaceState {
  projectTaskLinks?: Record<string, string | null>;
  taskPlanningError?: string | null;
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
  selectedProjectId: string | null;
  github: ProjectWorkspaceGitHubState;
}

type AddProjectInput = Parameters<DevControlActions["addProject"]>[0];
type UpdateProjectInput = Parameters<DevControlActions["updateProject"]>[1];
type UpdateMilestoneInput = Parameters<DevControlActions["updateProjectMilestone"]>[1];
type UpdateActionInput = Parameters<DevControlActions["updateProjectAction"]>[1];
type UpdateIdeaInput = Parameters<DevControlActions["updateProjectIdea"]>[1];
type UpdateHistoryInput = Parameters<DevControlActions["updateProjectHistory"]>[1];
type AddKnowledgeDocumentInput = Parameters<DevControlActions["addKnowledgeDocument"]>[0];
type CreateKnowledgeDocumentForProjectsInput = Parameters<DevControlActions["createKnowledgeDocumentForProjects"]>[0];
type UpdateKnowledgeDocumentInput = Parameters<DevControlActions["updateKnowledgeDocument"]>[1];

export type ProjectWorkspaceMutation =
  | { type: "addProject"; input: AddProjectInput }
  | { type: "updateProject"; id: string; changes: UpdateProjectInput }
  | { type: "deleteProject"; id: string }
  | { type: "addProjectMilestone"; projectId: string; title: string; status?: DevMilestoneStatus }
  | { type: "updateProjectMilestone"; id: string; changes: UpdateMilestoneInput }
  | { type: "deleteProjectMilestone"; id: string }
  | { type: "addProjectAction"; projectId: string; title: string; actionType?: DevActionType; status?: DevActionStatus }
  | { type: "planProjectAction"; id: string; date?: string }
  | { type: "updateProjectAction"; id: string; changes: UpdateActionInput }
  | { type: "deleteProjectAction"; id: string }
  | { type: "addProjectIdea"; projectId: string; title: string }
  | { type: "updateProjectIdea"; id: string; changes: UpdateIdeaInput }
  | { type: "deleteProjectIdea"; id: string }
  | { type: "addProjectHistory"; projectId: string; summary: string; historyType?: DevHistoryType; occurredAt?: string; githubRef?: string | null }
  | { type: "updateProjectHistory"; id: string; changes: UpdateHistoryInput }
  | { type: "deleteProjectHistory"; id: string }
  | { type: "addKnowledgeDocument"; input: AddKnowledgeDocumentInput }
  | { type: "createKnowledgeDocumentForProjects"; input: CreateKnowledgeDocumentForProjectsInput }
  | { type: "updateKnowledgeDocument"; id: string; changes: UpdateKnowledgeDocumentInput }
  | { type: "deleteKnowledgeDocument"; id: string }
  | { type: "openKnowledgeDocument"; document: KnowledgeDocument };

export type ProjectWorkspaceGitHubCommand =
  | { type: "refreshStatus" }
  | { type: "connect" }
  | { type: "pollDeviceFlow" }
  | { type: "cancelDeviceFlow" }
  | { type: "disconnect" }
  | { type: "loadRepositories"; search?: string }
  | { type: "loadBranches"; owner: string; repository: string }
  | { type: "refreshProject"; project: Pick<Project, "id" | "githubOwner" | "githubRepo" | "branch"> }
  | { type: "loadMoreCommitHistory"; project: Pick<Project, "id" | "githubOwner" | "githubRepo" | "branch"> };

function githubStateFromController(
  github: GitHubIntegrationController,
): ProjectWorkspaceGitHubState {
  return {
    status: github.status,
    deviceFlow: github.deviceFlow,
    repositories: github.repositories,
    repositoryLoadState: github.repositoryLoadState,
    branches: github.branches,
    readStates: { ...github.readStates },
    statusCheckError: github.statusCheckError,
    error: github.error,
    busy: github.busy,
  };
}

export function useProjectWorkspaceHost({
  state,
  github,
  actions,
}: {
  state: ProjectWorkspaceState;
  github: GitHubIntegrationController;
  actions: DevControlActions;
}) {
  const stateRef = useRef(state);
  const actionsRef = useRef(actions);
  const githubRef = useRef(github);
  const pendingSelectionRef = useRef<ProjectWorkspaceSelection | null>(null);
  const readyRef = useRef(false);
  const emitRef = useRef<((event: string, payload?: unknown) => Promise<void>) | null>(null);

  stateRef.current = state;
  actionsRef.current = actions;
  githubRef.current = github;

  const emitState = useCallback(async () => {
    await emitRef.current?.(PROJECT_WORKSPACE_STATE_EVENT, stateRef.current);
  }, []);

  useEffect(() => {
    if (!getPlatformCapabilities().isTauriDesktop) return;

    let cancelled = false;
    let unlistenReady: (() => void) | null = null;
    let unlistenMutation: (() => void) | null = null;
    let unlistenGitHub: (() => void) | null = null;

    void (async () => {
      const { emit, listen } = await import("@tauri-apps/api/event");
      if (cancelled) return;

      emitRef.current = (event, payload) => emit(event, payload);
      unlistenReady = await listen<ProjectWorkspaceSelection | null>(
        PROJECT_WORKSPACE_READY_EVENT,
        () => {
          readyRef.current = true;
          void emitState();
          if (pendingSelectionRef.current) {
            void emit(
              PROJECT_WORKSPACE_OPEN_EVENT,
              pendingSelectionRef.current,
            );
          }
        },
      );
      unlistenMutation = await listen<ProjectWorkspaceMutation>(
        PROJECT_WORKSPACE_MUTATION_EVENT,
        ({ payload }) => {
          const current = actionsRef.current;
          switch (payload.type) {
            case "addProject":
              current.addProject(payload.input);
              break;
            case "updateProject":
              current.updateProject(payload.id, payload.changes);
              break;
            case "deleteProject":
              current.deleteProject(payload.id);
              break;
            case "addProjectMilestone":
              current.addProjectMilestone(payload.projectId, payload.title, payload.status);
              break;
            case "updateProjectMilestone":
              current.updateProjectMilestone(payload.id, payload.changes);
              break;
            case "deleteProjectMilestone":
              current.deleteProjectMilestone(payload.id);
              break;
            case "addProjectAction":
              current.addProjectAction(payload.projectId, payload.title, payload.actionType, payload.status);
              break;
            case "planProjectAction":
              current.planProjectAction?.(payload.id, payload.date);
              break;
            case "updateProjectAction":
              current.updateProjectAction(payload.id, payload.changes);
              break;
            case "deleteProjectAction":
              current.deleteProjectAction(payload.id);
              break;
            case "addProjectIdea":
              current.addProjectIdea(payload.projectId, payload.title);
              break;
            case "updateProjectIdea":
              current.updateProjectIdea(payload.id, payload.changes);
              break;
            case "deleteProjectIdea":
              current.deleteProjectIdea(payload.id);
              break;
            case "addProjectHistory":
              current.addProjectHistory(
                payload.projectId,
                payload.summary,
                payload.historyType,
                payload.occurredAt,
                payload.githubRef,
              );
              break;
            case "updateProjectHistory":
              current.updateProjectHistory(payload.id, payload.changes);
              break;
            case "deleteProjectHistory":
              current.deleteProjectHistory(payload.id);
              break;
            case "addKnowledgeDocument":
              void current.addKnowledgeDocument(payload.input);
              break;
            case "createKnowledgeDocumentForProjects":
              void current.createKnowledgeDocumentForProjects(payload.input);
              break;
            case "updateKnowledgeDocument":
              void current.updateKnowledgeDocument(payload.id, payload.changes);
              break;
            case "deleteKnowledgeDocument":
              current.deleteKnowledgeDocument(payload.id);
              break;
            case "openKnowledgeDocument":
              void current.openKnowledgeDocument(payload.document);
              break;
          }
        },
      );
      unlistenGitHub = await listen<ProjectWorkspaceGitHubCommand>(
        PROJECT_WORKSPACE_GITHUB_EVENT,
        ({ payload }) => {
          const current = githubRef.current;
          switch (payload.type) {
            case "refreshStatus":
              void current.refreshStatus();
              break;
            case "connect":
              void current.connect();
              break;
            case "pollDeviceFlow":
              void current.pollDeviceFlow();
              break;
            case "cancelDeviceFlow":
              void current.cancelDeviceFlow();
              break;
            case "disconnect":
              void current.disconnect();
              break;
            case "loadRepositories":
              void current.loadRepositories(payload.search);
              break;
            case "loadBranches":
              void current.loadBranches(payload.owner, payload.repository);
              break;
            case "refreshProject":
              void current.refreshProject(payload.project);
              break;
            case "loadMoreCommitHistory":
              void current.loadMoreCommitHistory(payload.project);
              break;
          }
        },
      );
    })();

    return () => {
      cancelled = true;
      readyRef.current = false;
      emitRef.current = null;
      unlistenReady?.();
      unlistenMutation?.();
      unlistenGitHub?.();
    };
  }, [emitState]);

  useEffect(() => {
    if (readyRef.current) void emitState();
  }, [emitState, state]);

  const openWorkspace = useCallback(
    async (selection: ProjectWorkspaceSelection) => {
      pendingSelectionRef.current = selection;
      await openProjectWorkspaceWindow();
      if (readyRef.current) {
        await emitRef.current?.(PROJECT_WORKSPACE_STATE_EVENT, stateRef.current);
        await emitRef.current?.(PROJECT_WORKSPACE_OPEN_EVENT, selection);
      }
    },
    [],
  );

  return { openWorkspace };
}

export function useProjectWorkspaceClient() {
  const [state, setState] = useState<ProjectWorkspaceState | null>(null);
  const [selection, setSelection] = useState<ProjectWorkspaceSelection>({
    mode: "view",
    projectId: null,
  });
  const emitRef = useRef<((event: string, payload?: unknown) => Promise<void>) | null>(null);

  useEffect(() => {
    let cancelled = false;
    let unlistenState: (() => void) | null = null;
    let unlistenOpen: (() => void) | null = null;

    void (async () => {
      const { emit, listen } = await import("@tauri-apps/api/event");
      if (cancelled) return;

      emitRef.current = (event, payload) => emit(event, payload);
      unlistenState = await listen<ProjectWorkspaceState>(
        PROJECT_WORKSPACE_STATE_EVENT,
        ({ payload }) => setState(payload),
      );
      unlistenOpen = await listen<ProjectWorkspaceSelection>(
        PROJECT_WORKSPACE_OPEN_EVENT,
        ({ payload }) => setSelection(payload),
      );
      await emit(PROJECT_WORKSPACE_READY_EVENT, null);
    })();

    return () => {
      cancelled = true;
      emitRef.current = null;
      unlistenState?.();
      unlistenOpen?.();
    };
  }, []);

  const emitMutation = useCallback(async (mutation: ProjectWorkspaceMutation) => {
    await emitRef.current?.(PROJECT_WORKSPACE_MUTATION_EVENT, mutation);
  }, []);
  const emitGitHub = useCallback(async (command: ProjectWorkspaceGitHubCommand) => {
    await emitRef.current?.(PROJECT_WORKSPACE_GITHUB_EVENT, command);
  }, []);

  const actions = useMemo<DevControlActions>(() => ({
    addProject: (input) => void emitMutation({ type: "addProject", input }),
    updateProject: (id, changes) => void emitMutation({ type: "updateProject", id, changes }),
    deleteProject: (id) => void emitMutation({ type: "deleteProject", id }),
    addProjectMilestone: (projectId, title, status) => void emitMutation({ type: "addProjectMilestone", projectId, title, status }),
    updateProjectMilestone: (id, changes) => void emitMutation({ type: "updateProjectMilestone", id, changes }),
    deleteProjectMilestone: (id) => void emitMutation({ type: "deleteProjectMilestone", id }),
    addProjectAction: (projectId, title, actionType, status) => void emitMutation({ type: "addProjectAction", projectId, title, actionType, status }),
    planProjectAction: (id, date) => void emitMutation({ type: "planProjectAction", id, date }),
    updateProjectAction: (id, changes) => void emitMutation({ type: "updateProjectAction", id, changes }),
    deleteProjectAction: (id) => void emitMutation({ type: "deleteProjectAction", id }),
    addProjectIdea: (projectId, title) => void emitMutation({ type: "addProjectIdea", projectId, title }),
    updateProjectIdea: (id, changes) => void emitMutation({ type: "updateProjectIdea", id, changes }),
    deleteProjectIdea: (id) => void emitMutation({ type: "deleteProjectIdea", id }),
    addProjectHistory: (projectId, summary, historyType, occurredAt, githubRef) => void emitMutation({ type: "addProjectHistory", projectId, summary, historyType, occurredAt, githubRef }),
    updateProjectHistory: (id, changes) => void emitMutation({ type: "updateProjectHistory", id, changes }),
    deleteProjectHistory: (id) => void emitMutation({ type: "deleteProjectHistory", id }),
    addKnowledgeDocument: async (input) => {
      await emitMutation({ type: "addKnowledgeDocument", input });
      return null;
    },
    createKnowledgeDocumentForProjects: async (input) => {
      await emitMutation({ type: "createKnowledgeDocumentForProjects", input });
      return null;
    },
    updateKnowledgeDocument: (id, changes) =>
      emitMutation({ type: "updateKnowledgeDocument", id, changes }),
    deleteKnowledgeDocument: (id) =>
      void emitMutation({ type: "deleteKnowledgeDocument", id }),
    openKnowledgeDocument: (document) =>
      emitMutation({ type: "openKnowledgeDocument", document }),
    addWorkstream: () => undefined,
    updateWorkstream: () => undefined,
    deleteWorkstream: () => undefined,
    addWorkstreamProject: () => undefined,
    deleteWorkstreamProject: () => undefined,
    addWorkstreamMilestone: () => undefined,
    updateWorkstreamMilestone: () => undefined,
    deleteWorkstreamMilestone: () => undefined,
    addWorkstreamAction: () => undefined,
    updateWorkstreamAction: () => undefined,
    deleteWorkstreamAction: () => undefined,
    addWorkstreamActionProject: () => undefined,
    deleteWorkstreamActionProject: () => undefined,
    addWorkstreamActionDependency: () => undefined,
    deleteWorkstreamActionDependency: () => undefined,
  }), [emitMutation]);

  const github = useMemo<GitHubIntegrationController>(() => {
    const current = state?.github;
    if (!current) return unavailableGitHubIntegration;
    return {
      ...current,
      refreshStatus: () => emitGitHub({ type: "refreshStatus" }),
      connect: () => emitGitHub({ type: "connect" }),
      pollDeviceFlow: () => emitGitHub({ type: "pollDeviceFlow" }),
      cancelDeviceFlow: () => emitGitHub({ type: "cancelDeviceFlow" }),
      disconnect: () => emitGitHub({ type: "disconnect" }),
      loadRepositories: (search) => emitGitHub({ type: "loadRepositories", search }),
      loadBranches: (owner, repository) => emitGitHub({ type: "loadBranches", owner, repository }),
      refreshProject: (project) => emitGitHub({ type: "refreshProject", project }),
      loadMoreCommitHistory: (project) => emitGitHub({ type: "loadMoreCommitHistory", project }),
    };
  }, [emitGitHub, state?.github]);

  return { actions, github, selection, state };
}

export function projectWorkspaceStateFromRuntime({
  projectTaskLinks,
  taskPlanningError,
  projects,
  projectMilestones,
  projectActions,
  projectIdeas,
  projectHistory,
  workstreams,
  workstreamProjects,
  workstreamMilestones,
  workstreamActions,
  workstreamActionProjects,
  workstreamActionDependencies,
  knowledgeDocuments,
  selectedProjectId,
  github,
}: Omit<ProjectWorkspaceState, "github"> & { github: GitHubIntegrationController }): ProjectWorkspaceState {
  return {
    projectTaskLinks,
    taskPlanningError,
    projects,
    projectMilestones,
    projectActions,
    projectIdeas,
    projectHistory,
    workstreams,
    workstreamProjects,
    workstreamMilestones,
    workstreamActions,
    workstreamActionProjects,
    workstreamActionDependencies,
    knowledgeDocuments,
    selectedProjectId,
    github: githubStateFromController(github),
  };
}

export const emptyProjectWorkspaceState: ProjectWorkspaceState = {
  projects: [],
  projectMilestones: [],
  projectActions: [],
  projectIdeas: [],
  projectHistory: [],
  workstreams: [],
  workstreamProjects: [],
  workstreamMilestones: [],
  workstreamActions: [],
  workstreamActionProjects: [],
  workstreamActionDependencies: [],
  knowledgeDocuments: [],
  selectedProjectId: null,
  github: {
    status: disconnectedGitHubStatus,
    deviceFlow: null,
    repositories: [],
    repositoryLoadState: { loading: false, diagnostic: null, error: null },
    branches: [],
    readStates: {},
    statusCheckError: null,
    error: null,
    busy: false,
  },
};
