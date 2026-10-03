import type { FitnessNutritionSummaryV1 } from "./fitnessNutritionContract";

export function formatNutritionMetric(value: number | null | undefined): string {
  return value == null ? "미확인" : value.toLocaleString("ko-KR", { maximumFractionDigits: 1 });
}

export function FitnessNutritionCard({ summaries, date }: {
  summaries: FitnessNutritionSummaryV1[] | undefined;
  date: string;
}) {
  const summary = summaries?.find((row) => row.date === date);
  return (
    <div className="rounded-md border border-slate-300 bg-white p-3 dark:border-neutral-800 dark:bg-black">
      <h3 className="text-sm font-semibold">{date} 식단 요약</h3>
      {summary ? (
        <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
          <p>식사 {summary.mealCount}회</p>
          <p>칼로리 {formatNutritionMetric(summary.calories)} kcal</p>
          <p>탄수화물 {formatNutritionMetric(summary.carbsGrams)} g</p>
          <p>단백질 {formatNutritionMetric(summary.proteinGrams)} g</p>
          <p>지방 {formatNutritionMetric(summary.fatGrams)} g</p>
        </div>
      ) : (
        <p className="mt-2 text-xs text-slate-500 dark:text-neutral-400">
          {summaries === undefined ? "식단 요약을 아직 수신하지 않았습니다. 동기화 상태를 확인하세요." : "수신된 식단 요약이 없습니다."}
        </p>
      )}
      <p className="mt-2 text-xs text-slate-500 dark:text-neutral-400">
        Fitness에서 마지막으로 동기화한 요약입니다. 누락된 영양값은 미확인으로 표시합니다.
      </p>
    </div>
  );
}
