import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { FinanceDailySummary } from "../../lib/sync/syncTypes";
import { useFinanceCalendar } from "./useFinanceCalendar";

type Options = Parameters<typeof useFinanceCalendar>[0];
let result: ReturnType<typeof useFinanceCalendar>;
let renderer: ReactTestRenderer | undefined;
function Harness(props: Options) { result = useFinanceCalendar(props); return null; }
function deferred<T>() { let resolve!: (value: T) => void; let reject!: (reason: unknown) => void; const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; }
const row = (date: string, expenseKrw = 100): FinanceDailySummary => ({ date, expenseKrw, incomeKrw: 0, netKrw: -expenseKrw, entryCount: 1 });
const listeners = new Map<string, () => void>();
beforeEach(() => {
  vi.useFakeTimers();
  vi.stubGlobal("window", { setInterval, clearInterval, addEventListener: (name: string, callback: () => void) => listeners.set(name, callback), removeEventListener: (name: string) => listeners.delete(name) });
  vi.stubGlobal("document", { visibilityState: "visible", addEventListener: vi.fn(), removeEventListener: vi.fn() });
});
afterEach(() => { act(() => renderer?.unmount()); renderer = undefined; listeners.clear(); vi.unstubAllGlobals(); vi.useRealTimers(); });
async function render(props: Options) { await act(async () => { renderer = create(<Harness {...props} />); }); }
async function update(props: Options) { await act(async () => { renderer!.update(<Harness {...props} />); }); }

describe("finance request ownership", () => {
  it("recovers when a transport throws before returning a promise", async () => {
    const loadSummaries = vi.fn().mockImplementationOnce(() => { throw new Error("no client"); }).mockResolvedValueOnce([]);
    await render({ enabled: true, visibleMonth: "2026-11-06", loadSummaries });
    expect(result.error).toBe("no client");
    await act(async () => result.refresh());
    expect(result.error).toBeNull();
    expect(loadSummaries).toHaveBeenCalledTimes(2);
  });

  it("discards old account results even when they finish after the new account", async () => {
    const old = deferred<FinanceDailySummary[]>();
    const next = deferred<FinanceDailySummary[]>();
    const props: Options = { enabled: true, scopeKey: "account-a", visibleMonth: "2026-11-06", loadSummaries: vi.fn(() => old.promise) };
    await render(props);
    await update({ ...props, scopeKey: "account-b", loadSummaries: () => next.promise });
    expect(result.financeByDate).toEqual({});
    await act(async () => next.resolve([row("2026-11-06", 200)]));
    await act(async () => old.resolve([row("2026-11-06", 999)]));
    expect(result.financeByDate["2026-11-06"].expenseKrw).toBe(200);
  });

  it("ignores a late month and late failures, clears old values on month change", async () => {
    const old = deferred<FinanceDailySummary[]>();
    const loadSummaries = vi.fn().mockReturnValueOnce(old.promise).mockResolvedValue([row("2026-12-01")]);
    const props = { enabled: true, visibleMonth: "2026-11-06", loadSummaries };
    await render(props);
    await update({ ...props, visibleMonth: "2026-12-01" });
    await act(async () => old.reject(new Error("old request failed")));
    expect(result.error).toBeNull();
    expect(Object.keys(result.financeByDate)).toEqual(["2026-12-01"]);
    expect(loadSummaries).toHaveBeenLastCalledWith("2026-12-01", "2026-12-31");
  });

  it("clears on sign-out and ignores an in-flight reply", async () => {
    const pending = deferred<FinanceDailySummary[]>();
    const props = { enabled: true, visibleMonth: "2026-11-06", loadSummaries: () => pending.promise };
    await render(props);
    await update({ ...props, enabled: false });
    await act(async () => pending.resolve([row("2026-11-06")]));
    expect(result.financeByDate).toEqual({});
    expect(result.lastFetchedAt).toBeNull();
    expect(result.isLoading).toBe(false);
  });

  it("retains successful results offline and refreshes on reconnection", async () => {
    const loadSummaries = vi.fn().mockResolvedValue([row("2026-11-06")]);
    const props = { enabled: true, online: true, visibleMonth: "2026-11-06", loadSummaries };
    await render(props);
    expect(result.lastFetchedAt).not.toBeNull();
    await update({ ...props, online: false });
    await act(async () => result.refresh());
    expect(loadSummaries).toHaveBeenCalledTimes(1);
    expect(Object.keys(result.financeByDate)).toEqual(["2026-11-06"]);
    expect(result.isLoading).toBe(false);
    await update(props);
    expect(loadSummaries).toHaveBeenCalledTimes(2);
  });

  it("coalesces focus, poll and manual refreshes until the request finishes", async () => {
    const pending = deferred<FinanceDailySummary[]>();
    const loadSummaries = vi.fn(() => pending.promise);
    await render({ enabled: true, visibleMonth: "2026-11-06", loadSummaries });
    act(() => { void result.refresh(); listeners.get("focus")?.(); vi.advanceTimersByTime(30_000); });
    expect(loadSummaries).toHaveBeenCalledTimes(1);
    await act(async () => pending.resolve([]));
    expect(result.lastFetchedAt).not.toBeNull();
    expect(result.error).toBeNull();
    expect(result.financeByDate).toEqual({});
  });

  it("keeps cached data on a failed refresh and recovers on retry", async () => {
    const loadSummaries = vi.fn().mockResolvedValueOnce([row("2026-11-06")]).mockRejectedValueOnce(new Error("network unavailable")).mockResolvedValueOnce([]);
    await render({ enabled: true, visibleMonth: "2026-11-06", loadSummaries });
    await act(async () => result.refresh());
    expect(result.error).toBe("network unavailable");
    expect(result.financeByDate["2026-11-06"].entryCount).toBe(1);
    await act(async () => result.refresh());
    expect(result.error).toBeNull();
    expect(result.financeByDate).toEqual({});
  });
});
