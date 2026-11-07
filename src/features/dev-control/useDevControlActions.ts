import { useCallback } from "react";

import type { SnapshotUpdater } from "../../app/sync/useSnapshotStore";
import type { Device, KnowledgeDocument, LocalDataSnapshot } from "../../types";
import type {
  BackfillInput,
  DevActionStatus,
  DevActionType,
  DevHistoryType,
  DevMilestoneStatus,
  DevProjectStatus,
  DevWorkstreamStatus,
  KnowledgeDocumentType,
} from "../../types";
import { createId } from "../../lib/storage/id";
import {
  createKnowledgeDocument,
  createKnowledgeDocumentFile,
  openKnowledgeDocumentFile,
  resolveKnowledgeDocumentRelativePath,
  softDeleteKnowledgeDocument,
  updateKnowledgeDocument,
  updateKnowledgeDocumentFile,
  type KnowledgeDocumentChanges,
} from "../knowledge-vault/knowledgeVaultService";
import {
  createProject,
  createProjectAction,
  createProjectHistory,
  createProjectIdea,
  createProjectMilestone,
  softDeleteProject,
  softDeleteProjectAction,
  softDeleteProjectHistory,
  softDeleteProjectIdea,
  softDeleteProjectMilestone,
  updateProject,
  updateProjectAction,
  updateProjectHistory,
  updateProjectIdea,
  updateProjectMilestone,
  createWorkstream,
  createWorkstreamAction,
  createWorkstreamActionDependency,
  createWorkstreamActionProject,
  createWorkstreamMilestone,
  createWorkstreamProject,
  isWorkstreamActionDependencyAllowed,
  restoreWorkstreamActionDependency,
  restoreWorkstreamActionProject,
  restoreWorkstreamProject,
  softDeleteWorkstream,
  softDeleteWorkstreamAction,
  softDeleteWorkstreamActionDependency,
  softDeleteWorkstreamActionProject,
  softDeleteWorkstreamMilestone,
  softDeleteWorkstreamProject,
  updateWorkstream,
  updateWorkstreamAction,
  updateWorkstreamMilestone,
} from "./devControlService";
import type {
  ProjectActionChanges,
  ProjectChanges,
  ProjectHistoryChanges,
  ProjectIdeaChanges,
  ProjectMilestoneChanges,
  WorkstreamActionChanges,
  WorkstreamChanges,
  WorkstreamMilestoneChanges,
} from "./devControlService";

interface UseDevControlActionsOptions {
  commitSnapshot: (updater: SnapshotUpdater) => void;
  snapshot: LocalDataSnapshot;
  device: Device | null;
  selectedProjectId: string | null;
  setSelectedProjectId: (id: string | null) => void;
  selectedWorkstreamId: string | null;
  setSelectedWorkstreamId: (id: string | null) => void;
}

export interface DevControlActions {
  planProjectAction?: (id: string, date?: string) => void;
  addProject: (input: {
    name: string;
    description?: string;
    repository: string | null;
    branch: string | null;
    githubRepositoryId?: string | null;
    githubOwner?: string | null;
    githubRepo?: string | null;
    status: DevProjectStatus;
    currentSummary: string;
    targetSummary: string;
    lastVerifiedCommit: string | null;
    lastVerifiedAt: string | null;
    backfillInput?: BackfillInput;
  }) => void;
  updateProject: (id: string, changes: ProjectChanges) => void;
  deleteProject: (id: string) => void;
  addProjectMilestone: (projectId: string, title: string, status?: DevMilestoneStatus) => void;
  updateProjectMilestone: (id: string, changes: ProjectMilestoneChanges) => void;
  deleteProjectMilestone: (id: string) => void;
  addProjectAction: (projectId: string, title: string, type?: DevActionType, status?: DevActionStatus) => void;
  updateProjectAction: (id: string, changes: ProjectActionChanges) => void;
  deleteProjectAction: (id: string) => void;
  addProjectIdea: (projectId: string, title: string) => void;
  updateProjectIdea: (id: string, changes: ProjectIdeaChanges) => void;
  deleteProjectIdea: (id: string) => void;
  addProjectHistory: (
    projectId: string,
    summary: string,
    type?: DevHistoryType,
    occurredAt?: string,
    githubRef?: string | null,
  ) => void;
  updateProjectHistory: (id: string, changes: ProjectHistoryChanges) => void;
  deleteProjectHistory: (id: string) => void;
  addWorkstream: (input: {
    name: string;
    status: DevWorkstreamStatus;
    projectIds: string[];
    backfillInput?: BackfillInput;
  }) => void;
  updateWorkstream: (id: string, changes: WorkstreamChanges) => void;
  deleteWorkstream: (id: string) => void;
  addWorkstreamProject: (workstreamId: string, projectId: string) => void;
  deleteWorkstreamProject: (id: string) => void;
  addWorkstreamMilestone: (
    workstreamId: string,
    title: string,
    status?: DevMilestoneStatus,
  ) => void;
  updateWorkstreamMilestone: (
    id: string,
    changes: WorkstreamMilestoneChanges,
  ) => void;
  deleteWorkstreamMilestone: (id: string) => void;
  addWorkstreamAction: (
    workstreamId: string,
    title: string,
    type?: DevActionType,
    status?: DevActionStatus,
  ) => void;
  updateWorkstreamAction: (
    id: string,
    changes: WorkstreamActionChanges,
  ) => void;
  deleteWorkstreamAction: (id: string) => void;
  addWorkstreamActionProject: (actionId: string, projectId: string) => void;
  deleteWorkstreamActionProject: (id: string) => void;
  addWorkstreamActionDependency: (
    actionId: string,
    dependsOnActionId: string,
  ) => void;
  deleteWorkstreamActionDependency: (id: string) => void;
  addKnowledgeDocument: (input: {
    title: string;
    type: KnowledgeDocumentType;
    projectId: string | null;
    workstreamId: string | null;
    backfillInput?: BackfillInput;
  }) => Promise<KnowledgeDocument | null>;
  createKnowledgeDocumentForProjects: (input: {
    title: string;
    type: KnowledgeDocumentType;
    projectIds: string[];
    workstreamId?: string | null;
    addProjectIds?: string[];
    newWorkstream?: {
      name: string;
      status: DevWorkstreamStatus;
    };
    backfillInput?: BackfillInput;
  }) => Promise<KnowledgeDocument | null>;
  updateKnowledgeDocument: (
    id: string,
    changes: KnowledgeDocumentChanges,
  ) => Promise<void>;
  deleteKnowledgeDocument: (id: string) => void;
  openKnowledgeDocument: (document: KnowledgeDocument) => Promise<void>;
}

export function useDevControlActions({
  commitSnapshot,
  snapshot,
  device,
  selectedProjectId,
  setSelectedProjectId,
  selectedWorkstreamId,
  setSelectedWorkstreamId,
}: UseDevControlActionsOptions): DevControlActions {
  const addProject = useCallback(
    (input: Parameters<DevControlActions["addProject"]>[0]) => {
      if (!device) return;
      const project = createProject(device.id, input, input.backfillInput);
      commitSnapshot((snapshot) => ({ ...snapshot, projects: [...snapshot.projects, project] }));
      setSelectedProjectId(project.id);
    },
    [commitSnapshot, device, setSelectedProjectId],
  );

  const updateProjectById = useCallback(
    (id: string, changes: ProjectChanges) => {
      if (!device) return;
      commitSnapshot((snapshot) => ({
        ...snapshot,
        projects: snapshot.projects.map((project) =>
          project.id === id ? updateProject(project, changes, device.id) : project,
        ),
      }));
    },
    [commitSnapshot, device],
  );

  const deleteProject = useCallback(
    (id: string) => {
      if (!device) return;
      commitSnapshot((snapshot) => ({
        ...snapshot,
        projects: snapshot.projects.map((project) =>
          project.id === id ? softDeleteProject(project, device.id) : project,
        ),
      }));
      if (selectedProjectId === id) setSelectedProjectId(null);
    },
    [commitSnapshot, device, selectedProjectId, setSelectedProjectId],
  );

  const addProjectMilestone = useCallback(
    (projectId: string, title: string, status: DevMilestoneStatus = "PLANNED") => {
      if (!device) return;
      const milestone = createProjectMilestone(projectId, title, device.id, status);
      commitSnapshot((snapshot) => ({ ...snapshot, projectMilestones: [...snapshot.projectMilestones, milestone] }));
    },
    [commitSnapshot, device],
  );
  const updateProjectMilestoneById = useCallback(
    (id: string, changes: ProjectMilestoneChanges) => {
      if (!device) return;
      commitSnapshot((snapshot) => ({
        ...snapshot,
        projectMilestones: snapshot.projectMilestones.map((item) =>
          item.id === id ? updateProjectMilestone(item, changes, device.id) : item,
        ),
      }));
    },
    [commitSnapshot, device],
  );
  const deleteProjectMilestone = useCallback(
    (id: string) => {
      if (!device) return;
      commitSnapshot((snapshot) => ({
        ...snapshot,
        projectMilestones: snapshot.projectMilestones.map((item) =>
          item.id === id ? softDeleteProjectMilestone(item, device.id) : item,
        ),
      }));
    },
    [commitSnapshot, device],
  );

  const addProjectAction = useCallback(
    (projectId: string, title: string, type: DevActionType = "NEXT", status: DevActionStatus = "OPEN") => {
      if (!device) return;
      const action = createProjectAction(projectId, title, device.id, type, status);
      commitSnapshot((snapshot) => ({ ...snapshot, projectActions: [...snapshot.projectActions, action] }));
    },
    [commitSnapshot, device],
  );
  const updateProjectActionById = useCallback(
    (id: string, changes: ProjectActionChanges) => {
      if (!device) return;
      commitSnapshot((snapshot) => ({
        ...snapshot,
        projectActions: snapshot.projectActions.map((item) =>
          item.id === id ? updateProjectAction(item, changes, device.id) : item,
        ),
      }));
    },
    [commitSnapshot, device],
  );
  const deleteProjectAction = useCallback(
    (id: string) => {
      if (!device) return;
      commitSnapshot((snapshot) => ({
        ...snapshot,
        projectActions: snapshot.projectActions.map((item) =>
          item.id === id ? softDeleteProjectAction(item, device.id) : item,
        ),
      }));
    },
    [commitSnapshot, device],
  );

  const addProjectIdea = useCallback(
    (projectId: string, title: string) => {
      if (!device) return;
      const idea = createProjectIdea(projectId, title, device.id);
      commitSnapshot((snapshot) => ({ ...snapshot, projectIdeas: [...snapshot.projectIdeas, idea] }));
    },
    [commitSnapshot, device],
  );
  const updateProjectIdeaById = useCallback(
    (id: string, changes: ProjectIdeaChanges) => {
      if (!device) return;
      commitSnapshot((snapshot) => ({
        ...snapshot,
        projectIdeas: snapshot.projectIdeas.map((item) =>
          item.id === id ? updateProjectIdea(item, changes, device.id) : item,
        ),
      }));
    },
    [commitSnapshot, device],
  );
  const deleteProjectIdea = useCallback(
    (id: string) => {
      if (!device) return;
      commitSnapshot((snapshot) => ({
        ...snapshot,
        projectIdeas: snapshot.projectIdeas.map((item) =>
          item.id === id ? softDeleteProjectIdea(item, device.id) : item,
        ),
      }));
    },
    [commitSnapshot, device],
  );

  const addProjectHistory = useCallback(
    (
      projectId: string,
      summary: string,
      type: DevHistoryType = "NOTE",
      occurredAt?: string,
      githubRef: string | null = null,
    ) => {
      if (!device) return;
      const history = createProjectHistory(
        projectId,
        summary,
        device.id,
        type,
        occurredAt ?? new Date().toISOString(),
        githubRef,
      );
      commitSnapshot((snapshot) => ({ ...snapshot, projectHistory: [...snapshot.projectHistory, history] }));
    },
    [commitSnapshot, device],
  );
  const updateProjectHistoryById = useCallback(
    (id: string, changes: ProjectHistoryChanges) => {
      if (!device) return;
      commitSnapshot((snapshot) => ({
        ...snapshot,
        projectHistory: snapshot.projectHistory.map((item) =>
          item.id === id ? updateProjectHistory(item, changes, device.id) : item,
        ),
      }));
    },
    [commitSnapshot, device],
  );
  const deleteProjectHistory = useCallback(
    (id: string) => {
      if (!device) return;
      commitSnapshot((snapshot) => ({
        ...snapshot,
        projectHistory: snapshot.projectHistory.map((item) =>
          item.id === id ? softDeleteProjectHistory(item, device.id) : item,
        ),
      }));
    },
    [commitSnapshot, device],
  );

  const addWorkstream = useCallback(
    (input: Parameters<DevControlActions["addWorkstream"]>[0]) => {
      if (!device) return;
      const workstream = createWorkstream(device.id, input, input.backfillInput);
      const requestedProjectIds = new Set(input.projectIds);
      commitSnapshot((snapshot) => {
        const projectIds = snapshot.projects
          .filter(
            (project) =>
              project.deletedAt === null && requestedProjectIds.has(project.id),
          )
          .map((project) => project.id);
        const links = projectIds.map((projectId) =>
          createWorkstreamProject(workstream.id, projectId, device.id),
        );
        return {
          ...snapshot,
          workstreams: [...snapshot.workstreams, workstream],
          workstreamProjects: [...snapshot.workstreamProjects, ...links],
        };
      });
      setSelectedWorkstreamId(workstream.id);
    },
    [commitSnapshot, device, setSelectedWorkstreamId],
  );

  const updateWorkstreamById = useCallback(
    (id: string, changes: WorkstreamChanges) => {
      if (!device) return;
      commitSnapshot((snapshot) => ({
        ...snapshot,
        workstreams: snapshot.workstreams.map((item) =>
          item.id === id ? updateWorkstream(item, changes, device.id) : item,
        ),
      }));
    },
    [commitSnapshot, device],
  );

  const deleteWorkstream = useCallback(
    (id: string) => {
      if (!device) return;
      commitSnapshot((snapshot) => ({
        ...snapshot,
        workstreams: snapshot.workstreams.map((item) =>
          item.id === id ? softDeleteWorkstream(item, device.id) : item,
        ),
      }));
      if (selectedWorkstreamId === id) setSelectedWorkstreamId(null);
    },
    [commitSnapshot, device, selectedWorkstreamId, setSelectedWorkstreamId],
  );

  const addWorkstreamProject = useCallback(
    (workstreamId: string, projectId: string) => {
      if (!device) return;
      commitSnapshot((snapshot) => {
        const workstream = snapshot.workstreams.find(
          (item) => item.id === workstreamId && item.deletedAt === null,
        );
        const project = snapshot.projects.find(
          (item) => item.id === projectId && item.deletedAt === null,
        );
        if (!workstream || !project) return snapshot;

        const existing = snapshot.workstreamProjects.find(
          (item) =>
            item.workstreamId === workstreamId && item.projectId === projectId,
        );
        if (existing) {
          if (existing.deletedAt === null) return snapshot;
          return {
            ...snapshot,
            workstreamProjects: snapshot.workstreamProjects.map((item) =>
              item.id === existing.id
                ? restoreWorkstreamProject(item, device.id)
                : item,
            ),
          };
        }

        return {
          ...snapshot,
          workstreamProjects: [
            ...snapshot.workstreamProjects,
            createWorkstreamProject(workstreamId, projectId, device.id),
          ],
        };
      });
    },
    [commitSnapshot, device],
  );

  const deleteWorkstreamProject = useCallback(
    (id: string) => {
      if (!device) return;
      commitSnapshot((snapshot) => {
        const participation = snapshot.workstreamProjects.find(
          (item) => item.id === id,
        );
        if (!participation) return snapshot;

        const workstreamActionIds = new Set(
          snapshot.workstreamActions
            .filter(
              (item) =>
                item.workstreamId === participation.workstreamId &&
                item.deletedAt === null,
            )
            .map((item) => item.id),
        );

        return {
          ...snapshot,
          workstreamProjects: snapshot.workstreamProjects.map((item) =>
            item.id === id ? softDeleteWorkstreamProject(item, device.id) : item,
          ),
          workstreamActionProjects: snapshot.workstreamActionProjects.map(
            (item) =>
              item.deletedAt === null &&
              item.projectId === participation.projectId &&
              workstreamActionIds.has(item.actionId)
                ? softDeleteWorkstreamActionProject(item, device.id)
                : item,
          ),
        };
      });
    },
    [commitSnapshot, device],
  );

  const addWorkstreamMilestone = useCallback(
    (
      workstreamId: string,
      title: string,
      status: DevMilestoneStatus = "PLANNED",
    ) => {
      if (!device) return;
      const milestone = createWorkstreamMilestone(
        workstreamId,
        title,
        device.id,
        status,
      );
      commitSnapshot((snapshot) => {
        if (
          !snapshot.workstreams.some(
            (item) => item.id === workstreamId && item.deletedAt === null,
          )
        ) {
          return snapshot;
        }
        return {
          ...snapshot,
          workstreamMilestones: [...snapshot.workstreamMilestones, milestone],
        };
      });
    },
    [commitSnapshot, device],
  );

  const updateWorkstreamMilestoneById = useCallback(
    (id: string, changes: WorkstreamMilestoneChanges) => {
      if (!device) return;
      commitSnapshot((snapshot) => ({
        ...snapshot,
        workstreamMilestones: snapshot.workstreamMilestones.map((item) =>
          item.id === id
            ? updateWorkstreamMilestone(item, changes, device.id)
            : item,
        ),
      }));
    },
    [commitSnapshot, device],
  );

  const deleteWorkstreamMilestone = useCallback(
    (id: string) => {
      if (!device) return;
      commitSnapshot((snapshot) => ({
        ...snapshot,
        workstreamMilestones: snapshot.workstreamMilestones.map((item) =>
          item.id === id
            ? softDeleteWorkstreamMilestone(item, device.id)
            : item,
        ),
      }));
    },
    [commitSnapshot, device],
  );

  const addWorkstreamAction = useCallback(
    (
      workstreamId: string,
      title: string,
      type: DevActionType = "NEXT",
      status: DevActionStatus = "OPEN",
    ) => {
      if (!device) return;
      const action = createWorkstreamAction(
        workstreamId,
        title,
        device.id,
        type,
        status,
      );
      commitSnapshot((snapshot) => {
        if (
          !snapshot.workstreams.some(
            (item) => item.id === workstreamId && item.deletedAt === null,
          )
        ) {
          return snapshot;
        }
        return {
          ...snapshot,
          workstreamActions: [...snapshot.workstreamActions, action],
        };
      });
    },
    [commitSnapshot, device],
  );

  const updateWorkstreamActionById = useCallback(
    (id: string, changes: WorkstreamActionChanges) => {
      if (!device) return;
      commitSnapshot((snapshot) => ({
        ...snapshot,
        workstreamActions: snapshot.workstreamActions.map((item) =>
          item.id === id ? updateWorkstreamAction(item, changes, device.id) : item,
        ),
      }));
    },
    [commitSnapshot, device],
  );

  const deleteWorkstreamAction = useCallback(
    (id: string) => {
      if (!device) return;
      commitSnapshot((snapshot) => ({
        ...snapshot,
        workstreamActions: snapshot.workstreamActions.map((item) =>
          item.id === id ? softDeleteWorkstreamAction(item, device.id) : item,
        ),
      }));
    },
    [commitSnapshot, device],
  );

  const addWorkstreamActionProject = useCallback(
    (actionId: string, projectId: string) => {
      if (!device) return;
      commitSnapshot((snapshot) => {
        const action = snapshot.workstreamActions.find(
          (item) => item.id === actionId && item.deletedAt === null,
        );
        const project = snapshot.projects.find(
          (item) => item.id === projectId && item.deletedAt === null,
        );
        if (!action || !project) return snapshot;
        const isParticipating = snapshot.workstreamProjects.some(
          (item) =>
            item.workstreamId === action.workstreamId &&
            item.projectId === projectId &&
            item.deletedAt === null,
        );
        if (!isParticipating) return snapshot;

        const existing = snapshot.workstreamActionProjects.find(
          (item) => item.actionId === actionId && item.projectId === projectId,
        );
        if (existing) {
          if (existing.deletedAt === null) return snapshot;
          return {
            ...snapshot,
            workstreamActionProjects: snapshot.workstreamActionProjects.map(
              (item) =>
                item.id === existing.id
                  ? restoreWorkstreamActionProject(item, device.id)
                  : item,
            ),
          };
        }

        return {
          ...snapshot,
          workstreamActionProjects: [
            ...snapshot.workstreamActionProjects,
            createWorkstreamActionProject(actionId, projectId, device.id),
          ],
        };
      });
    },
    [commitSnapshot, device],
  );

  const deleteWorkstreamActionProject = useCallback(
    (id: string) => {
      if (!device) return;
      commitSnapshot((snapshot) => ({
        ...snapshot,
        workstreamActionProjects: snapshot.workstreamActionProjects.map((item) =>
          item.id === id
            ? softDeleteWorkstreamActionProject(item, device.id)
            : item,
        ),
      }));
    },
    [commitSnapshot, device],
  );

  const addWorkstreamActionDependency = useCallback(
    (actionId: string, dependsOnActionId: string) => {
      if (!device) return;
      commitSnapshot((snapshot) => {
        const action = snapshot.workstreamActions.find(
          (item) => item.id === actionId && item.deletedAt === null,
        );
        const dependsOnAction = snapshot.workstreamActions.find(
          (item) => item.id === dependsOnActionId && item.deletedAt === null,
        );
        if (
          !action ||
          !dependsOnAction ||
          action.workstreamId !== dependsOnAction.workstreamId ||
          !isWorkstreamActionDependencyAllowed(
            snapshot.workstreamActionDependencies,
            actionId,
            dependsOnActionId,
          )
        ) {
          return snapshot;
        }

        const existing = snapshot.workstreamActionDependencies.find(
          (item) =>
            item.actionId === actionId &&
            item.dependsOnActionId === dependsOnActionId,
        );
        if (existing) {
          if (existing.deletedAt === null) return snapshot;
          return {
            ...snapshot,
            workstreamActionDependencies:
              snapshot.workstreamActionDependencies.map((item) =>
                item.id === existing.id
                  ? restoreWorkstreamActionDependency(item, device.id)
                  : item,
              ),
          };
        }

        return {
          ...snapshot,
          workstreamActionDependencies: [
            ...snapshot.workstreamActionDependencies,
            createWorkstreamActionDependency(
              actionId,
              dependsOnActionId,
              device.id,
            ),
          ],
        };
      });
    },
    [commitSnapshot, device],
  );

  const deleteWorkstreamActionDependency = useCallback(
    (id: string) => {
      if (!device) return;
      commitSnapshot((snapshot) => ({
        ...snapshot,
        workstreamActionDependencies: snapshot.workstreamActionDependencies.map(
          (item) =>
            item.id === id
              ? softDeleteWorkstreamActionDependency(item, device.id)
              : item,
        ),
      }));
    },
    [commitSnapshot, device],
  );

  const addKnowledgeDocument = useCallback(
    async (input: Parameters<DevControlActions["addKnowledgeDocument"]>[0]) => {
      if (!device) return null;
      if (!input.title.trim()) throw new Error("문서 제목을 입력하세요.");
      if (input.projectId !== null && input.workstreamId !== null) {
        throw new Error("문서는 Project와 Workstream을 동시에 소유할 수 없습니다.");
      }

      const id = createId();
      const projectName = input.projectId
        ? snapshot.projects.find((project) => project.id === input.projectId)?.name ?? null
        : null;
      const workstreamName = input.workstreamId
        ? snapshot.workstreams.find((workstream) => workstream.id === input.workstreamId)?.name ?? null
        : null;
      const pathInput = {
        id,
        title: input.title,
        type: input.type,
        projectId: input.projectId,
        workstreamId: input.workstreamId,
        projectName,
        workstreamName,
      };
      const existingPaths = snapshot.knowledgeDocuments
        .filter((document) => document.deletedAt === null)
        .map((document) => document.relativePath);
      let document = createKnowledgeDocument(
        device.id,
        {
          id,
          title: input.title,
          type: input.type,
          projectId: input.projectId,
          workstreamId: input.workstreamId,
          relativePath: resolveKnowledgeDocumentRelativePath(pathInput, existingPaths),
        },
        input.backfillInput,
      );

      let result = await createKnowledgeDocumentFile({
        document,
        projectName,
        workstreamName,
      });
      if (result.status === "conflict") {
        const fallbackPath = resolveKnowledgeDocumentRelativePath(
          pathInput,
          [...existingPaths, document.relativePath],
        );
        if (fallbackPath === document.relativePath) {
          throw new Error("같은 경로의 Knowledge Document가 이미 있습니다.");
        }
        document = { ...document, relativePath: fallbackPath };
        result = await createKnowledgeDocumentFile({
          document,
          projectName,
          workstreamName,
        });
      }
      if (result.status === "conflict") {
        throw new Error("Knowledge Document 파일 경로 충돌을 해결하지 못했습니다.");
      }

      commitSnapshot((current) => ({
        ...current,
        knowledgeDocuments: [...current.knowledgeDocuments, document],
      }));
      return document;
    },
    [commitSnapshot, device, snapshot],
  );

  const createKnowledgeDocumentForProjects = useCallback(
    async (input: Parameters<DevControlActions["createKnowledgeDocumentForProjects"]>[0]) => {
      if (!device) return null;
      const title = input.title.trim();
      if (!title) throw new Error("문서 제목을 입력하세요.");

      const projectIds = [...new Set(input.projectIds)];
      if (projectIds.length === 0) throw new Error("연결할 Project를 선택하세요.");
      const activeProjects = projectIds.map((id) =>
        snapshot.projects.find((project) => project.id === id && project.deletedAt === null),
      );
      if (activeProjects.some((project) => !project)) {
        throw new Error("선택한 Project를 찾을 수 없습니다.");
      }

      let workstreamId: string | null = null;
      let workstream = null as LocalDataSnapshot["workstreams"][number] | null;
      let createdWorkstream = null as LocalDataSnapshot["workstreams"][number] | null;
      let workstreamLinks: LocalDataSnapshot["workstreamProjects"] = [];

      if (projectIds.length === 1) {
        if (input.workstreamId || input.newWorkstream) {
          throw new Error("단일 Project 문서는 Project 소유로 생성해야 합니다.");
        }
      } else if (input.newWorkstream && input.workstreamId) {
        throw new Error("기존 Workstream과 새 Workstream을 동시에 선택할 수 없습니다.");
      } else if (input.newWorkstream) {
        const workstreamName = input.newWorkstream.name.trim();
        if (!workstreamName) throw new Error("새 Workstream 이름을 입력하세요.");
        workstream = createWorkstream(device.id, {
          name: workstreamName,
          status: input.newWorkstream.status,
        }, input.backfillInput);
        const newWorkstream = workstream;
        createdWorkstream = newWorkstream;
        workstreamId = newWorkstream.id;
        workstreamLinks = projectIds.map((projectId) =>
          createWorkstreamProject(newWorkstream.id, projectId, device.id, input.backfillInput),
        );
      } else {
        if (!input.workstreamId) {
          throw new Error("다중 Project 문서는 Workstream을 선택하거나 새로 만들어야 합니다.");
        }
        workstream = snapshot.workstreams.find(
          (item) => item.id === input.workstreamId && item.deletedAt === null,
        ) ?? null;
        if (!workstream) throw new Error("선택한 Workstream을 찾을 수 없습니다.");
        const selectedWorkstream = workstream;
        workstreamId = selectedWorkstream.id;

        const selectedSet = new Set(projectIds);
        const existingLinks = snapshot.workstreamProjects.filter(
          (link) => link.workstreamId === selectedWorkstream.id && selectedSet.has(link.projectId),
        );
        const activeProjectIds = new Set(
          existingLinks.filter((link) => link.deletedAt === null).map((link) => link.projectId),
        );
        const addProjectIds = [...new Set(input.addProjectIds ?? [])];
        if (addProjectIds.some((id) => !selectedSet.has(id))) {
          throw new Error("Workstream에 추가할 Project는 문서에 선택된 Project여야 합니다.");
        }
        for (const projectId of projectIds) {
          if (!activeProjectIds.has(projectId) && !addProjectIds.includes(projectId)) {
            throw new Error("누락된 Project를 명시적으로 Workstream에 추가한 뒤 생성하세요.");
          }
        }
        workstreamLinks = addProjectIds.flatMap((projectId) => {
          const existing = existingLinks.find((link) => link.projectId === projectId);
          if (existing?.deletedAt === null) return [];
          if (existing) return [restoreWorkstreamProject(existing, device.id)];
          return [createWorkstreamProject(selectedWorkstream.id, projectId, device.id, input.backfillInput)];
        });
      }

      const project = activeProjects[0]!;
      const projectName = projectIds.length === 1 ? project.name : null;
      const workstreamName = workstream?.name ?? null;
      const id = createId();
      const pathInput = {
        id,
        title,
        type: input.type,
        projectId: projectIds.length === 1 ? projectIds[0] : null,
        workstreamId,
        projectName,
        workstreamName,
      };
      const existingPaths = snapshot.knowledgeDocuments
        .filter((document) => document.deletedAt === null)
        .map((document) => document.relativePath);
      let document = createKnowledgeDocument(
        device.id,
        {
          id,
          title,
          type: input.type,
          projectId: projectIds.length === 1 ? projectIds[0] : null,
          workstreamId,
          relativePath: resolveKnowledgeDocumentRelativePath(pathInput, existingPaths),
        },
        input.backfillInput,
      );
      let result = await createKnowledgeDocumentFile({ document, projectName, workstreamName });
      if (result.status === "conflict") {
        const fallbackPath = resolveKnowledgeDocumentRelativePath(
          pathInput,
          [...existingPaths, document.relativePath],
        );
        if (fallbackPath === document.relativePath) {
          throw new Error("같은 경로의 Knowledge Document가 이미 있습니다.");
        }
        document = { ...document, relativePath: fallbackPath };
        result = await createKnowledgeDocumentFile({ document, projectName, workstreamName });
      }
      if (result.status === "conflict") {
        throw new Error("Knowledge Document 파일 경로 충돌을 해결하지 못했습니다.");
      }

      commitSnapshot((current) => ({
        ...current,
        workstreams: createdWorkstream
          ? [...current.workstreams, createdWorkstream]
          : current.workstreams,
        workstreamProjects: workstreamLinks.length
          ? [...current.workstreamProjects, ...workstreamLinks]
          : current.workstreamProjects,
        knowledgeDocuments: [...current.knowledgeDocuments, document],
      }));
      return document;
    },
    [commitSnapshot, device, snapshot],
  );

  const updateKnowledgeDocumentById = useCallback(
    async (id: string, changes: KnowledgeDocumentChanges) => {
      if (!device) return;
      const current = snapshot.knowledgeDocuments.find(
        (document) => document.id === id && document.deletedAt === null,
      );
      if (!current) return;

      const nextProjectId = changes.projectId === undefined ? current.projectId : changes.projectId;
      const nextWorkstreamId = changes.workstreamId === undefined ? current.workstreamId : changes.workstreamId;
      const projectName = nextProjectId
        ? snapshot.projects.find((project) => project.id === nextProjectId)?.name ?? null
        : null;
      const workstreamName = nextWorkstreamId
        ? snapshot.workstreams.find((workstream) => workstream.id === nextWorkstreamId)?.name ?? null
        : null;
      const nextBase = updateKnowledgeDocument(current, changes, device.id);
      const next = {
        ...nextBase,
        relativePath: resolveKnowledgeDocumentRelativePath(
          {
            ...nextBase,
            projectName,
            workstreamName,
          },
          snapshot.knowledgeDocuments
            .filter((document) => document.id !== current.id && document.deletedAt === null)
            .map((document) => document.relativePath),
        ),
      };
      const result = await updateKnowledgeDocumentFile({
        document: next,
        currentRelativePath: current.relativePath,
        projectName,
        workstreamName,
      });
      if (result.status === "conflict") {
        throw new Error("Knowledge Document 파일 경로 충돌이 있습니다.");
      }
      commitSnapshot((currentSnapshot) => ({
        ...currentSnapshot,
        knowledgeDocuments: currentSnapshot.knowledgeDocuments.map((document) =>
          document.id === id ? next : document,
        ),
      }));
    },
    [commitSnapshot, device, snapshot],
  );

  const deleteKnowledgeDocument = useCallback(
    (id: string) => {
      if (!device) return;
      commitSnapshot((current) => ({
        ...current,
        knowledgeDocuments: current.knowledgeDocuments.map((document) =>
          document.id === id
            ? softDeleteKnowledgeDocument(document, device.id)
            : document,
        ),
      }));
    },
    [commitSnapshot, device],
  );

  const openKnowledgeDocument = useCallback(
    async (document: KnowledgeDocument) => {
      await openKnowledgeDocumentFile(document.relativePath);
    },
    [],
  );

  return {
    addProject,
    updateProject: updateProjectById,
    deleteProject,
    addProjectMilestone,
    updateProjectMilestone: updateProjectMilestoneById,
    deleteProjectMilestone,
    addProjectAction,
    updateProjectAction: updateProjectActionById,
    deleteProjectAction,
    addProjectIdea,
    updateProjectIdea: updateProjectIdeaById,
    deleteProjectIdea,
    addProjectHistory,
    updateProjectHistory: updateProjectHistoryById,
    deleteProjectHistory,
    addWorkstream,
    updateWorkstream: updateWorkstreamById,
    deleteWorkstream,
    addWorkstreamProject,
    deleteWorkstreamProject,
    addWorkstreamMilestone,
    updateWorkstreamMilestone: updateWorkstreamMilestoneById,
    deleteWorkstreamMilestone,
    addWorkstreamAction,
    updateWorkstreamAction: updateWorkstreamActionById,
    deleteWorkstreamAction,
    addWorkstreamActionProject,
    deleteWorkstreamActionProject,
    addWorkstreamActionDependency,
    deleteWorkstreamActionDependency,
    addKnowledgeDocument,
    createKnowledgeDocumentForProjects,
    updateKnowledgeDocument: updateKnowledgeDocumentById,
    deleteKnowledgeDocument,
    openKnowledgeDocument,
  };
}
