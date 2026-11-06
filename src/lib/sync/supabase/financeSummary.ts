import type { FinanceDailySummary } from "../syncTypes";
import type {
  FinanceDailySummarySelectedRow,
  SupabaseClient,
} from "./rows";

export interface FinanceSummaryQueryResult {
  data: FinanceDailySummarySelectedRow[] | null;
  error: unknown | null;
}

export interface FinanceSummaryTransport {
  selectDailySummaries(
    userId: string,
    fromDate: string,
    toDate: string,
  ): Promise<FinanceSummaryQueryResult>;
}

interface FinanceSummaryTableLike {
  select(columns: string): {
    eq(column: string, value: string): {
      gte(column: string, value: string): {
        lte(column: string, value: string): {
          order(
            column: string,
            options: { ascending: boolean },
          ): Promise<FinanceSummaryQueryResult>;
        };
      };
    };
  };
}

export function createSupabaseFinanceSummaryTransport(
  supabase: SupabaseClient,
): FinanceSummaryTransport {
  return {
    selectDailySummaries(userId, fromDate, toDate) {
      const table = supabase.from(
        "finance_summary_daily",
      ) as unknown as FinanceSummaryTableLike;
      return table
        .select("date,income_krw,expense_krw,net_krw,entry_count")
        .eq("user_id", userId)
        .gte("date", fromDate)
        .lte("date", toDate)
        .order("date", { ascending: true });
    },
  };
}

export function financeDailySummaryFromRow(
  row: FinanceDailySummarySelectedRow,
): FinanceDailySummary {
  function integer(value: unknown): number {
    if ((typeof value !== "number" && (typeof value !== "string" || !/^-?\d+$/.test(value))) || !Number.isSafeInteger(Number(value))) {
      throw new Error("CashOS 요약의 금액 또는 건수를 읽을 수 없습니다. 원본 데이터와 연결 상태를 확인해 주세요.");
    }
    return Number(value);
  }
  const date = row.date;
  if (typeof date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(Date.parse(date + "T00:00:00Z")) || new Date(date + "T00:00:00Z").toISOString().slice(0, 10) !== date) {
    throw new Error("CashOS 요약의 날짜가 올바르지 않습니다.");
  }
  const entryCount = integer(row.entry_count);
  if (entryCount < 0) throw new Error("CashOS 요약의 건수가 올바르지 않습니다.");
  return {
    date,
    incomeKrw: integer(row.income_krw),
    expenseKrw: integer(row.expense_krw),
    netKrw: integer(row.net_krw),
    entryCount,
  };
}

export async function fetchFinanceDailySummaries(
  transport: FinanceSummaryTransport,
  userId: string,
  fromDate: string,
  toDate: string,
): Promise<FinanceDailySummary[]> {
  const result = await transport.selectDailySummaries(
    userId,
    fromDate,
    toDate,
  );
  if (result.error) {
    throw result.error;
  }

  return (result.data ?? []).map(financeDailySummaryFromRow);
}
