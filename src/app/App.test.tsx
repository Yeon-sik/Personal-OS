import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { HomePanelProps } from "../features/home/HomePanel";
import { App } from "./App";

const harness = vi.hoisted(() => ({
  openWorkspace: vi.fn().mockResolvedValue(undefined),
  quickOpen: vi.fn(),
  runtime: {
    notes: [], tasks: [], workoutRecords: [], fitnessSummaryProjections: [],
    mealRecords: [], weightRecords: [], activeDevices: [], projects: [],
    projectMilestones: [], projectActions: [], projectIdeas: [], projectHistory: [],
    workstreams: [], workstreamProjects: [], workstreamMilestones: [],
    workstreamActions: [], workstreamActionProjects: [], workstreamActionDependencies: [],
    knowledgeDocuments: [], device: null, selectedNote: null, selectedNoteId: null,
    selectedProjectId: null, selectedWorkstreamId: null, isReady: true, error: null,
    saveState: "saved", syncStatus: { mode: "local-only", label: "local-only", detail: "Local data only", isOnline: true },
    addNote: vi.fn(), addNoteForDate: vi.fn(), addTask: vi.fn(), deleteNote: vi.fn(), deleteTask: vi.fn(),
    selectNote: vi.fn(), updateSelectedNoteTitle: vi.fn(), updateSelectedNoteContent: vi.fn(),
    toggleTask: vi.fn(), reorderTasks: vi.fn(), updateTaskPlannedDate: vi.fn(), updateTaskSchedule: vi.fn(), updateTaskText: vi.fn(),
    setSelectedProjectId: vi.fn(), setSelectedWorkstreamId: vi.fn(),
    manualSync: vi.fn(), saveSupabaseConfig: vi.fn(), signIn: vi.fn(), signOut: vi.fn(), setAutostartEnabled: vi.fn(),
    loadFinanceDailySummaries: vi.fn(),
  },
}));

vi.mock("./useLocalSyncMemo", () => ({ useLocalSyncMemo: () => harness.runtime }));
vi.mock("./useThemeMode", () => ({ useThemeMode: () => ({ themeMode: "dark", setThemeMode: vi.fn() }) }));
vi.mock("../features/dev-control/github/useGitHubIntegration", () => ({ useGitHubIntegration: () => ({ refreshStatus: vi.fn() }) }));
vi.mock("../features/dev-control/workspace/projectWorkspaceBridge", () => ({
  projectWorkspaceStateFromRuntime: (state: unknown) => state,
  useProjectWorkspaceHost: () => ({ openWorkspace: harness.openWorkspace }),
}));
vi.mock("../features/quick-capture/useQuickCapture", () => ({ useQuickCapture: () => ({
  open: harness.quickOpen, isOpen: false, mode: "task", close: vi.fn(), setMode: vi.fn(), saveDraft: vi.fn(),
  shortcutPreference: "Ctrl+K", shortcutStatus: { supported: false, registered: false, shortcut: "Ctrl+K", error: null },
  refreshShortcutStatus: vi.fn(), setShortcutPreference: vi.fn(),
}) }));
vi.mock("../features/quick-capture/QuickCapturePanel", () => ({ QuickCapturePanel: () => null }));
vi.mock("../features/home/HomePanel", () => ({ HomePanel: ({ onOpenRecords, onOpenProjects, onQuickCapture }: HomePanelProps) => (
  <section data-panel="home">
    <button onClick={() => onOpenRecords("all", "2026-09-18")}>활동 날짜 열기</button>
    <button onClick={() => onOpenRecords("tasks")}>오늘 할 일 열기</button>
    <button onClick={onOpenProjects}>프로젝트 바로가기</button>
    <button onClick={onQuickCapture}>홈 빠른 입력</button>
  </section>
) }));
vi.mock("../features/records/RecordsPanel", () => ({ RecordsPanel: ({ selectedDate }: { selectedDate: string }) => <section data-panel="records" data-date={selectedDate} /> }));
vi.mock("../features/notes/MemoPanel", () => ({ MemoPanel: () => <section data-panel="memo" /> }));
vi.mock("../features/tasks/ChecklistPanel", () => ({ ChecklistPanel: () => <section data-panel="tasks" /> }));
vi.mock("../features/fitness/FitnessPanel", () => ({ FitnessPanel: ({ selectedDate }: { selectedDate: string }) => <section data-panel="fitness" data-date={selectedDate} /> }));
vi.mock("../features/dev-control/DevControlPanel", () => ({ DevControlPanel: (props: {
  onOpenProjectWorkspace: (id: string) => void; onCreateProjectWorkspace: () => void;
  onOpenWorkstream: (id: string) => void;
}) => <section data-panel="projects">
  <button onClick={() => props.onOpenProjectWorkspace("project-1")}>작업 공간 열기</button>
  <button onClick={props.onCreateProjectWorkspace}>새 프로젝트 열기</button>
  <button onClick={() => props.onOpenWorkstream("workstream-1")}>워크스트림 열기</button>
</section> }));
vi.mock("../components/SettingsPanel", () => ({ SettingsPanel: ({ onManualSync }: { onManualSync: () => void }) => <section data-panel="settings"><button onClick={onManualSync}>수동 동기화</button></section> }));

let renderer: ReactTestRenderer;

function clickButton(label: string, navLabel?: string) {
  const scope = navLabel ? renderer.root.findByProps({ "aria-label": navLabel }) : renderer.root;
  const button = scope.findAllByType("button").find((node) =>
    node.children.join("") === label || node.findAllByType("span").some((span) => span.children.join("") === label),
  );
  expect(button, label).toBeDefined();
  act(() => button!.props.onClick());
}

beforeEach(() => {
  vi.clearAllMocks();
  act(() => { renderer = create(<App />); });
});

afterEach(() => { act(() => renderer.unmount()); });

describe("Personal OS four-tab navigation", () => {
  it("starts at home and keeps exactly four primary destinations visible", () => {
    expect(renderer.root.findByProps({ "data-panel": "home" })).toBeDefined();
    const nav = renderer.root.findByProps({ "aria-label": "주요 화면" });
    expect(nav.findAllByType("button").map((button) => button.findByType("span").children.join("")))
      .toEqual(["홈", "기록", "프로젝트", "설정"]);
    expect(renderer.root.findByType("header").findAllByType("button")).toHaveLength(0);
    clickButton("설정", "주요 화면");
    expect(renderer.root.findByProps({ "data-panel": "settings" })).toBeDefined();
    expect(renderer.root.findAllByProps({ "aria-label": "주요 화면" })).toHaveLength(1);
    clickButton("수동 동기화");
    expect(harness.runtime.manualSync).toHaveBeenCalledOnce();
  });

  it("opens an activity date in the calendar and keeps memo, tasks, health under records", () => {
    clickButton("활동 날짜 열기");
    expect(renderer.root.findByProps({ "data-panel": "records" }).props["data-date"]).toBe("2026-09-18");
    clickButton("메모", "기록 분류");
    expect(renderer.root.findByProps({ "data-panel": "memo" })).toBeDefined();
    expect(renderer.root.findAllByProps({ "data-panel": "tasks" })).toHaveLength(0);
    clickButton("할 일", "기록 분류");
    expect(renderer.root.findByProps({ "data-panel": "tasks" })).toBeDefined();
    clickButton("건강", "기록 분류");
    expect(renderer.root.findByProps({ "data-panel": "fitness" }).props["data-date"]).toBe("2026-09-18");
    clickButton("달력에서 날짜 선택");
    expect(renderer.root.findByProps({ "data-panel": "records" }).props["data-date"]).toBe("2026-09-18");
    clickButton("홈", "주요 화면");
    clickButton("오늘 할 일 열기");
    expect(renderer.root.findByProps({ "data-panel": "tasks" })).toBeDefined();
  });

  it("preserves quick capture and project/workstream workspace entry callbacks", () => {
    clickButton("홈 빠른 입력");
    act(() => renderer.root.findByProps({ "aria-label": "빠른 입력 열기" }).props.onClick());
    expect(harness.quickOpen).toHaveBeenCalledTimes(2);
    clickButton("프로젝트 바로가기");
    clickButton("작업 공간 열기");
    expect(harness.runtime.setSelectedProjectId).toHaveBeenLastCalledWith("project-1");
    expect(harness.openWorkspace).toHaveBeenLastCalledWith({ mode: "view", projectId: "project-1" });
    clickButton("새 프로젝트 열기");
    expect(harness.openWorkspace).toHaveBeenLastCalledWith({ mode: "create", projectId: null });
    clickButton("워크스트림 열기");
    expect(harness.runtime.setSelectedWorkstreamId).toHaveBeenLastCalledWith("workstream-1");
  });
});
