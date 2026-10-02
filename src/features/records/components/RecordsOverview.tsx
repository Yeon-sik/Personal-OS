import {
  Activity,
  ChevronDown,
  Salad,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import { useMemo } from "react";
import type { LocalDataSnapshot } from "../../../types";
import type { SyncStatus } from "../../../lib/sync/syncTypes";
import {
  BACKFILL_LABEL,
  hasBackfillMetadata,
} from "../../../lib/dataTrust/backfillMetadata";
import { formatKoreanDate } from "../../fitness/fitnessDate";
import { formatMetric } from "../../fitness/stats/fitnessStats";
import {
  getDashboardStats,
  getMonthRange,
  getNutritionSeries,
  getProductivitySeries,
  getRecordsForDate,
  getWeightSeries,
} from "../recordAggregation";
import { useChartInteraction } from "../hooks/useChartInteraction";
import {
  BarSeries,
  ChartCard,
  WeightLine,
} from "./InteractiveRecordsMetrics";

interface RecordsOverviewProps {
  selectedDate: string;
  snapshot: LocalDataSnapshot;
  syncStatus: SyncStatus;
  today: string;
}

function summarizeItems(items: string[], emptyText: string): string {
  if (items.length === 0) {
    return emptyText;
  }

  if (items.length <= 2) {
    return items.join(" · ");
  }

  return `${items.slice(0, 2).join(" · ")} 외 ${items.length - 2}건`;
}

export function RecordsOverview({
  selectedDate,
  snapshot,
}: RecordsOverviewProps) {
  const selectedRange = useMemo(() => getMonthRange(selectedDate), [selectedDate]);
  const dashboardStats = useMemo(
    () => getDashboardStats(snapshot, selectedRange),
    [selectedRange, snapshot],
  );
  const productivitySeries = useMemo(
    () => getProductivitySeries(snapshot.tasks, selectedRange),
    [selectedRange, snapshot.tasks],
  );
  const nutritionSeries = useMemo(
    () => getNutritionSeries(snapshot.mealRecords, selectedRange),
    [selectedRange, snapshot.mealRecords],
  );
  const weightSeries = useMemo(
    () => getWeightSeries(snapshot.weightRecords, selectedRange),
    [selectedRange, snapshot.weightRecords],
  );
  const productivityInteraction = useChartInteraction(productivitySeries.length);
  const nutritionInteraction = useChartInteraction(nutritionSeries.length);
  const weightInteraction = useChartInteraction(weightSeries.length);
  const hasProductivityData = productivitySeries.some(
    (point) => point.totalTasks > 0,
  );
  const hasNutritionData = nutritionSeries.some(
    (point) => point.averageCalories !== null,
  );
  const productivityDetail =
    dashboardStats.backfilledTaskCount > 0
      ? `${dashboardStats.completedTasks}/${dashboardStats.totalTasks} 완료 · ${BACKFILL_LABEL} ${dashboardStats.backfilledTaskCount}건 제외`
      : `${dashboardStats.completedTasks}/${dashboardStats.totalTasks} 완료`;
  const activeProductivityPoint =
    productivityInteraction.activeIndex === null
      ? null
      : productivitySeries[productivityInteraction.activeIndex] ?? null;
  const activeNutritionPoint =
    nutritionInteraction.activeIndex === null
      ? null
      : nutritionSeries[nutritionInteraction.activeIndex] ?? null;
  const activeWeightPoint =
    weightInteraction.activeIndex === null
      ? null
      : weightSeries[weightInteraction.activeIndex] ?? null;
  const productivityDetailTasks = activeProductivityPoint
    ? snapshot.tasks.filter(
        (task) =>
          task.deletedAt === null &&
          task.plannedDate === activeProductivityPoint.date &&
          !hasBackfillMetadata(task),
      )
    : [];
  const nutritionDetailRecords = activeNutritionPoint
    ? getRecordsForDate(snapshot, activeNutritionPoint.date)
    : null;
  const weightDetailRecords = activeWeightPoint
    ? getRecordsForDate(snapshot, activeWeightPoint.date)
    : null;

  const productivityChartDetail = activeProductivityPoint ? (
    <div className="space-y-1">
      <p className="font-semibold text-slate-700 dark:text-neutral-100">
        {formatKoreanDate(activeProductivityPoint.date)} · 완료{" "}
        {activeProductivityPoint.completedTasks}/{activeProductivityPoint.totalTasks}
      </p>
      <p>
        {summarizeItems(
          productivityDetailTasks.map((task) =>
            task.isDone ? `완료 ${task.text}` : `진행 ${task.text}`,
          ),
          "이 날 등록된 할 일이 없습니다.",
        )}
      </p>
    </div>
  ) : (
    <p>막대에 마우스를 올리거나 클릭하면 해당 날짜의 할 일 기록을 보여줍니다.</p>
  );

  const nutritionChartDetail = activeNutritionPoint ? (
    <div className="space-y-1">
      <p className="font-semibold text-slate-700 dark:text-neutral-100">
        {formatKoreanDate(activeNutritionPoint.date)} · 평균{" "}
        {activeNutritionPoint.averageCalories === null
          ? "-"
          : `${formatMetric(activeNutritionPoint.averageCalories, 0)} kcal`} / 단백질{" "}
        {activeNutritionPoint.averageProteinGrams === null
          ? "-"
          : `${formatMetric(activeNutritionPoint.averageProteinGrams)} g`}
      </p>
      <p>
        {summarizeItems(
          (nutritionDetailRecords?.mealRecords ?? []).map(
            (record) =>
              `${record.menu} ${record.calories.toLocaleString("ko-KR")} kcal / ${formatMetric(record.proteinGrams)} g`,
          ),
          "이 날 등록된 식사 기록이 없습니다.",
        )}
      </p>
    </div>
  ) : (
    <p>막대에 마우스를 올리거나 클릭하면 해당 날짜의 식사 기록을 보여줍니다.</p>
  );

  const weightChartDetail = activeWeightPoint ? (
    <div className="space-y-1">
      <p className="font-semibold text-slate-700 dark:text-neutral-100">
        {formatKoreanDate(activeWeightPoint.date)} · 체중{" "}
        {formatMetric(activeWeightPoint.weightKg)} kg
      </p>
      <p>
        {summarizeItems(
          (weightDetailRecords?.weightRecords ?? []).map(
            (record) => `${formatMetric(record.weightKg)} kg`,
          ),
          "이 날 등록된 체중 기록이 없습니다.",
        )}
      </p>
    </div>
  ) : (
    <p>선 위에 마우스를 올리거나 클릭한 뒤 좌우로 움직이면 날짜별 체중 기록을 계속 볼 수 있습니다.</p>
  );

  return (
    <details className="group shrink-0 rounded-md border border-slate-300 bg-white dark:border-neutral-800 dark:bg-black">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 rounded-md p-3 text-sm font-semibold text-slate-800 transition-colors duration-150 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500/60 dark:text-neutral-200 dark:hover:bg-neutral-900 [&::-webkit-details-marker]:hidden">
        <span>월간 흐름</span>
        <span className="flex items-center gap-2 text-xs font-normal text-slate-500 dark:text-neutral-400">
          {selectedRange.startDate.slice(0, 4)}년{" "}
          {Number(selectedRange.startDate.slice(5, 7))}월
          <ChevronDown className="h-4 w-4 transition-transform duration-150 group-open:rotate-180" aria-hidden="true" />
        </span>
      </summary>
      <div className="grid gap-2 border-t border-slate-200 p-3 dark:border-neutral-800">
        <p className="text-xs text-slate-500 dark:text-neutral-400">
          {productivityDetail} · 할 일 완료율은 {BACKFILL_LABEL}을 제외합니다.
          식사·체중 흐름에는 누락 보강을 포함합니다.
        </p>
        <ChartCard
          title="할 일 완료 흐름"
          icon={Activity}
          detail={productivityChartDetail}
          caption={hasProductivityData ? "선택 월 완료율" : "선택 월에 할 일이 없습니다."}
        >
          <BarSeries
            interaction={productivityInteraction}
            pointLabels={productivitySeries.map(
              (point) =>
                `${formatKoreanDate(point.date)} 완료 ${point.completedTasks}/${point.totalTasks}`,
            )}
            values={productivitySeries.map((point) =>
              point.totalTasks === 0
                ? 0
                : (point.completedTasks / point.totalTasks) * 100,
            )}
            toneClassName="bg-sky-500"
          />
        </ChartCard>
        <ChartCard
          title="칼로리 / 단백질"
          icon={Salad}
          caption={hasNutritionData ? "일별 평균 칼로리" : "선택 월에 식사 기록이 없습니다."}
        >
          <BarSeries
            interaction={nutritionInteraction}
            pointLabels={nutritionSeries.map(
              (point) =>
                `${formatKoreanDate(point.date)} 평균 ${point.averageCalories === null ? 0 : Math.round(point.averageCalories)} kcal`,
            )}
            values={nutritionSeries.map((point) => point.averageCalories ?? 0)}
            toneClassName="bg-amber-500"
          />
          <div className="mt-3 rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-300">
            {nutritionChartDetail}
          </div>
        </ChartCard>
        <ChartCard
          title="체중 추세"
          icon={dashboardStats.weightDeltaKg && dashboardStats.weightDeltaKg < 0 ? TrendingDown : TrendingUp}
          detail={weightChartDetail}
          caption={weightSeries.length > 1 ? "월간 체중 변화" : "선택 월에 체중 기록이 부족합니다."}
        >
          <WeightLine
            interaction={weightInteraction}
            pointLabels={weightSeries.map(
              (point) => `${formatKoreanDate(point.date)} 체중 ${formatMetric(point.weightKg)} kg`,
            )}
            values={weightSeries.map((point) => point.weightKg)}
          />
        </ChartCard>
      </div>
    </details>
  );
}
