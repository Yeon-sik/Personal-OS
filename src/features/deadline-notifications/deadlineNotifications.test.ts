import { describe, expect, it, vi } from "vitest";
import { ACTION_DEFAULTS } from "../actions/actionModel";
import { makeTask } from "../../lib/sync/supabase/testFixtures";
import { reconcileDeadlineNotifications as plan, type DeadlineSettings, type OwnedDeadlineNotification } from "./deadlinePlanner";
import { DEADLINE_REGISTRY_KEY, DeadlineStorage } from "./deadlineStorage";
import { DeadlineScheduler, type DeadlineTransport, type PendingDeadlineNotification } from "./deadlineScheduler";

const settings: DeadlineSettings = { enabled: true, time: "09:00", timeZone: "Asia/Seoul" };
const now = "2027-01-01T00:00:00Z";
const task = makeTask({ ...ACTION_DEFAULTS, id: "deadline-task", text: "시험 접수", dueDate: "2027-01-04" });
const run = (overrides = {}, time = "2026-12-31T00:00:00Z", previous: OwnedDeadlineNotification[] = [], config = settings) => plan([{ ...task, ...overrides }], config, time, "account-a", previous);

class MemoryStorage implements Storage {
  values = new Map<string, string>();
  get length() { return this.values.size; }
  getItem(key: string) { return this.values.get(key) ?? null; }
  setItem(key: string, value: string) { this.values.set(key, value); }
  removeItem(key: string) { this.values.delete(key); }
  key(index: number) { return [...this.values.keys()][index] ?? null; }
  clear() { this.values.clear(); }
}
function harness() {
  const local = new MemoryStorage();
  const storage = new DeadlineStorage(() => local);
  const native = new Map<number, PendingDeadlineNotification>();
  const transport: DeadlineTransport = {
    supported: true, permission: vi.fn().mockResolvedValue(true), exactPermission: vi.fn().mockResolvedValue(true),
    requestPermission: vi.fn().mockResolvedValue(true), openExactSettings: vi.fn().mockResolvedValue(undefined),
    pending: vi.fn(async () => [...native.values()]),
    cancel: vi.fn(async (ids: number[]) => { ids.forEach(id => native.delete(id)); }),
    schedule: vi.fn(async row => { native.set(row.id, { id: row.id, title: row.title, body: row.body }); }),
  };
  return { local, storage, native, transport, scheduler: new DeadlineScheduler(transport, storage) };
}

describe("derived deadline notification planner", () => {
  it("reserves D-3..D-day ahead of time but has no D-4 delivery", () => {
    const result = run();
    expect(result.add.map(row => row.fireDate)).toEqual(["2027-01-01", "2027-01-02", "2027-01-03", "2027-01-04"]);
    expect(result.add.filter(row => row.fireDate === "2026-12-31")).toHaveLength(0);
    expect(result.add.map(row => row.title)).toEqual(["Personal OS · D-3", "Personal OS · D-2", "Personal OS · D-1", "Personal OS · D-day"]);
  });
  it.each([1, 2, 3, 4])("has one delivery on January %s at the exact configured local clock", day => {
    const date = `2027-01-0${day}`;
    const result = run({}, `${date}T00:00:00-01:00`); // 10:00 Seoul: today's clock already passed.
    expect(result.add.filter(row => row.fireDate === date)).toHaveLength(0);
    const before = run({}, `${date}T00:00:00+01:00`);
    expect(before.add.filter(row => row.fireDate === date).map(row => row.at)).toEqual([`${date}T00:00:00Z`]);
  });
  it("requires an explicit enabled flag and a configured time", () => {
    expect(run({}, now, [], { ...settings, enabled: false }).add).toEqual([]);
    expect(run({}, now, [], { ...settings, time: null }).add).toEqual([]);
  });
  it("skips D-day when dueTime is earlier than the notification clock", () => {
    const result = run({ dueTime: "08:00" });
    expect(result.add.map(row => row.fireDate)).toEqual(["2027-01-01", "2027-01-02", "2027-01-03"]);
  });
  it.each([{ registrationState: "CANDIDATE" }, { isDone: true }, { deletedAt: now }, { dueDate: "2026-12-20" }])("excludes ineligible or past Action %j", fields => {
    expect(run(fields).add).toEqual([]);
  });
  it("uses EXAM/EVENT start fallback and ignores plannedDate-only or window-only tasks", () => {
    expect(run({ dueDate: null, kind: "EXAM", eventStartDate: task.dueDate }).add).toHaveLength(4);
    expect(run({ dueDate: null, kind: "EVENT", eventStartDate: task.dueDate }).add[0].body).toContain("시작");
    expect(run({ dueDate: null, plannedDate: task.dueDate }).add).toEqual([]);
    expect(run({ dueDate: null, windowStartDate: task.dueDate }).add).toEqual([]);
  });
  it("preserves the Action timezone across the UTC date boundary", () => {
    expect(run({ dueDate: "2027-01-01" }, "2026-12-31T23:00:00Z").add.map(row => row.at)).toEqual(["2027-01-01T00:00:00Z"]);
    expect(run({}, "2026-12-31T00:00:00Z", [], { ...settings, time: "14:35" }).add[0].at).toBe("2027-01-01T05:35:00Z");
  });
  it("moves DST gap forward and schedules the earlier fold occurrence only once", () => {
    expect(run({ dueDate: "2027-03-14", timeZone: "America/New_York" }, "2027-03-14T05:00:00Z", [], { ...settings, time: "02:30" }).add.map(row => row.at)).toEqual(["2027-03-14T07:30:00Z"]);
    expect(run({ dueDate: "2027-11-07", timeZone: "America/New_York" }, "2027-11-07T04:00:00Z", [], { ...settings, time: "01:30" }).add.map(row => row.at)).toEqual(["2027-11-07T05:30:00Z"]);
  });
  it("reports invalid dates/timezones without inventing an instant", () => {
    expect(run({ dueDate: "2027-02-30" }).issues).toHaveLength(1);
    expect(run({ timeZone: "Not/AZone" }).add).toEqual([]);
  });
  it("cancels/replaces edits, cancels completion/deletion and reschedules restore", () => {
    const old = run().add.map(row => ({ ...row, applied: true }));
    const unchanged = run({}, undefined, old);
    expect(unchanged.add).toEqual([]); expect(unchanged.cancel).toEqual([]); expect(unchanged.unchanged).toHaveLength(4);
    expect(run({ dueDate: "2027-02-04" }, undefined, old).cancel).toHaveLength(4);
    expect(run({ dueDate: "2027-02-04" }, undefined, old).add).toHaveLength(4);
    expect(run({ isDone: true }, undefined, old).cancel).toHaveLength(4);
    expect(run({ deletedAt: now }, undefined, old).cancel).toHaveLength(4);
    expect(run({ deletedAt: null, isDone: false }, "2027-01-03T01:00:00Z").add).toHaveLength(1);
  });
  it("detects integer ID collisions and reserves a different deterministic ID", () => {
    const result = plan([task, { ...task, id: "other" }], settings, "2026-12-31T00:00:00Z", "a", [], [99], () => 99);
    expect(result.add).toHaveLength(8);
    expect(new Set(result.add.map(row => row.id)).size).toBe(8);
    expect(result.add.every(row => row.id !== 99)).toBe(true);
    expect(plan([task], settings, now, "another-owner", result.add).cancel).toHaveLength(8);
  });
});

describe("OS scheduler ownership, crash recovery and device boundaries", () => {
  it("replaces legacy native payloads once while preserving owned IDs and unrelated notifications", async () => {
    const h = harness();
    h.native.set(99, { id: 99, title: "another feature" });
    await h.scheduler.reconcile([task], settings, "a", "2026-12-31T00:00:00Z");
    const legacy = h.storage.loadOwned().map(({ nativeRevision: _revision, ...row }) => row);
    h.storage.saveOwned(legacy);
    const restarted = new DeadlineScheduler(h.transport, h.storage);
    await restarted.reconcile([task], settings, "a", "2026-12-31T00:00:00Z");
    expect(h.storage.loadOwned().map(row => row.id)).toEqual(legacy.map(row => row.id));
    expect(h.storage.loadOwned().every(row => row.nativeRevision === 2 && row.applied)).toBe(true);
    expect(h.transport.cancel).toHaveBeenCalledTimes(4);
    expect(h.transport.cancel).not.toHaveBeenCalledWith([99]);
    expect(h.native.get(99)?.title).toBe("another feature");
    await restarted.reconcile([task], settings, "a", "2026-12-31T00:00:00Z");
    expect(h.transport.schedule).toHaveBeenCalledTimes(8);
    expect(h.transport.cancel).toHaveBeenCalledTimes(4);
  });
  it("restores persistent ownership after restart without duplicate native scheduling", async () => {
    const h = harness();
    await h.scheduler.reconcile([task], settings, "a", "2026-12-31T00:00:00Z");
    expect(h.transport.schedule).toHaveBeenCalledTimes(4);
    await new DeadlineScheduler(h.transport, h.storage).reconcile([task], settings, "a", "2026-12-31T00:00:00Z");
    expect(h.transport.schedule).toHaveBeenCalledTimes(4);
    expect(h.transport.cancel).not.toHaveBeenCalled();
    expect(h.storage.loadOwned()).toHaveLength(4);
  });
  it("preserves unrelated notifications while editing/completing/deleting/restoring", async () => {
    const h = harness(); h.native.set(99, { id: 99, title: "unrelated" });
    await h.scheduler.reconcile([task], settings, "a", "2026-12-31T00:00:00Z");
    await h.scheduler.reconcile([{ ...task, dueDate: "2027-02-04" }], settings, "a", now);
    expect(h.native.size).toBe(5);
    await h.scheduler.reconcile([{ ...task, isDone: true }], settings, "a", now);
    expect([...h.native.keys()]).toEqual([99]);
    await h.scheduler.reconcile([task], settings, "a", "2026-12-31T00:00:00Z");
    await h.scheduler.reconcile([{ ...task, deletedAt: now }], settings, "a", now);
    expect([...h.native.keys()]).toEqual([99]);
    await h.scheduler.reconcile([task], settings, "a", "2027-01-03T01:00:00Z");
    expect(h.native.size).toBe(2);
    expect(h.transport.cancel).not.toHaveBeenCalledWith([99]);
  });
  it("does not schedule before persisting ownership and recovers a crash after the OS write", async () => {
    const h = harness();
    const write = vi.spyOn(h.local, "setItem").mockImplementationOnce(() => { throw new Error("quota"); });
    await expect(h.scheduler.reconcile([task], settings, "a", now)).rejects.toThrow("quota");
    expect(h.transport.schedule).not.toHaveBeenCalled(); write.mockRestore();
    const save = h.local.setItem.bind(h.local); let calls = 0;
    const crash = vi.spyOn(h.local, "setItem").mockImplementation((key, value) => { if (++calls === 2) throw new Error("crash"); save(key, value); });
    await expect(h.scheduler.reconcile([task], settings, "a", "2026-12-31T00:00:00Z")).rejects.toThrow("crash");
    expect(h.storage.loadOwned()[0].applied).toBe(false); crash.mockRestore();
    await new DeadlineScheduler(h.transport, h.storage).reconcile([task], settings, "a", "2026-12-31T00:00:00Z");
    expect(h.native.size).toBe(4);
    expect(h.storage.loadOwned().every(row => row.applied)).toBe(true);
  });
  it("never marks a missing OS confirmation successful", async () => {
    const h = harness(); vi.mocked(h.transport.schedule).mockResolvedValue(undefined);
    await expect(h.scheduler.reconcile([task], settings, "a", now)).rejects.toThrow("확정값");
    expect(h.storage.loadOwned()[0].applied).toBe(false);
  });
  it("fails closed on damaged registry or an ID now occupied by an unrelated notification", async () => {
    const h = harness(); h.local.setItem(DEADLINE_REGISTRY_KEY, "broken");
    await expect(h.scheduler.reconcile([task], settings, "a", now)).rejects.toThrow();
    expect(h.transport.cancel).not.toHaveBeenCalled(); h.local.removeItem(DEADLINE_REGISTRY_KEY);
    await h.scheduler.reconcile([task], settings, "a", now);
    const id = h.storage.loadOwned()[0].id; h.native.set(id, { id, title: "another feature" });
    await expect(h.scheduler.reconcile([], settings, "a", now)).rejects.toThrow("충돌");
    expect(h.native.get(id)?.title).toBe("another feature");
  });
  it("cancels only owned schedules on denied/revoked permission without prompt loops", async () => {
    const h = harness(); await h.scheduler.reconcile([task], settings, "a", now);
    vi.mocked(h.transport.permission).mockResolvedValue(false);
    const result = await h.scheduler.reconcile([task], settings, "a", now);
    expect(result.permission).toBe("denied"); expect(result.count).toBe(0);
    await h.scheduler.reconcile([task], settings, "a", now);
    expect(h.transport.requestPermission).not.toHaveBeenCalled();
    expect(h.native.size).toBe(0);
  });
  it("requires exact-alarm permission and never calls mobile APIs on desktop", async () => {
    const h = harness(); vi.mocked(h.transport.exactPermission).mockResolvedValue(false);
    expect((await h.scheduler.reconcile([task], settings, "a", now)).count).toBe(0);
    expect(h.transport.schedule).not.toHaveBeenCalled();
    h.transport.supported = false;
    expect((await h.scheduler.reconcile([task], settings, "a", now)).permission).toBe("unsupported");
    expect(h.transport.pending).toHaveBeenCalledTimes(1);
  });
  it("rechecks the clock after a slow native write instead of scheduling a past alarm", async () => {
    const h = harness();
    let clock = "2026-12-31T00:00:00Z";
    const schedule = h.transport.schedule;
    h.transport.schedule = vi.fn(async row => {
      await schedule(row);
      clock = "2027-01-02T00:00:01Z";
    });
    const scheduler = new DeadlineScheduler(h.transport, h.storage, () => clock);
    await scheduler.reconcile([task], settings, "a");
    expect(vi.mocked(h.transport.schedule).mock.calls.map(([row]) => row.fireDate)).toEqual(["2027-01-01", "2027-01-03", "2027-01-04"]);
    expect(h.storage.loadOwned().some(row => row.fireDate === "2027-01-02")).toBe(false);
  });
});
