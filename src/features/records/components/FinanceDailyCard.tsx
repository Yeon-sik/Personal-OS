import { RefreshCw } from "lucide-react";
import type { FinanceDailySummary } from "../../../lib/sync/syncTypes";
import { formatKoreanDate } from "../../fitness/fitnessDate";
import { formatKrw } from "../../finance/financeCalendar";

interface FinanceDailyCardProps {
  financeEnabled: boolean;
  financeError: string | null;
  isFinanceLoading: boolean;
  onRefresh: () => Promise<void>;
  selectedDate: string;
  selectedFinance: FinanceDailySummary | undefined;
}

export function FinanceDailyCard({
  financeEnabled,
  financeError,
  isFinanceLoading,
  onRefresh,
  selectedDate,
  selectedFinance,
}: FinanceDailyCardProps) {
  return (
    <div className="win-panel rounded-md border border-slate-300 bg-white p-3 dark:border-neutral-800 dark:bg-black">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-slate-950 dark:text-neutral-50">
            CashOS 현금 흐름
          </h3>
          <p className="mt-0.5 text-xs text-slate-500 dark:text-neutral-400">
            {formatKoreanDate(selectedDate)} 기준 확정 수입·지출
          </p>
        </div>
        <button
          type="button"
          onClick={() => void onRefresh()}
          disabled={!financeEnabled || isFinanceLoading}
          className="inline-flex h-8 items-center gap-1.5 rounded-md border border-slate-300 px-2.5 text-xs font-semibold text-slate-700 disabled:cursor-not-allowed disabled:opacity-50 dark:border-neutral-700 dark:text-neutral-200"
        >
          <RefreshCw
            className={`h-3.5 w-3.5 ${isFinanceLoading ? "animate-spin" : ""}`}
            aria-hidden="true"
          />
          새로고침
        </button>
      </div>

      {!financeEnabled ? (
        <p className="mt-3 rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:bg-amber-950/30 dark:text-amber-200">
          CashOS와 같은 Supabase 프로젝트·계정으로 로그인하면 금융 기록이 표시됩니다.
        </p>
      ) : financeError ? (
        <p className="mt-3 rounded-md bg-rose-50 px-3 py-2 text-xs text-rose-700 dark:bg-rose-950/30 dark:text-rose-200">
          {financeError}
        </p>
      ) : selectedFinance ? (
        <div className="mt-3 grid grid-cols-3 gap-2">
          <div className="rounded-md bg-emerald-50 p-2 dark:bg-emerald-950/30">
            <div className="text-[11px] text-emerald-700 dark:text-emerald-300">수입</div>
            <div className="mt-1 truncate text-sm font-bold text-emerald-800 dark:text-emerald-200">
              +{formatKrw(selectedFinance.incomeKrw)}
            </div>
          </div>
          <div className="rounded-md bg-rose-50 p-2 dark:bg-rose-950/30">
            <div className="text-[11px] text-rose-700 dark:text-rose-300">지출</div>
            <div className="mt-1 truncate text-sm font-bold text-rose-800 dark:text-rose-200">
              -{formatKrw(selectedFinance.expenseKrw)}
            </div>
          </div>
          <div className="rounded-md bg-slate-100 p-2 dark:bg-neutral-900">
            <div className="text-[11px] text-slate-600 dark:text-neutral-400">
              순액 · {selectedFinance.entryCount}건
            </div>
            <div className="mt-1 truncate text-sm font-bold text-slate-900 dark:text-neutral-100">
              {formatKrw(selectedFinance.netKrw)}
            </div>
          </div>
        </div>
      ) : (
        <p className="mt-3 text-xs text-slate-500 dark:text-neutral-400">
          선택한 날짜에 확정된 수입·지출 기록이 없습니다.
        </p>
      )}
    </div>
  );
}
