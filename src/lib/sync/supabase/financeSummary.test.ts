import { describe, expect, it, vi } from "vitest";
import {
  fetchFinanceDailySummaries,
  financeDailySummaryFromRow,
  type FinanceSummaryTransport,
} from "./financeSummary";
import type { FinanceDailySummarySelectedRow } from "./rows";

describe("Supabase finance summary", () => {
  it.each([null, "", "NaN", "1.5", Infinity, "9007199254740992"])("rejects invalid or lossy financial amounts: %s", (amount) => {
    expect(() => financeDailySummaryFromRow({ date: "2026-11-06", income_krw: 0, expense_krw: amount, net_krw: 0, entry_count: 1 } as FinanceDailySummarySelectedRow)).toThrow("금액 또는 건수");
  });
  it("rejects impossible dates and negative entry counts", () => {
    const row = { date: "2026-02-30", income_krw: 0, expense_krw: 0, net_krw: 0, entry_count: 1 };
    expect(() => financeDailySummaryFromRow(row)).toThrow("날짜");
    expect(() => financeDailySummaryFromRow({ ...row, date: "2026-11-06", entry_count: -1 })).toThrow("건수");
  });
  it("normalizes Postgres numeric values", () => {
    const row = {
      date: "2026-08-01",
      income_krw: "10000",
      expense_krw: "2500",
      net_krw: "7500",
      entry_count: "3",
    } as unknown as FinanceDailySummarySelectedRow;

    expect(financeDailySummaryFromRow(row)).toEqual({
      date: "2026-08-01",
      incomeKrw: 10_000,
      expenseKrw: 2_500,
      netKrw: 7_500,
      entryCount: 3,
    });
  });

  it("passes the authenticated range to the transport and propagates errors", async () => {
    const queryError = new Error("finance view denied");
    const transport: FinanceSummaryTransport = {
      selectDailySummaries: vi.fn(async () => ({
        data: null,
        error: queryError,
      })),
    };

    await expect(
      fetchFinanceDailySummaries(
        transport,
        "user-1",
        "2026-08-01",
        "2026-08-31",
      ),
    ).rejects.toBe(queryError);
    expect(transport.selectDailySummaries).toHaveBeenCalledWith(
      "user-1",
      "2026-08-01",
      "2026-08-31",
    );
  });
});
