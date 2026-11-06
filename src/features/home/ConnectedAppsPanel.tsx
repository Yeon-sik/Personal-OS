import type { LocalDataSnapshot } from "../../types";
import type { FinanceDailySummary, FitnessReadModelName, SyncStatus } from "../../lib/sync/syncTypes";
import { formatKrw } from "../finance/financeCalendar";
import { useFinanceCalendar } from "../finance/useFinanceCalendar";
import { formatNutritionMetric } from "../fitness-summary/FitnessNutritionCard";
import { getVisibleSharedWorkouts } from "../fitness-summary/sharedWorkoutSummaries";
import { addDays } from "../actions/actionTime";

export interface ConnectedAppsPanelProps {
  snapshot: LocalDataSnapshot;
  syncStatus: SyncStatus;
  enabled: boolean;
  scopeKey: string;
  today: string;
  loadFinanceDailySummaries: (fromDate: string, toDate: string) => Promise<FinanceDailySummary[]>;
  onOpenRecords: (section: "all" | "fitness", date: string) => void;
  onOpenSettings: () => void;
  onSync: () => Promise<void>;
  isSyncing: boolean;
}

const buttonClass = "min-h-11 rounded-md border border-slate-300 px-3 py-2 text-sm font-medium hover:bg-slate-100 disabled:opacity-50 dark:border-neutral-700 dark:hover:bg-neutral-900";

export function ConnectedAppsPanel({ snapshot, syncStatus, enabled, scopeKey, today, loadFinanceDailySummaries, onOpenRecords, onOpenSettings, onSync, isSyncing }: ConnectedAppsPanelProps) {
  const finance = useFinanceCalendar({ enabled, online: syncStatus.isOnline, scopeKey, visibleMonth: today, loadSummaries: loadFinanceDailySummaries });
  const totals = Object.values(finance.financeByDate).filter(row => row.date <= today).reduce((sum, row) => ({
    income: sum.income + row.incomeKrw, expense: sum.expense + row.expenseKrw,
    net: sum.net + row.netKrw, count: sum.count + row.entryCount,
  }), { income: 0, expense: 0, net: 0, count: 0 });
  const workouts = enabled ? getVisibleSharedWorkouts(snapshot).filter(row => row.date >= addDays(today, -6) && row.date <= today) : [];
  const nutrition = enabled ? snapshot.fitnessNutritionSummaries?.find(row => row.date === today) : undefined;
  const weight = enabled ? [...(snapshot.fitnessWeightRecords ?? [])].filter(row => !row.deletedAt && row.date <= today).sort((a, b) => b.date.localeCompare(a.date) || b.updatedAt.localeCompare(a.updatedAt))[0] : undefined;
  // Runtime facades can default an unread collection to []. An empty array alone
  // is not evidence that the producer was read successfully.
  function received(source: FitnessReadModelName, count: number) {
    const state = syncStatus.fitnessReadModels?.[source].state;
    return count > 0 || state === "connected" || state === "empty";
  }
  function sourceStatus(source: FitnessReadModelName, received: boolean) {
    if (!enabled) return "로그인 필요";
    const diagnostic = syncStatus.fitnessReadModels?.[source];
    if (!syncStatus.isOnline) return received ? "오프라인 · 저장된 요약" : "오프라인 · 미수신";
    if (diagnostic?.state === "error") return received ? "조회 실패 · 저장된 요약" : "조회 실패";
    if (syncStatus.mode !== "synced") return received ? "저장된 요약 · 최신 여부 미확인" : "조회 대기";
    if (diagnostic?.state === "empty") return "조회 완료 · 공유 데이터 없음";
    if (diagnostic?.state === "connected") return "조회 완료";
    return received ? "저장된 요약 · 최신 여부 미확인" : "미수신";
  }
  const healthRows: { source: FitnessReadModelName; title: string; received: boolean; value: string }[] = [
    { source: "workout", title: "운동", received: received("workout", getVisibleSharedWorkouts(snapshot).length), value: `최근 7일 공유된 완료 운동 ${workouts.length}회` },
    { source: "nutrition", title: "식단", received: received("nutrition", snapshot.fitnessNutritionSummaries?.length ?? 0), value: nutrition ? `오늘 ${nutrition.mealCount}회 · ${formatNutritionMetric(nutrition.calories)} kcal · 단백질 ${formatNutritionMetric(nutrition.proteinGrams)} g` : "오늘 공유된 식단 없음" },
    { source: "weight", title: "체중", received: received("weight", snapshot.fitnessWeightRecords?.length ?? 0), value: weight ? `${weight.date} · ${weight.weightKg.toLocaleString("ko-KR")} kg` : "공유된 체중 없음" },
  ];
  return <section aria-labelledby="home-connected-heading" className="rounded-md border border-slate-300 bg-white p-4 dark:border-neutral-800 dark:bg-black">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <h2 id="home-connected-heading" className="text-base font-semibold">연결 앱 요약</h2>
      <button type="button" onClick={onOpenSettings} className={buttonClass}>연결 설정</button>
    </div>
    <p className="mt-2 text-sm text-slate-600 dark:text-neutral-400">같은 계정에서 공유한 데이터를 읽습니다. 원본 수정은 각 앱에서 진행하세요.</p>
    {!enabled && <p role="status" className="mt-3 text-sm">FitnessApp·CashOS와 같은 서버·계정으로 로그인하면 요약을 조회합니다.</p>}
    <div className="mt-5 flex flex-wrap items-center justify-between gap-2">
      <h3 className="font-semibold">FitnessApp</h3>
      <button type="button" disabled={!enabled || !syncStatus.isOnline || isSyncing} onClick={() => void onSync()} className={buttonClass}>{isSyncing ? "동기화 중…" : "건강 새로고침"}</button>
    </div>
    <dl className="mt-2 divide-y divide-slate-200 dark:divide-neutral-800">
      {healthRows.map(row => <div key={row.source} className="py-3">
        <dt className="flex flex-wrap justify-between gap-2 text-sm font-semibold"><span>{row.title}</span><span className="font-normal text-slate-600 dark:text-neutral-400">{sourceStatus(row.source, row.received)}</span></dt>
        <dd className="mt-1 break-words text-base">{enabled && row.received ? row.value : "아직 수신된 요약이 없습니다."}</dd>
        {enabled && syncStatus.fitnessReadModels?.[row.source].state === "error" && <dd className="mt-1 text-sm text-amber-800 dark:text-amber-300">이 항목의 요약을 읽지 못했습니다. 연결 설정을 확인한 뒤 다시 동기화하세요.</dd>}
      </div>)}
    </dl>
    <button type="button" onClick={() => onOpenRecords("fitness", today)} className="min-h-11 text-sm font-medium text-cyan-800 hover:underline dark:text-cyan-300">건강 기록 보기</button>
    <div className="mt-4 border-t border-slate-200 pt-4 dark:border-neutral-800">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-semibold">CashOS</h3>
        <button type="button" disabled={!enabled || !syncStatus.isOnline || finance.isLoading} onClick={() => void finance.refresh()} className={buttonClass}>{finance.isLoading ? "조회 중…" : "재무 새로고침"}</button>
      </div>
      <p className="mt-2 text-sm text-slate-600 dark:text-neutral-400">{today.slice(0, 7)} · 오늘까지 확정된 수입·지출</p>
      {enabled && !syncStatus.isOnline && <p role="status" className="mt-2 text-sm">오프라인 · {finance.lastFetchedAt ? "이 화면에서 마지막으로 읽은 요약입니다." : "연결 후 재무 요약을 조회합니다."}</p>}
      {finance.error && <p role="alert" className="mt-2 break-words text-sm text-amber-800 dark:text-amber-300">{finance.error}{finance.lastFetchedAt ? " 이전 조회 결과를 표시합니다." : ""}</p>}
      {enabled && finance.lastFetchedAt ? <>
        <dl className="mt-3 grid grid-cols-1 gap-3 min-[380px]:grid-cols-3">
          {([["수입", totals.income], ["지출", totals.expense], ["순액", totals.net]] as const).map(([label, value]) => <div key={label}><dt className="text-sm text-slate-600 dark:text-neutral-400">{label}</dt><dd className="mt-1 break-all text-base font-semibold tabular-nums">{formatKrw(value)}</dd></div>)}
        </dl>
        <p className="mt-3 text-sm text-slate-600 dark:text-neutral-400">{totals.count ? `확정 내역 ${totals.count}건` : "조회 완료 · 이번 달 확정 내역 없음"} · 마지막 조회 <time dateTime={finance.lastFetchedAt}>{new Date(finance.lastFetchedAt).toLocaleString("ko-KR")}</time></p>
      </> : <p className="mt-3 text-sm">{!enabled ? "로그인 후 조회할 수 있습니다." : finance.isLoading ? "재무 요약을 읽고 있습니다." : "아직 수신된 재무 요약이 없습니다."}</p>}
      <button type="button" onClick={() => onOpenRecords("all", today)} className="mt-2 min-h-11 text-sm font-medium text-cyan-800 hover:underline dark:text-cyan-300">날짜별 현금 흐름 보기</button>
    </div>
  </section>;
}
