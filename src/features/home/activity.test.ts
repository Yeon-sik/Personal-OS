import { describe, expect, it } from "vitest";
import { describeActivityDay, getActivityTimeline } from "./activity";
import { emptySnapshot, entity, projection, task } from "./testFixtures";

const options = { endDate: "2026-10-02", weekCount: 1, timeZone: "Asia/Seoul" };

describe("home activity timeline", () => {
  it("counts each retained record once and uses record dates instead of sync timestamps", () => {
    const snapshot = emptySnapshot();
    snapshot.notes = [{ ...entity, id: "note-1", title: "메모", content: "내용" }];
    snapshot.tasks = [task()];
    snapshot.knowledgeDocuments = [{ ...entity, id: "doc-1", title: "문서", type: "NOTE", projectId: null, workstreamId: null, relativePath: "note.md" }];
    snapshot.fitnessSummaryProjections = [projection()];
    snapshot.mealRecords = [{ ...entity, id: "meal-1", date: "2026-09-30", menu: "점심", calories: 500, proteinGrams: 20, carbsGrams: null, fatGrams: null }];
    snapshot.weightRecords = [{ ...entity, id: "weight-1", date: "2026-09-30", weightKg: 70 }];
    snapshot.projects = [{ ...entity, id: "project-1", name: "프로젝트", description: "", repository: null, branch: null, githubRepositoryId: null, githubOwner: null, githubRepo: null, status: "ACTIVE", currentSummary: "", targetSummary: "", lastVerifiedCommit: null, lastVerifiedAt: null }];
    snapshot.projectHistory = [{ ...entity, id: "history-1", projectId: "project-1", type: "NOTE", summary: "기록", occurredAt: "2026-09-29T14:00:00.000Z", githubRef: null }];

    const timeline = getActivityTimeline(snapshot, options);

    expect(timeline.totalCount).toBe(7);
    expect(timeline.activeDayCount).toBe(3);
    expect(timeline.days.find((day) => day.date === "2026-10-02")?.counts).toEqual({ notes: 1, tasks: 1, workouts: 1, meals: 0, weights: 0, projectHistory: 0, knowledgeDocuments: 1 });
    expect(timeline.days.find((day) => day.date === "2026-09-30")?.count).toBe(2);
    expect(timeline.days.find((day) => day.date === "2026-09-29")?.counts.projectHistory).toBe(1);
  });

  it("keeps creation activity stable when a memo is edited or a task changes completion state", () => {
    const snapshot = emptySnapshot();
    snapshot.notes = [{ ...entity, title: "메모", content: "", updatedAt: "2026-10-02T12:00:00.000Z" }];
    snapshot.tasks = [task({ isDone: true, updatedAt: "2026-10-02T13:00:00.000Z" })];
    const initial = getActivityTimeline(snapshot, options);
    const afterEdits = getActivityTimeline({ ...snapshot, notes: snapshot.notes.map((note) => ({ ...note, updatedAt: "2026-10-03T12:00:00.000Z" })), tasks: snapshot.tasks.map((entry) => ({ ...entry, isDone: false, updatedAt: "2026-10-04T12:00:00.000Z" })) }, options);

    expect(afterEdits).toEqual(initial);
    expect(afterEdits.totalCount).toBe(2);
  });

  it("uses an explicit calendar zone at midnight without shifting entered health dates", () => {
    const snapshot = emptySnapshot();
    snapshot.notes = [{ ...entity, createdAt: "2026-10-01T15:00:00.000Z", title: "자정", content: "" }];
    snapshot.tasks = [task({ createdAt: "2026-10-01T14:59:59.999Z" })];
    snapshot.weightRecords = [{ ...entity, date: "2026-10-01", weightKg: 70 }];

    const korean = getActivityTimeline(snapshot, options);
    const utc = getActivityTimeline(snapshot, { ...options, timeZone: "UTC" });

    expect(korean.days.find((day) => day.date === "2026-10-02")?.counts.notes).toBe(1);
    expect(korean.days.find((day) => day.date === "2026-10-01")?.counts.tasks).toBe(1);
    expect(utc.days.find((day) => day.date === "2026-10-01")?.counts.notes).toBe(1);
    expect(korean.days.find((day) => day.date === "2026-10-01")?.counts.weights).toBe(1);
    expect(utc.days.find((day) => day.date === "2026-10-01")?.counts.weights).toBe(1);
  });

  it("excludes tombstones, app-private health rows and invalid timestamps", () => {
    const snapshot = emptySnapshot();
    snapshot.notes = [{ ...entity, deletedAt: entity.updatedAt, title: "삭제", content: "" }, { ...entity, id: "invalid", createdAt: "invalid", title: "잘못된 시각", content: "" }];
    snapshot.tasks = [task({ deletedAt: entity.updatedAt })];
    snapshot.fitnessSummaryProjections = [projection({ deletedAt: entity.updatedAt })];
    snapshot.mealRecords = [{ ...entity, date: "2026-10-02", menu: "비공개", calories: 500, proteinGrams: 20, carbsGrams: null, fatGrams: null, scope: "fitness" }];
    snapshot.weightRecords = [{ ...entity, date: "2026-10-02", weightKg: 70, deletedAt: entity.updatedAt }, { ...entity, id: "private-weight", date: "2026-10-02", weightKg: 71, scope: "fitness" }];
    snapshot.knowledgeDocuments = [{ ...entity, title: "삭제", type: "NOTE", projectId: null, workstreamId: null, relativePath: "note.md", deletedAt: entity.updatedAt }];

    expect(getActivityTimeline(snapshot, options).totalCount).toBe(0);
  });

  it("counts a Fitness session once and never reads or doubles legacy workout details", () => {
    const snapshot = emptySnapshot();
    snapshot.fitnessSummaryProjections = [projection(), projection({ id: "second-projection", updatedAt: "2026-10-02T02:00:00.000Z" })];
    snapshot.workoutRecords = [{ ...entity, id: "fitness-session-1", date: "2026-10-02", workoutType: "strength", category: "가슴", exerciseName: "detail-owned-by-fitness", durationSeconds: 1800, averageHeartRate: null, sourceApp: "fitness", scope: "both", contractVersion: 1 }];

    expect(getActivityTimeline(snapshot, options).totalCount).toBe(1);
    expect(getActivityTimeline({ ...snapshot, fitnessSummaryProjections: [] }, options).totalCount).toBe(0);
    expect(getActivityTimeline({ ...snapshot, fitnessSummaryProjections: [...snapshot.fitnessSummaryProjections, projection({ id: "deleted-projection", updatedAt: "2026-10-02T03:00:00.000Z", deletedAt: "2026-10-02T03:00:00.000Z" })] }, options).totalCount).toBe(0);
  });

  it("retains actual backfilled record dates and excludes future or out-of-range records", () => {
    const snapshot = emptySnapshot();
    snapshot.weightRecords = [{ ...entity, date: "2026-09-30", weightKg: 70, isBackfilled: true, backfilledAt: "2026-10-02T01:00:00.000Z" }, { ...entity, id: "future", date: "2026-10-03", weightKg: 71 }, { ...entity, id: "old", date: "2026-09-27", weightKg: 72 }];
    const timeline = getActivityTimeline(snapshot, options);

    expect(timeline.startDate).toBe("2026-09-28");
    expect(timeline.endDate).toBe("2026-10-02");
    expect(timeline.days).toHaveLength(5);
    expect(timeline.totalCount).toBe(1);
    expect(describeActivityDay(timeline.days[2])).toBe("체중 기록 1건");
    expect(describeActivityDay(timeline.days[0])).toBe("등록된 활동이 없습니다.");
  });

  it("keeps the week grid stable across leap day, year boundaries and empty data", () => {
    const leap = getActivityTimeline(emptySnapshot(), { endDate: "2024-03-01", weekCount: 1, timeZone: "UTC" });
    const year = getActivityTimeline(emptySnapshot(), { endDate: "2027-01-01", weekCount: 1, timeZone: "UTC" });

    expect(leap.days.map((day) => day.date)).toEqual(["2024-02-26", "2024-02-27", "2024-02-28", "2024-02-29", "2024-03-01"]);
    expect(year.days.map((day) => day.date)).toEqual(["2026-12-28", "2026-12-29", "2026-12-30", "2026-12-31", "2027-01-01"]);
    expect(leap.totalCount).toBe(0);
    expect(leap.activeDayCount).toBe(0);
    expect(getActivityTimeline(emptySnapshot(), { endDate: "2026-02-30" }).days).toEqual([]);
  });
});
