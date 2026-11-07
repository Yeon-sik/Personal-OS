import { describe, expect, it } from "vitest";
import { task } from "../home/testFixtures";
import { timelineDays, weekStart } from "./scheduleTimelineModel";

const event = (id: string, start: string, end: string) => task({ id, plannedDate: null, dueDate: null, kind: "EVENT", eventStartDate: "2026-11-07", eventEndDate: "2026-11-07", eventStartTime: start, eventEndTime: end, timeZone: "Asia/Seoul" });
describe("schedule timeline", () => {
  it("uses Monday as week start across a month boundary", () => {
    expect(weekStart("2026-11-01")).toBe("2026-10-26");
    expect(timelineDays([], "2026-11-01", "week").map(day => day.date)).toEqual(["2026-10-26", "2026-10-27", "2026-10-28", "2026-10-29", "2026-10-30", "2026-10-31", "2026-11-01"]);
  });
  it("flags confirmed overlaps but not adjacent, finished, tentative, or time-unknown work", () => {
    const rows = [event("a", "14:00", "15:00"), event("b", "14:30", "15:30"), event("c", "15:30", "16:00"), { ...event("candidate", "14:00", "15:00"), registrationState: "CANDIDATE" as const }, { ...event("done", "14:00", "15:00"), isDone: true }, { ...event("point", "14:00", "15:00"), eventEndTime: null }];
    const entries = timelineDays(rows, "2026-11-07", "day")[0].entries;
    expect(entries.find(e => e.task.id === "a")?.conflictIds).toEqual(["b"]);
    expect(entries.find(e => e.task.id === "b")?.conflictIds).toEqual(["a"]);
    for (const id of ["c", "candidate", "done", "point"]) expect(entries.find(e => e.task.id === id)?.conflictIds).toEqual([]);
  });
  it("clips overnight intervals and respects end-exclusive midnight", () => {
    const row = { ...event("night", "23:00", "01:00"), eventEndDate: "2026-11-08" };
    expect(timelineDays([row], "2026-11-07", "day")[0].entries[0]).toMatchObject({ startMinute: 1380, endMinute: 1440 });
    expect(timelineDays([row], "2026-11-08", "day")[0].entries[0]).toMatchObject({ startMinute: 0, endMinute: 60 });
    expect(timelineDays([{ ...row, eventEndTime: "00:00" }], "2026-11-08", "day")[0].entries).toHaveLength(0);
  });
  it("converts source time zones and removes tombstones/skipped occurrences", () => {
    const row = { ...event("utc", "23:00", "23:30"), timeZone: "UTC" };
    expect(timelineDays([row], "2026-11-08", "day")[0].entries[0]).toMatchObject({ startMinute: 480, endMinute: 510 });
    expect(timelineDays([{ ...row, deletedAt: "2026-11-01T00:00:00Z" }, { ...row, id: "skip", skippedAt: "2026-11-01T00:00:00Z" }], "2026-11-08", "day")[0].entries).toHaveLength(0);
  });
  it("leaves an ambiguous DST wall clock unpositioned", () => {
    const row = { ...event("dst", "01:30", "02:30"), eventStartDate: "2026-11-01", eventEndDate: "2026-11-01", timeZone: "America/New_York" };
    expect(timelineDays([row], "2026-11-01", "day")[0].entries[0]).toMatchObject({ startMinute: null, endMinute: null });
  });
});
