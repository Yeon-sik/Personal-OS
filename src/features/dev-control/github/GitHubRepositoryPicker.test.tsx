import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { describe, expect, it, vi } from "vitest";

import { GitHubRepositoryPicker } from "./GitHubRepositoryPicker";
import type {
  GitHubIntegrationController,
  GitHubRepositoryListDiagnostic,
  GitHubRepositoryLoadState,
  GitHubRepositoryOption,
} from "./githubTypes";

const repository: GitHubRepositoryOption = {
  id: "42",
  owner: "octo",
  name: "Always_Memo",
  fullName: "octo/Always_Memo",
  htmlUrl: "https://github.com/octo/Always_Memo",
  defaultBranch: "main",
  private: true,
  description: null,
};

function createDiagnostic(
  state: GitHubRepositoryListDiagnostic["state"],
  error: GitHubRepositoryListDiagnostic["error"] = null,
): GitHubRepositoryListDiagnostic {
  return {
    state,
    userStatus: 200,
    userCount: 1,
    installationStatuses: state === "api-error" ? [403] : [200],
    installationCount: state === "no-installations" ? 0 : 1,
    installationRepositories:
      state === "no-installations"
        ? []
        : [{ appSlug: "personal-os", statuses: state === "api-error" ? [403] : [200], repositoryCount: state === "no-repositories" ? 0 : 1 }],
    accessibleRepositoryCount: state === "no-repositories" || state === "no-installations" ? 0 : 1,
    matchingRepositoryCount: state === "no-search-results" ? 0 : 1,
    installedAppSlugs: state === "no-installations" ? [] : ["personal-os"],
    error,
  };
}

function createIntegration(
  repositoryLoadState: GitHubRepositoryLoadState,
  repositories: GitHubRepositoryOption[] = [],
): GitHubIntegrationController {
  return {
    status: {
      configured: true,
      connected: true,
      accountLogin: "octo",
      accountName: null,
      managementUrl: null,
      error: null,
    },
    deviceFlow: null,
    repositories,
    repositoryLoadState,
    branches: [],
    readStates: {},
    statusCheckError: null,
    error: null,
    busy: false,
    refreshStatus: vi.fn(),
    connect: vi.fn(),
    pollDeviceFlow: vi.fn(),
    cancelDeviceFlow: vi.fn(),
    disconnect: vi.fn(),
    loadRepositories: vi.fn().mockResolvedValue(undefined),
    loadBranches: vi.fn().mockResolvedValue(undefined),
    refreshProject: vi.fn().mockResolvedValue(undefined),
    loadMoreCommitHistory: vi.fn().mockResolvedValue(undefined),
  };
}

function renderPicker(integration: GitHubIntegrationController): ReactTestRenderer {
  return create(
    <GitHubRepositoryPicker
      integration={integration}
      repository=""
      branch="main"
      githubRepositoryId={null}
      githubOwner={null}
      githubRepo={null}
      onRepositoryChange={vi.fn()}
      onBranchChange={vi.fn()}
      onIdentityChange={vi.fn()}
    />,
  );
}

function renderedText(renderer: ReactTestRenderer): string {
  return renderer.root
    .findAll(() => true)
    .flatMap((node) => node.children.filter((child): child is string => typeof child === "string"))
    .join(" ");
}

async function openPicker(renderer: ReactTestRenderer) {
  await act(async () => {
    renderer.root
      .findAllByType("button")
      .find((button) => button.children.join("") === "저장소 선택/권한 관리")
      ?.props.onClick();
  });
}

describe("GitHubRepositoryPicker repository states", () => {
  it("keeps loading, API error, installation, repository, and search states distinct", async () => {
    const cases: Array<{
      state: GitHubRepositoryLoadState;
      expected: string;
    }> = [
      {
        state: { loading: true, diagnostic: null, error: null },
        expected: "저장소를 불러오는 중...",
      },
      {
        state: {
          loading: false,
          diagnostic: createDiagnostic("api-error", {
            code: "forbidden",
            message: "GitHub Repository를 조회할 권한이 없습니다.",
            status: 403,
          }),
          error: "GitHub Repository를 조회할 권한이 없습니다.",
        },
        expected: "GitHub API 오류",
      },
      {
        state: {
          loading: false,
          diagnostic: createDiagnostic("no-installations"),
          error: null,
        },
        expected: "설치된 GitHub 앱이 없습니다.",
      },
      {
        state: {
          loading: false,
          diagnostic: createDiagnostic("no-repositories"),
          error: null,
        },
        expected: "현재 사용자에게 허용된 저장소가 없습니다.",
      },
      {
        state: {
          loading: false,
          diagnostic: createDiagnostic("no-search-results"),
          error: null,
        },
        expected: "현재 검색어와 일치하는 결과가 없습니다.",
      },
    ];

    for (const testCase of cases) {
      const renderer = renderPicker(createIntegration(testCase.state));
      await openPicker(renderer);
      expect(renderedText(renderer)).toContain(testCase.expected);
    }
  });

  it("renders a normal repository list with safe API diagnostics", async () => {
    const renderer = renderPicker(
      createIntegration(
        { loading: false, diagnostic: createDiagnostic("ready"), error: null },
        [repository],
      ),
    );

    await openPicker(renderer);

    expect(
      renderer.root
        .findAllByType("button")
        .some((button) => button.props["aria-label"] === "GitHub 저장소 octo/Always_Memo"),
    ).toBe(true);
    expect(renderedText(renderer)).toContain("/user 200 (1)");
  });
});
