import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { describe, expect, it, vi } from "vitest";

import { DevControlPanel, getDerivedProjectCardSummary } from "./DevControlPanel";
import type { Project } from "../../types";
import type { DevControlActions } from "./useDevControlActions";

function project(): Project {
  return {
    id: "project-1",
    createdAt: "2026-08-01T00:00:00.000Z",
    isBackfilled: false,
    backfilledAt: null,
    backfillReason: null,
    name: "Personal OS",
    description: "",
    repository: "https://github.com/octo/personal-os",
    branch: "main",
    githubRepositoryId: "42",
    githubOwner: "octo",
    githubRepo: "personal-os",
    status: "ACTIVE",
    currentSummary: "Workspace를 분리하는 중",
    targetSummary: "Command Center와 Workspace 분리",
    lastVerifiedCommit: "a".repeat(40),
    lastVerifiedAt: "2026-08-01T00:00:00.000Z",
    updatedAt: "2026-08-01T00:00:00.000Z",
    deletedAt: null,
    deviceId: "device-a",
  };
}

function renderPanel(actions?: DevControlActions): { renderer: ReactTestRenderer; open: ReturnType<typeof vi.fn>; createProject: ReturnType<typeof vi.fn> } {
  const open = vi.fn();
  const createProject = vi.fn();
  const renderer = create(
    <DevControlPanel
      projects={[project()]}
      projectMilestones={[]}
      projectActions={[]}
      projectIdeas={[]}
      projectHistory={[]}
      selectedProjectId={null}
      onOpenProjectWorkspace={open}
      onCreateProjectWorkspace={createProject}
      actions={actions}
    />,
  );
  return { renderer, open, createProject };
}

describe("DevControlPanel command center", () => {
  it("derives the card status from OPEN NEXT, remote HEAD, then project status", () => {
    expect(
      getDerivedProjectCardSummary(project(), [{
        deletedAt: null,
        type: "NEXT",
        status: "OPEN",
        title: "Repository observation 분리",
      }], "HEAD commit message"),
    ).toBe("Repository observation 분리");
    expect(getDerivedProjectCardSummary(project(), [], "HEAD commit message\nbody")).toBe("HEAD commit message");
    expect(getDerivedProjectCardSummary(project(), [], null)).toBe("진행 중");
  });

  it("shows a compact project scan and opens the workspace on project click", () => {
    const { renderer, open } = renderPanel();

    expect(renderer.root.findAllByType("form")).toHaveLength(0);
    expect(renderer.root.findByType("h2").children.join("")).toBe("프로젝트");
    expect(renderer.root.findAllByType("button").some((button) => button.children.join("") === "워크스트림")).toBe(true);
    expect(renderer.root.findAllByType("span").some((node) => node.children.join("") === "Personal OS")).toBe(true);

    act(() => {
      renderer.root.findAllByType("button").find((button) =>
        button.findAllByType("span").some((span) => span.children.join("") === "Personal OS"),
      )?.props.onClick();
    });

    expect(open).toHaveBeenCalledWith("project-1");
  });

  it("opens create mode without rendering project editing controls", () => {
    const { renderer, createProject } = renderPanel();

    act(() => {
      renderer.root.findAllByType("button").find((button) => button.children.join("") === "새 프로젝트")?.props.onClick();
    });

    expect(createProject).toHaveBeenCalledTimes(1);
    expect(renderer.root.findAllByType("form")).toHaveLength(0);
  });

  it("opens workstreams and preserves creating a shared project operation", () => {
    const addWorkstream = vi.fn();
    const { renderer } = renderPanel({ addWorkstream } as unknown as DevControlActions);
    act(() => {
      renderer.root.findAllByType("button").find((button) => button.children.join("") === "워크스트림")?.props.onClick();
    });
    act(() => {
      renderer.root.findAllByType("button").find((button) => button.children.join("") === "새 워크스트림")?.props.onClick();
    });
    const form = renderer.root.findByType("form");
    act(() => {
      form.findByType("input").props.onChange({ target: { value: "공통 출시" } });
      form.findByType("select").props.onChange({ target: { value: "ACTIVE" } });
      renderer.root.findAllByType("input").find((input) => input.props.type === "checkbox")?.props.onChange();
    });
    act(() => form.props.onSubmit({ preventDefault: vi.fn() }));
    expect(addWorkstream).toHaveBeenCalledWith({ name: "공통 출시", status: "ACTIVE", projectIds: ["project-1"] });
    act(() => renderer.unmount());
  });
});
