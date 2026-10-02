import { create } from "react-test-renderer";
import { describe, expect, it, vi } from "vitest";

import { GitHubConnectionBar } from "./GitHubConnectionBar";
import type { GitHubIntegrationController } from "./githubTypes";

function createIntegration(
  overrides: Partial<GitHubIntegrationController> = {},
): GitHubIntegrationController {
  return {
    status: {
      configured: false,
      connected: false,
      accountLogin: null,
      accountName: null,
      managementUrl: null,
      error: null,
    },
    deviceFlow: null,
    repositories: [],
    repositoryLoadState: { loading: false, diagnostic: null, error: null },
    branches: [],
    readStates: {},
    statusCheckError: null,
    error: null,
    busy: false,
    connect: vi.fn(),
    pollDeviceFlow: vi.fn(),
    cancelDeviceFlow: vi.fn(),
    disconnect: vi.fn(),
    loadRepositories: vi.fn(),
    loadBranches: vi.fn(),
    refreshProject: vi.fn(),
    loadMoreCommitHistory: vi.fn(),
    ...overrides,
    refreshStatus: overrides.refreshStatus ?? vi.fn(),
  };
}

function renderedText(integration: GitHubIntegrationController): string {
  return create(<GitHubConnectionBar integration={integration} />).root
    .findAllByType("section")[0]
    ?.findAll(() => true)
    .flatMap((node) => node.children)
    .join(" ") ?? "";
}

describe("GitHubConnectionBar status messaging", () => {
  it("shows Client ID setup only for a successful not-configured status", () => {
    const text = renderedText(createIntegration());

    expect(text).toContain("클라이언트 ID 설정 필요");
    expect(text).not.toContain("GitHub 연결 상태 확인 실패");
  });

  it("separates status lookup failures from a successful not-configured status", () => {
    const text = renderedText(
      createIntegration({ statusCheckError: "Command github_connection_status not allowed by ACL" }),
    );

    expect(text).toContain("GitHub 연결 상태 확인 실패");
    expect(text).toContain("Command github_connection_status not allowed by ACL");
    expect(text).not.toContain("클라이언트 ID 설정 필요");
  });

  it("treats a status response carrying a network error as a status lookup failure", () => {
    const text = renderedText(
      createIntegration({
        status: {
          configured: true,
          connected: false,
          accountLogin: null,
          accountName: null,
          managementUrl: null,
          error: "GitHub API에 연결하지 못했습니다.",
        },
        statusCheckError: "GitHub API에 연결하지 못했습니다.",
      }),
    );

    expect(text).toContain("GitHub 연결 상태 확인 실패");
    expect(text).toContain("GitHub API에 연결하지 못했습니다.");
  });
});
