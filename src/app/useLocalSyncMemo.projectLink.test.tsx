import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { StorageAdapter } from "../lib/storage/storageAdapter";
import { LocalOnlySyncClient } from "../lib/sync/localOnlySyncClient";
import { getOrCreateDevice } from "../lib/device/device";
import { emptySnapshot, entity } from "../features/home/testFixtures";
import { actionId } from "../features/actions/actionIdentity";
import { PROJECT_TASK_NAMESPACE } from "../features/tasks/projectTaskLink";
import type { LocalDataSnapshot } from "../types";
import { useLocalSyncMemo } from "./useLocalSyncMemo";

vi.mock("../lib/device/device", async () => ({
  ...await vi.importActual<typeof import("../lib/device/device")>("../lib/device/device"),
  getOrCreateDevice: vi.fn(),
}));
vi.mock("../lib/desktop/autostart", () => ({
  getAutostartEnabled: vi.fn(async () => ({ enabled: false, error: null, supported: false })),
  setAutostartEnabled: vi.fn(),
}));

const device = { id: "project-link-device", name: "Test", lastSeenAt: "2026-11-07T00:00:00Z", appVersion: "test" };
const syncClient = new LocalOnlySyncClient();
let hook: ReturnType<typeof useLocalSyncMemo>;
let renderer: ReactTestRenderer | undefined;

function initialSnapshot(): LocalDataSnapshot {
  return {
    ...emptySnapshot(),
    projects: [{ ...entity, id: "project", name: "계획", description: "", repository: null, branch: null,
      githubRepositoryId: null, githubOwner: null, githubRepo: null, status: "ACTIVE",
      currentSummary: "", targetSummary: "", lastVerifiedCommit: null, lastVerifiedAt: null }],
    projectActions: [{ ...entity, id: "project-action", projectId: "project", title: "원본 작업", type: "NEXT", status: "OPEN" }],
  };
}

function Harness({ storage }: { storage: StorageAdapter }) {
  hook = useLocalSyncMemo(storage, syncClient);
  return null;
}

async function mount(): Promise<void> {
  const snapshot = initialSnapshot();
  const storage: StorageAdapter = { load: async () => structuredClone(snapshot), save: async () => undefined };
  await act(async () => { renderer = create(<Harness storage={storage} />); });
  expect(hook.isReady).toBe(true);
}

async function runAndSettle(operation: () => void | Promise<unknown>, settled?: () => boolean): Promise<void> {
  await act(async () => { await operation(); });
  if (settled) {
    await vi.waitFor(async () => {
      await act(async () => { await Promise.resolve(); });
      expect(settled()).toBe(true);
    });
  }
}

beforeEach(() => {
  const values = new Map<string, string>();
  vi.stubGlobal("window", {
    addEventListener: vi.fn(), removeEventListener: vi.fn(),
    setTimeout: globalThis.setTimeout, clearTimeout: globalThis.clearTimeout,
    setInterval: globalThis.setInterval, clearInterval: globalThis.clearInterval,
    localStorage: { getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value), removeItem: (key: string) => values.delete(key) },
  });
  vi.stubGlobal("navigator", { onLine: false, platform: "Win32", userAgent: "test" });
  vi.mocked(getOrCreateDevice).mockResolvedValue(device);
});

afterEach(async () => {
  await act(async () => renderer?.unmount());
  renderer = undefined;
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("useLocalSyncMemo project task links", () => {
  it("reuses the owner-scoped task on repeated plans and mirrors completion and undo in both directions", async () => {
    await mount();
    await runAndSettle(() => hook.planProjectAction("project-action", "2026-11-07"), () => hook.tasks.length === 1);
    expect(hook.tasks).toHaveLength(1);
    const id = await actionId(`local:${device.id}`, PROJECT_TASK_NAMESPACE, "project-action");
    expect(hook.tasks[0]).toMatchObject({ id, projectActionId: "project-action", actionOwnerScope: `local:${device.id}` });
    await runAndSettle(() => hook.updateTaskDetails(id, { description: "보존할 설명" }));
    await runAndSettle(() => hook.planProjectAction("project-action", "2026-11-08"), () => hook.tasks[0]?.plannedDate === "2026-11-08");
    expect(hook.tasks).toHaveLength(1);
    expect(hook.tasks[0]).toMatchObject({ plannedDate: "2026-11-08", description: "보존할 설명" });

    await runAndSettle(() => hook.toggleTask(id));
    expect(hook.tasks[0].completedAt).toBeTruthy();
    expect(hook.projectActions[0].status).toBe("DONE");
    await runAndSettle(() => hook.toggleTask(id));
    expect(hook.tasks[0].completedAt).toBeNull();
    expect(hook.projectActions[0].status).toBe("OPEN");

    await runAndSettle(() => hook.updateProjectAction("project-action", { title: "제목도 함께 완료", status: "DONE" }));
    expect(hook.tasks[0]).toMatchObject({ text: "제목도 함께 완료", isDone: true });
    expect(hook.projectActions[0]).toMatchObject({ title: "제목도 함께 완료", status: "DONE", updatedAt: hook.tasks[0].updatedAt });
    await runAndSettle(() => hook.updateProjectAction("project-action", { status: "OPEN" }));
    expect(hook.tasks[0]).toMatchObject({ isDone: false, completedAt: null });
    expect(hook.projectActions[0].status).toBe("OPEN");
    expect(hook.error).toBeNull();
  });

  it("creates one unlinked recurring follower and keeps it when the project completion is undone", async () => {
    await mount();
    await runAndSettle(() => hook.planProjectAction("project-action", "2026-11-07"), () => hook.tasks.length === 1);
    const id = hook.tasks[0].id;
    await runAndSettle(() => hook.updateTaskDetails(id, { recurrence: { frequency: "DAILY", interval: 1, anchorDate: "2026-11-07" } }));
    await runAndSettle(() => hook.updateProjectAction("project-action", { title: "반복 원본 완료", status: "DONE" }), () => hook.tasks.length === 2);
    expect(hook.tasks).toHaveLength(2);
    const follower = hook.tasks.find(task => task.id !== id)!;
    expect(follower).toMatchObject({ text: "반복 원본 완료", projectActionId: null, plannedDate: "2026-11-08", isDone: false });
    await runAndSettle(() => hook.updateProjectAction("project-action", { status: "OPEN" }));
    expect(hook.tasks.find(task => task.id === follower.id)).toEqual(follower);
    await runAndSettle(() => hook.toggleTask(id));
    expect(hook.tasks).toHaveLength(2);
  });

  it("retains the tombstone and reports an error when a deleted linked task is planned again", async () => {
    await mount();
    await runAndSettle(() => hook.planProjectAction("project-action", "2026-11-07"), () => hook.tasks.length === 1);
    const id = hook.tasks[0].id;
    await runAndSettle(() => hook.deleteTask(id));
    const deleted = hook.calendarTasks.find(task => task.id === id)!;
    expect(deleted.deletedAt).toBeTruthy();
    await runAndSettle(() => hook.planProjectAction("project-action", "2026-11-08"), () => Boolean(hook.error?.includes("삭제")));
    expect(hook.tasks).toHaveLength(0);
    expect(hook.calendarTasks).toHaveLength(1);
    expect(hook.calendarTasks[0]).toEqual(deleted);
    expect(hook.error).toContain("삭제");
    expect(hook.projectActions[0].status).toBe("OPEN");
  });
});
