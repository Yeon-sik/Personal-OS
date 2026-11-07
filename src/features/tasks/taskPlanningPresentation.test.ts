import { describe, expect, it } from "vitest";
import { task } from "../home/testFixtures";
import { completionDay, filterChecklistTasks, groupCompletedTasks } from "./taskPlanningPresentation";

describe("task filters and completed history", () => {
  it("groups by actual completion in Seoul, never planned or edited dates", () => {
    const done = task({ id: "done", isDone: true, plannedDate: "2026-10-01", completedAt: "2026-11-06T16:30:00Z", updatedAt: "2026-11-08T01:00:00Z" });
    const old = task({ id: "old", isDone: true, updatedAt: "2026-11-07T00:00:00Z" });
    expect(completionDay(done)).toBe("2026-11-07");
    expect(completionDay(old)).toBeNull();
    expect(groupCompletedTasks([old, done, task({ id: "deleted", isDone: true, deletedAt: "2026-11-07T00:00:00Z" })]).map(group => ({ date: group.date, ids: group.tasks.map(item => item.id) }))).toEqual([
      { date: "2026-11-07", ids: ["done"] }, { date: null, ids: ["old"] },
    ]);
  });

  it("combines title, status and category filters without exposing deleted/candidate records", () => {
    const tasks = [
      task({ id: "open", text: "과제 초안", category: "학교" }),
      task({ id: "done", text: "과제 제출", category: "학교", isDone: true }),
      task({ id: "personal", text: "과제 참고자료", category: "개인" }),
      task({ id: "deleted", text: "과제 삭제", category: "학교", deletedAt: "2026-11-07T00:00:00Z" }),
      task({ id: "candidate", text: "과제 후보", category: "학교", registrationState: "CANDIDATE" }),
      task({ id: "skip", text: "과제 반복", category: "학교", skippedAt: "2026-11-07T00:00:00Z" }),
    ];
    expect(filterChecklistTasks(tasks, " 과제 ", "open", "학교").map(item => item.id)).toEqual(["open"]);
    expect(filterChecklistTasks(tasks, "과제", "completed", "학교").map(item => item.id)).toEqual(["done"]);
    expect(filterChecklistTasks(tasks, "과제", "skipped", "학교").map(item => item.id)).toEqual(["skip"]);
  });

  it("does not classify a dated event as undated merely because its planned/due dates are empty", () => {
    const tasks = [
      task({ id: "undated", plannedDate: null, dueDate: null }),
      task({ id: "event", plannedDate: null, dueDate: null, eventStartDate: "2026-11-10" }),
      task({ id: "window", plannedDate: null, dueDate: null, windowStartDate: "2026-11-10" }),
    ];
    expect(filterChecklistTasks(tasks, "", "undated", "uncategorized").map(item => item.id)).toEqual(["undated"]);
  });
});
