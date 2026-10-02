import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { describe, expect, it, vi } from "vitest";

import type { Project } from "../../../types";
import type { DevControlActions } from "../useDevControlActions";
import { ProjectWorkspace } from "./ProjectWorkspace";

const project: Project = {
  id: "project-1",
  name: "내 프로젝트",
  description: "",
  repository: "",
  branch: "",
  githubRepositoryId: null,
  githubOwner: null,
  githubRepo: null,
  status: "ACTIVE",
  currentSummary: "",
  targetSummary: "",
  lastVerifiedCommit: null,
  lastVerifiedAt: null,
  createdAt: "2026-10-02T00:00:00.000Z",
  updatedAt: "2026-10-02T00:00:00.000Z",
  deletedAt: null,
  deviceId: "device-1",
  isBackfilled: false,
  backfilledAt: null,
  backfillReason: null,
};

function renderWorkspace() {
  const addProjectAction = vi.fn();
  let renderer!: ReactTestRenderer;
  act(() => {
    renderer = create(
      <ProjectWorkspace
        mode="view"
        project={project}
        projects={[project]}
        projectMilestones={[]}
        projectActions={[]}
        projectIdeas={[]}
        projectHistory={[]}
        workstreams={[]}
        workstreamProjects={[]}
        workstreamMilestones={[]}
        workstreamActions={[]}
        workstreamActionProjects={[]}
        workstreamActionDependencies={[]}
        knowledgeDocuments={[]}
        actions={{ addProjectAction } as unknown as DevControlActions}
      />,
    );
  });
  return { renderer, addProjectAction };
}

describe("ProjectWorkspace Korean navigation", () => {
  it("opens overview, GitHub, plan, and history through the preserved workspace tabs", () => {
    const { renderer } = renderWorkspace();
    const tabs = renderer.root.findByType("nav").findAllByType("button");
    expect(tabs.map((tab) => tab.children.join(""))).toEqual(["개요", "GitHub", "계획", "변경 이력"]);
    expect(JSON.stringify(renderer.toJSON())).toContain("지식 문서");

    act(() => tabs[1]?.props.onClick());
    expect(JSON.stringify(renderer.toJSON())).toContain("GitHub 연결");
    act(() => tabs[2]?.props.onClick());
    expect(JSON.stringify(renderer.toJSON())).toContain("다음 작업 / 나중에 / 차단됨");
    act(() => tabs[3]?.props.onClick());
    expect(JSON.stringify(renderer.toJSON())).toContain("프로젝트 변경 이력");
    const releaseOption = renderer.root.findAllByType("option").find((option) => option.props.value === "RELEASE");
    expect(releaseOption?.children).toEqual(["출시"]);
    act(() => tabs[0]?.props.onClick());
    expect(JSON.stringify(renderer.toJSON())).toContain("프로젝트 개요");
    act(() => renderer.unmount());
  });

  it("shows Korean action choices while forwarding the original persisted enum values", () => {
    const { renderer, addProjectAction } = renderWorkspace();
    act(() => renderer.root.findByType("nav").findAllByType("button")[2]?.props.onClick());
    const actionForm = renderer.root.findAllByType("form")[1]!;
    expect(actionForm.findAllByType("option").map((option) => [option.props.value, option.children.join("")])).toEqual([
      ["NEXT", "다음 작업"], ["LATER", "나중에"], ["BLOCKED", "차단됨"],
    ]);
    act(() => {
      actionForm.findByType("input").props.onChange({ target: { value: "자료 정리" } });
      actionForm.findByType("select").props.onChange({ target: { value: "LATER" } });
    });
    act(() => actionForm.props.onSubmit({ preventDefault: vi.fn() }));
    expect(addProjectAction).toHaveBeenCalledWith("project-1", "자료 정리", "LATER", "OPEN");
    act(() => renderer.unmount());
  });
});
