import { describe, expect, it } from "vitest";
import { getAgenda } from "./agenda";
import { task } from "./testFixtures";

const now = Date.parse("2026-11-06T12:00:00+09:00");
const base = { plannedDate: null, dueDate: null, dueTime: null };

describe("command center agenda", () => {
  it("finds due-only and event-only actions and keeps candidates, completed and deleted rows out of commitments", () => {
    const agenda = getAgenda([
      task({ ...base, id: "deadline", dueDate: "2026-11-06" }),
      task({ ...base, id: "event", eventStartDate: "2026-11-07", eventEndDate: "2026-11-09", kind: "EVENT" }),
      task({ ...base, id: "candidate", dueDate: "2026-11-01", registrationState: "CANDIDATE" }),
      task({ ...base, id: "deleted", dueDate: "2026-11-01", deletedAt: new Date(now).toISOString() }),
      task({ ...base, id: "done", dueDate: "2026-11-01", isDone: true }),
      task({ ...base, id: "undated" }),
      task({ ...base, id: "far", dueDate: "2026-11-13" }),
    ], now);
    expect(agenda.today.map(row => row.task.id)).toEqual(["deadline"]);
    expect(agenda.upcoming.map(row => row.task.id)).toEqual(["event"]);
    expect(agenda.overdue).toEqual([]);
    expect(agenda.candidates.map(row => row.id)).toEqual(["candidate"]);
    expect(agenda.undated.map(row => row.id)).toEqual(["undated"]);
  });

  it("deduplicates overlapping roles and ongoing multi-day windows", () => {
    const agenda = getAgenda([task({ ...base, id: "window", kind: "REGISTRATION", plannedDate: "2026-11-06", windowStartDate: "2026-11-01", dueDate: "2026-11-06" })], now);
    expect(agenda.today).toHaveLength(1);
    expect(agenda.today[0].roles).toEqual(["PLAN", "WINDOW", "DEADLINE"]);
    expect(agenda.upcoming).toEqual([]);
  });

  it("honors timed deadlines, date-only end-of-day and source time zones", () => {
    const agenda = getAgenda([
      task({ ...base, id: "past-date", dueDate: "2026-11-05" }),
      task({ ...base, id: "past-time", dueDate: "2026-11-06", dueTime: "11:59" }),
      task({ ...base, id: "date-only", dueDate: "2026-11-06" }),
      task({ ...base, id: "utc", dueDate: "2026-11-06", dueTime: "03:01", timeZone: "UTC" }),
      task({ ...base, id: "la", dueDate: "2026-11-05", dueTime: "20:00", timeZone: "America/Los_Angeles" }),
    ], now);
    expect(agenda.overdue.map(row => row.task.id)).toEqual(["past-date", "past-time"]);
    expect(agenda.today.map(row => row.task.id).sort()).toEqual(["date-only", "la", "utc"]);
  });

  it("advances dates at Seoul midnight and excludes an event ending exactly at midnight", () => {
    const tasks = [task({ ...base, id: "event", eventStartDate: "2026-11-05", eventStartTime: "23:00", eventEndDate: "2026-11-06", eventEndTime: "00:00" }),
      task({ ...base, id: "due", dueDate: "2026-11-05" })];
    expect(getAgenda(tasks, Date.parse("2026-11-05T23:59:00+09:00")).today).toHaveLength(2);
    const after = getAgenda(tasks, Date.parse("2026-11-06T00:00:00+09:00"));
    expect(after.today).toEqual([]);
    expect(after.overdue.map(row => row.task.id)).toEqual(["due"]);
    expect(after.review.map(row => row.task.id)).toEqual(["event"]);
  });

  it("surfaces missed plans without a deadline and sorts timed actions chronologically", () => {
    const agenda = getAgenda([
      task({ ...base, id: "missed-plan", plannedDate: "2026-11-04" }),
      task({ ...base, id: "late", dueDate: "2026-11-06", dueTime: "18:00" }),
      task({ ...base, id: "early", eventStartDate: "2026-11-06", eventStartTime: "14:00" }),
      task({ ...base, id: "unknown-time", dueDate: "2026-11-06" }),
    ], now);
    expect(agenda.review.map(row => row.task.id)).toEqual(["missed-plan"]);
    expect(agenda.today.map(row => row.task.id)).toEqual(["early", "late", "unknown-time"]);
  });
});
