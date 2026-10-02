import { useThemeMode } from "../../../app/useThemeMode";
import { ProjectWorkspace } from "./ProjectWorkspace";
import {
  emptyProjectWorkspaceState,
  useProjectWorkspaceClient,
} from "./projectWorkspaceBridge";

export function ProjectWorkspaceApp() {
  useThemeMode();
  const { actions, github, selection, state } = useProjectWorkspaceClient();
  const workspaceState = state ?? emptyProjectWorkspaceState;
  const project = workspaceState.projects.find((item) => item.id === selection.projectId) ?? null;

  if (!state) {
    return (
      <main className="app-shell flex items-center justify-center bg-slate-100 text-sm text-slate-500 dark:bg-black dark:text-neutral-400">
        프로젝트 작업 공간을 연결하는 중입니다…
      </main>
    );
  }

  return (
    <ProjectWorkspace
      mode={selection.mode}
      project={project}
      projects={workspaceState.projects}
      projectMilestones={workspaceState.projectMilestones}
      projectActions={workspaceState.projectActions}
      projectIdeas={workspaceState.projectIdeas}
      projectHistory={workspaceState.projectHistory}
      workstreams={workspaceState.workstreams}
      workstreamProjects={workspaceState.workstreamProjects}
      workstreamMilestones={workspaceState.workstreamMilestones}
      workstreamActions={workspaceState.workstreamActions}
      workstreamActionProjects={workspaceState.workstreamActionProjects}
      workstreamActionDependencies={workspaceState.workstreamActionDependencies}
      knowledgeDocuments={workspaceState.knowledgeDocuments}
      actions={actions}
      github={github}
    />
  );
}
