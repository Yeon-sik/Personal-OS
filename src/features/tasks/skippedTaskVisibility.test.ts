import { describe, expect, it } from "vitest";
import { createEmptySnapshot } from "../../lib/storage/storageAdapter";
import { createTask } from "./taskService";
import { getAgenda } from "../home/agenda";
import { getCalendarMarkers, getDashboardStats, getProductivitySeries, getRecordsForDate } from "../records/recordAggregation";
import { actionStateLabel } from "../actions/actionCalendar";
import { reconcileDeadlineNotifications } from "../deadline-notifications/deadlinePlanner";
import { sameActionContent } from "../actions/actionModel";

describe("skipped occurrence visibility", () => {
  const original = { ...createTask("이번 회차", 0, "a", "2027-01-04", null, "2027-01-01"), registrationState: "CONFIRMED" as const };
  const skipped = { ...original, skippedAt: "2027-01-01T00:00:00Z", isDone: false };
  it("keeps the dated history while excluding skipped work from agenda and productivity", () => {
    const snapshot = { ...createEmptySnapshot(), tasks: [skipped] };
    const range = { startDate: "2027-01-01", endDate: "2027-01-31" };
    expect(getRecordsForDate(snapshot, "2027-01-01").tasks).toEqual([skipped]);
    expect(getAgenda([skipped], Date.parse("2027-01-01T00:00:00Z"))).toEqual({ overdue: [], today: [], upcoming: [], review: [], candidates: [], undated: [] });
    expect(getDashboardStats(snapshot, range)).toMatchObject({ completedTasks: 0, totalTasks: 0, productivityScore: null });
    expect(getProductivitySeries([skipped], range)).toEqual([]);
    expect(getCalendarMarkers(snapshot, "2027-01-01")).toEqual({});
    expect(actionStateLabel(skipped, Date.parse("2027-02-01T00:00:00Z"))).toBe("이번 회차 건너뜀");
  });
  it("cancels already scheduled reminders on skip and does not add them after restart", () => {
    const settings = { enabled: true, time: "09:00", timeZone: "Asia/Seoul" };
    const before = reconcileDeadlineNotifications([original], settings, "2026-12-31T00:00:00Z", "owner", []);
    expect(before.add).toHaveLength(4);
    const skippedPlan = reconcileDeadlineNotifications([skipped], settings, "2026-12-31T00:00:00Z", "owner", before.add);
    expect(skippedPlan.add).toEqual([]);
    expect(skippedPlan.cancel).toHaveLength(4);
    expect(reconcileDeadlineNotifications([skipped], settings, "2027-01-01T00:00:00Z", "owner", []).add).toEqual([]);
  });
  it("treats JSONB key ordering as the same planning content", () => {
    const a = { ...original, recurrence: { frequency: "DAILY" as const, interval: 1, anchorDate: "2027-01-01" }, checklist: [{ id: "one", text: "준비", isDone: false }] };
    const b = { ...original, recurrence: { interval: 1, anchorDate: "2027-01-01", frequency: "DAILY" as const }, checklist: [{ isDone: false, text: "준비", id: "one" }] };
    expect(sameActionContent(a, b)).toBe(true);
  });
});
