import { describe, expect, it } from "vitest";
import { emptySnapshot, entity } from "../home/testFixtures";
import { planProjectTask, syncLinkedProjectAction } from "./projectTaskLink";
import type { LocalDataSnapshot } from "../../types";

function source(): LocalDataSnapshot {
  const snapshot = emptySnapshot();
  snapshot.projects = [{ ...entity, id: "project", name: "계획", description: "", repository: null, branch: null, githubRepositoryId: null, githubOwner: null, githubRepo: null, status: "ACTIVE", currentSummary: "", targetSummary: "", lastVerifiedCommit: null, lastVerifiedAt: null }];
  snapshot.projectActions = [{ ...entity, id: "action", projectId: "project", title: "원본 작업", type: "NEXT", status: "OPEN" }];
  return snapshot;
}
describe("project task link", () => {
  it("rejects invalid plan dates and cross-account links", () => {
    expect(() => planProjectTask(source(), "action", "task", "2026-02-30", "device", "owner")).toThrow("날짜");
    const linked = planProjectTask(source(), "action", "task", "2026-11-07", "device", "owner");
    expect(() => planProjectTask(linked, "action", "task", "2026-11-08", "device", "other-owner")).toThrow("다른 계정");
  });
  it("plans the same linked task repeatedly without duplication or content loss", () => {
    const first = planProjectTask(source(), "action", "task", "2026-11-07", "device", "owner");
    first.tasks[0].description = "중요한 메모";
    first.tasks[0].dueDate = "2026-11-10";
    const second = planProjectTask(first, "action", "task", "2026-11-08", "device", "owner");
    expect(second.tasks).toHaveLength(1);
    expect(second.tasks[0]).toMatchObject({ projectActionId: "action", plannedDate: "2026-11-08", description: "중요한 메모", dueDate: "2026-11-10", sourceNamespace: "personal-os.project-action", externalKey: "action" });
  });
  it("mirrors title and completion atomically with a common monotonic revision", () => {
    const snapshot = planProjectTask(source(), "action", "task", "2026-11-07", "device", "owner");
    snapshot.tasks[0] = { ...snapshot.tasks[0], text: "검토 완료", isDone: true, completedAt: "2026-11-07T00:00:00Z" };
    const next = syncLinkedProjectAction(snapshot, snapshot.tasks[0]);
    expect(next.projectActions[0]).toMatchObject({ title: "검토 완료", status: "DONE", updatedAt: next.tasks[0].updatedAt });
    const undone = { ...next.tasks[0], isDone: false, completedAt: null };
    expect(syncLinkedProjectAction({ ...next, tasks: [undone] }, undone).projectActions[0].status).toBe("OPEN");
  });
  it("does not resurrect a deleted task or project action", () => {
    const snapshot = planProjectTask(source(), "action", "task", "2026-11-07", "device", "owner");
    snapshot.tasks[0].deletedAt = "2026-11-07T00:00:00Z";
    expect(() => planProjectTask(snapshot, "action", "task", "2026-11-08", "device", "owner")).toThrow("삭제");
    snapshot.tasks[0].deletedAt = null;
    snapshot.projectActions[0].deletedAt = "2026-11-07T00:00:00Z";
    const task = { ...snapshot.tasks[0], isDone: true };
    expect(syncLinkedProjectAction(snapshot, task)).toBe(snapshot);
  });
});
