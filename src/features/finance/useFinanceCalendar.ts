import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import type { FinanceDailySummary } from "../../lib/sync/syncTypes";
import {
  getFinanceMonthRange,
  indexFinanceSummaries,
  type FinanceSummaryByDate,
} from "./financeCalendar";

interface UseFinanceCalendarOptions {
  enabled: boolean;
  online?: boolean;
  /** Backend + authenticated account. Never reuse financial results across this boundary. */
  scopeKey?: string;
  visibleMonth: string;
  loadSummaries: (
    fromDate: string,
    toDate: string,
  ) => Promise<FinanceDailySummary[]>;
}

export function useFinanceCalendar({
  enabled,
  online = true,
  scopeKey = "default",
  visibleMonth,
  loadSummaries,
}: UseFinanceCalendarOptions): {
  error: string | null;
  financeByDate: FinanceSummaryByDate;
  isLoading: boolean;
  lastFetchedAt: string | null;
  refresh: () => Promise<void>;
} {
  const range = useMemo(
    () => getFinanceMonthRange(visibleMonth),
    [visibleMonth],
  );
  const query = useMemo(() => ({ scopeKey, loadSummaries, ...range }),
    [scopeKey, loadSummaries, range.fromDate, range.toDate]);
  type Result = { query: typeof query; financeByDate: FinanceSummaryByDate; isLoading: boolean; error: string | null; lastFetchedAt: string | null };
  const [result, setResult] = useState<Result | null>(null);
  const active = useRef<object | null>(null);
  const inFlight = useRef<{ lifetime: object; promise: Promise<void> } | null>(null);

  const refresh = useCallback(async () => {
    const lifetime = active.current;
    if (!enabled || !online || !lifetime) return;
    if (inFlight.current?.lifetime === lifetime) return inFlight.current.promise;
    const previous = (current: Result | null): Result => current?.query === query ? current : {
      query, financeByDate: {}, isLoading: false, error: null, lastFetchedAt: null,
    };
    setResult(current => ({ ...previous(current), isLoading: true, error: null }));
    const promise = (async () => {
      try {
        const summaries = await Promise.resolve().then(() => query.loadSummaries(query.fromDate, query.toDate));
        if (active.current !== lifetime) return;
        setResult({ query, financeByDate: indexFinanceSummaries(summaries), isLoading: false, error: null, lastFetchedAt: new Date().toISOString() });
      } catch (caughtError) {
        if (active.current !== lifetime) return;
        const message = caughtError instanceof Error ? caughtError.message : "CashOS 요약을 읽지 못했습니다. 연결 설정을 확인한 뒤 다시 시도해 주세요.";
        setResult(current => ({ ...previous(current), isLoading: false, error: message }));
      } finally {
        if (inFlight.current?.lifetime === lifetime) inFlight.current = null;
      }
    })();
    inFlight.current = { lifetime, promise };
    return promise;
  }, [enabled, online, query]);

  useEffect(() => {
    active.current = {};
    if (!enabled) setResult(null);
    void refresh();
    const handleFocus = () => {
      if (document.visibilityState !== "hidden") void refresh();
    };
    if (enabled && online) {
      window.addEventListener("focus", handleFocus);
      document.addEventListener("visibilitychange", handleFocus);
    }
    const intervalId = enabled && online ? window.setInterval(handleFocus, 30_000) : null;
    return () => {
      active.current = null;
      if (enabled && online) {
        window.removeEventListener("focus", handleFocus);
        document.removeEventListener("visibilitychange", handleFocus);
      }
      if (intervalId !== null) window.clearInterval(intervalId);
    };
  }, [enabled, online, refresh]);

  // Hide the old account/month on render, before effects or late requests can run.
  const current = enabled && result?.query === query ? result : null;
  return {
    error: current?.error ?? null,
    financeByDate: current?.financeByDate ?? {},
    isLoading: enabled && online && (current?.isLoading ?? true),
    lastFetchedAt: current?.lastFetchedAt ?? null,
    refresh,
  };
}
