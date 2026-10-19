import { describe, expect, it } from "vitest";
import { ACTION_IMPORT_EXAMPLE } from "./actionExample";
import { applyImportedTasks, parseActionImport, prepareImport, editAction } from "./actionImport";
import { actionRolesOnDate, firstActionDate } from "./actionCalendar";
import { exactInstant } from "./actionTime";
import { actionId } from "./actionIdentity";
import { createEmptySnapshot } from "../../lib/storage/storageAdapter";
import { taskFromRow, taskToRow } from "../../lib/sync/supabase/mappers";
import { getCalendarMarkers, getRecordsForDate } from "../records/recordAggregation";
import { makeTask } from "../../lib/sync/supabase/testFixtures";

describe("action import contract and calendar", () => {
  it("imports registration and exam separately and preserves null end time", async () => {
    const preview = parseActionImport(ACTION_IMPORT_EXAMPLE);
    expect(preview.items.every(item => !item.issues.length)).toBe(true);
    const tasks = await prepareImport(preview.items.map(item => ({ task: item.task!, state: "CONFIRMED", independent: false })), "owner", "device-a");
    expect(tasks[1].eventEndDate).toBeNull();
    expect(tasks[1].dueDate).toBeNull();
    const snapshot = { ...createEmptySnapshot(), tasks };
    expect(actionRolesOnDate(tasks[0], "2027-02-05")).toEqual(["WINDOW", "DEADLINE"]);
    expect(getRecordsForDate(snapshot, "2027-02-03").tasks).toHaveLength(1);
    expect(getCalendarMarkers(snapshot, "2027-02-01")["2027-02-05"].tasks.confirmedCount).toBe(1);
    expect(getRecordsForDate(snapshot, "2027-01-01").tasks).toHaveLength(0);
  });
  it("rejects verified claims, nonexistent dates and invalid kind combinations per item", () => {
    const batch = JSON.parse(ACTION_IMPORT_EXAMPLE);
    batch.items[0].verified = true;
    batch.items[1].schedule.eventStartDate = "2027-02-30";
    const parsed = parseActionImport(JSON.stringify(batch));
    expect(parsed.items[0].issues[0].code).toBe("UNSUPPORTED_FIELD");
    expect(parsed.items[1].issues[0].code).toBe("INVALID_DATE");
    delete batch.items[0].verified;
    batch.items[0].schedule.eventStartDate = "2027-03-01";
    expect(parseActionImport(JSON.stringify(batch)).items[0].issues[0].code).toBe("INVALID_COMBINATION");
  });
  it("does not invent unknown dates and retains the relative-date reference", () => {
    const batch = JSON.parse(ACTION_IMPORT_EXAMPLE);
    batch.items = [batch.items[1]];
    batch.items[0].schedule = { timeZone: "Asia/Seoul" };
    batch.items[0].source.dateReference = { baseDate: "2026-10-18", timeZone: "Asia/Seoul" };
    const task = parseActionImport(JSON.stringify(batch)).items[0].task!;
    expect(firstActionDate(task)).toBeNull();
    expect(task.sourceReferenceDate).toBe("2026-10-18");
  });
  it("keeps edits and tombstones when the same identity is imported again", async () => {
    const preview = parseActionImport(ACTION_IMPORT_EXAMPLE);
    const proposed = await prepareImport([{ task: preview.items[0].task!, state: "CONFIRMED", independent: false }], "owner", "device-a");
    const current = { ...createEmptySnapshot(), tasks: [{ ...proposed[0], text: "내가 수정한 이름", isDone: true, plannedDate: "2027-02-02" }] };
    const results: Parameters<typeof applyImportedTasks>[2] = [];
    expect(applyImportedTasks(current, proposed, results)).toBe(current);
    expect(results[0].outcome).toBe("REVIEW_REQUIRED");
    expect(current.tasks[0].isDone).toBe(true);
    current.tasks[0].deletedAt = "2026-10-18T00:00:00Z";
    applyImportedTasks(current, proposed, results);
    expect(results[0].outcome).toBe("DELETED_MATCH");
  });
  it("uses deterministic IDs scoped by owner and keeps distinct actions apart", async () => {
    const id = await actionId("owner-a", "exam", "2027:1:registration");
    expect(await actionId("owner-a", "exam", "2027:1:registration")).toBe(id);
    expect(await actionId("owner-b", "exam", "2027:1:registration")).not.toBe(id);
    expect(await actionId("owner-a", "exam", "2027:1:exam")).not.toBe(id);
    expect(id).toMatch(/^[0-9a-f-]{14}5[0-9a-f]{3}-[89ab]/);
  });
  it("converts precise foreign events, excludes midnight end, and keeps mixed precision on source dates", () => {
    const task = makeTask({ kind: "EVENT", eventStartDate: "2026-10-18", eventStartTime: "10:00", eventEndDate: "2026-10-19", eventEndTime: "00:00", timeZone: "Asia/Seoul" });
    expect(actionRolesOnDate(task, "2026-10-19")).toEqual([]);
    const foreign = { ...task, eventStartDate: "2026-10-18", eventStartTime: "20:00", eventEndDate: null, eventEndTime: null, timeZone: "America/New_York" };
    expect(firstActionDate(foreign)).toBe("2026-10-19");
    const mixed = makeTask({ kind: "REGISTRATION", windowStartDate: "2026-10-18", windowStartTime: null, dueDate: "2026-10-19", dueTime: "23:00", timeZone: "America/New_York" });
    expect(actionRolesOnDate(mixed, "2026-10-19")).toEqual(["WINDOW", "DEADLINE"]);
    expect(actionRolesOnDate(mixed, "2026-10-20")).toEqual([]);
  });
  it("rejects DST gaps and folds without guessing an offset", () => {
    expect(exactInstant("2026-03-08", "02:30", "America/New_York")).toBeNull();
    expect(exactInstant("2026-11-01", "01:30", "America/New_York")).toBeNull();
    expect(exactInstant("2026-11-01", "03:00", "America/New_York")).not.toBeNull();
  });
  it("preserves registration and source provenance when editing checked evidence", () => {
    const task = makeTask({ kind: "EVENT", registrationState: "CONFIRMED", sourceType: "EXTERNAL_NOTICE", verificationStatus: "SOURCE_CHECKED", sourceUrl: "https://example.org", sourceCheckedAt: "2026-01-01T00:00:00Z", sourceCheckedBy: "owner", eventStartDate: "2027-01-01" });
    const changed = editAction(task, { eventStartDate: "2027-01-02" }, "device-a", "owner");
    expect(changed.registrationState).toBe("CONFIRMED");
    expect(changed.sourceType).toBe("EXTERNAL_NOTICE");
    expect(changed.verificationStatus).toBe("UNVERIFIED");
    expect(changed.sourceCheckedAt).toBeNull();
    expect(editAction(task, { plannedDate: "2026-12-01" }, "device-a", "owner").verificationStatus).toBe("SOURCE_CHECKED");
  });
  it("round-trips all imported schedule and provenance fields through remote mapping", () => {
    const task = parseActionImport(ACTION_IMPORT_EXAMPLE).items[0].task!;
    const restored = taskFromRow(taskToRow(task, "owner"));
    for (const key of Object.keys(task) as (keyof typeof task)[]) if (key !== "actionOwnerScope") expect(restored[key], key).toEqual(task[key]);
  });
  it("rejects unsafe edited links, blank titles, and forged verification", () => {
    const task = parseActionImport(ACTION_IMPORT_EXAMPLE).items[0].task!;
    expect(() => editAction(task, { sourceUrl: "javascript:alert(1)" }, "device-a", "owner")).toThrow(/http/);
    expect(() => editAction(task, { text: "  " }, "device-a", "owner")).toThrow();
    expect(() => editAction(task, { verificationStatus: "SOURCE_CHECKED" }, "device-a", "owner")).toThrow(/직접 수정/);
  });
});
