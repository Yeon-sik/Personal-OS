import type { FitnessNutritionSummaryV1 } from "../fitness-summary/fitnessNutritionContract";
import { FitnessNutritionCard, formatNutritionMetric } from "../fitness-summary/FitnessNutritionCard";
import { BarChart3, Download, Dumbbell, Salad, Scale } from "lucide-react";
import { useMemo, useState } from "react";
import type {
  FitnessSummaryProjectionV2,
  LegacyWorkoutRecordV1,
} from "../../types";
import { BACKFILL_LABEL } from "../../lib/dataTrust/backfillMetadata";
import { formatLocalDate, getCurrentMonthRange } from "./fitnessDate";
import {
  createFitnessExportFileName,
  createFitnessMarkdownExport,
} from "./export/fitnessMarkdownExport";
import { downloadMarkdown } from "./export/downloadMarkdown";
import { FieldLabel, MetricPanel } from "./components/FitnessPanelPrimitives";
import { formatSharedWorkoutLabels, getVisibleSharedWorkouts, sharedWorkoutDurationSeconds } from "../fitness-summary/sharedWorkoutSummaries";
import { calculateFitnessStats, formatMetric } from "./stats/fitnessStats";

interface FitnessPanelProps {
  fitnessSummaryProjections: FitnessSummaryProjectionV2[];
  fitnessSharedWorkoutRecords: LegacyWorkoutRecordV1[] | undefined;
  nutritionSummaries: FitnessNutritionSummaryV1[] | undefined;
  selectedDate: string;

}

type ActionPanel = "stats" | "export" | null;

/** Personal OS consumes the Fitness-owned Summary Projection v2 as read-only data. */
export function FitnessPanel({
  fitnessSummaryProjections,
  fitnessSharedWorkoutRecords,
  nutritionSummaries,
  selectedDate,

}: FitnessPanelProps) {
  const visibleWorkouts = useMemo(() => getVisibleSharedWorkouts({ fitnessSummaryProjections, fitnessSharedWorkoutRecords }), [fitnessSummaryProjections, fitnessSharedWorkoutRecords]);
  const currentMonthRange = getCurrentMonthRange();
  const [actionPanel, setActionPanel] = useState<ActionPanel>(null);
  const [rangeStartDate, setRangeStartDate] = useState(
    currentMonthRange.startDate,
  );
  const [rangeEndDate, setRangeEndDate] = useState(currentMonthRange.endDate);
  const stats = useMemo(
    () =>
      calculateFitnessStats(
        visibleWorkouts,
        [],
        [],

        rangeStartDate,
        rangeEndDate,
      ),
    [
      visibleWorkouts,
      nutritionSummaries,
      rangeEndDate,
      rangeStartDate,

    ],
  );
  const exportMarkdown = useMemo(
    () =>
      createFitnessMarkdownExport({
        workoutRecords: visibleWorkouts,
        mealRecords: [],
        weightRecords: [],

        startDate: rangeStartDate,
        endDate: rangeEndDate,
      }),
    [
      visibleWorkouts,
      nutritionSummaries,
      rangeEndDate,
      rangeStartDate,

    ],
  );
  const exportFileName = createFitnessExportFileName(
    rangeStartDate,
    rangeEndDate,
  );
  const selectedDateProjections = visibleWorkouts.filter(
    (record) => record.date === selectedDate,
  );

  const rangedNutrition = (nutritionSummaries ?? []).filter(
    (row) => row.date >= rangeStartDate && row.date <= rangeEndDate,
  );
  const summaryExport = exportMarkdown + "\n## 일별 식단 요약 v1\n\n" +
    (rangedNutrition.length ? rangedNutrition.map((row) =>
      `- ${row.date}: 식사 ${row.mealCount}회 · ${formatNutritionMetric(row.calories)} kcal · 탄수화물 ${formatNutritionMetric(row.carbsGrams)} g · 단백질 ${formatNutritionMetric(row.proteinGrams)} g · 지방 ${formatNutritionMetric(row.fatGrams)} g`,
    ).join("\n") : "수신된 식단 요약 없음") + "\n";

  return (
    <section className="flex h-full min-h-0 flex-col gap-3 overflow-y-auto">
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <h2 className="truncate text-base font-semibold text-slate-950 dark:text-neutral-50">
            건강·운동 요약
          </h2>
          <p className="truncate text-xs text-slate-500 dark:text-neutral-400">
            Fitness App 공유 운동 요약 · 일별 식단 v1 읽기 전용
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={() =>
              setActionPanel((current) =>
                current === "stats" ? null : "stats",
              )
            }
            className="inline-flex h-8 items-center gap-1.5 rounded-md border border-slate-300 bg-white px-2.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 dark:border-neutral-800 dark:bg-black dark:text-neutral-200 dark:hover:bg-neutral-900"
          >
            <BarChart3 className="h-4 w-4" aria-hidden="true" />
            통계
          </button>
          <button
            type="button"
            onClick={() =>
              setActionPanel((current) =>
                current === "export" ? null : "export",
              )
            }
            className="inline-flex h-8 items-center gap-1.5 rounded-md border border-slate-300 bg-white px-2.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 dark:border-neutral-800 dark:bg-black dark:text-neutral-200 dark:hover:bg-neutral-900"
          >
            <Download className="h-4 w-4" aria-hidden="true" />
            출력
          </button>
        </div>
      </div>

      <div className="shrink-0 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-900 dark:border-red-900/60 dark:bg-red-950/20 dark:text-red-100">
        <div className="font-semibold">읽기 전용</div>
        <p className="mt-1 text-xs leading-5">
          운동·식사·체중 원본은 Fitness App이 관리합니다. Personal OS에는
          완료된 v2 운동 요약과 v2가 아직 없는 공유 완료 운동의 범주를 표시합니다.
          세트 수는 v2 요약에서만 제공하며, 식단은 일별 v1 요약으로 읽습니다.
          원본 입력과 상세 수정은 Fitness App에서 진행하세요.
        </p>
      </div>

      {actionPanel ? (
        <div className="shrink-0 rounded-md border border-slate-300 bg-white p-3 dark:border-neutral-800 dark:bg-black">
          <div className="grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
            <FieldLabel label="시작일">
              <input
                type="date"
                value={rangeStartDate}
                onChange={(event) => setRangeStartDate(event.target.value)}
                className="field-input"
              />
            </FieldLabel>
            <FieldLabel label="종료일">
              <input
                type="date"
                value={rangeEndDate}
                onChange={(event) => setRangeEndDate(event.target.value)}
                className="field-input"
              />
            </FieldLabel>
            {actionPanel === "export" ? (
              <button
                type="button"
                onClick={() => downloadMarkdown(exportFileName, summaryExport)}
                className="mt-5 inline-flex h-9 items-center justify-center gap-1.5 rounded-md bg-teal-700 px-3 text-sm font-semibold text-white transition hover:bg-teal-800"
              >
                <Download className="h-4 w-4" aria-hidden="true" />
                파일 저장
              </button>
            ) : null}
          </div>

          {actionPanel === "stats" ? (
            <div className="mt-3 grid gap-2 md:grid-cols-3">
              <MetricPanel
                icon={<Dumbbell className="h-4 w-4 text-red-600" />}
                title="운동 요약"
                primary={`${stats.workoutTotal}회`}
              >
                {stats.workoutBySubcategory.length === 0 ? (
                  <p>기록 없음</p>
                ) : (
                  stats.workoutBySubcategory.map((item) => (
                    <p key={item.label}>
                      {item.label}: {item.count}회
                    </p>
                  ))
                )}
                {stats.backfilledWorkoutCount > 0 ? (
                  <p>
                    {BACKFILL_LABEL} {stats.backfilledWorkoutCount}건 포함
                  </p>
                ) : null}
              </MetricPanel>
              <MetricPanel
                icon={<Salad className="h-4 w-4 text-yellow-600" />}
                title="식단 요약"
                primary={`${rangedNutrition.reduce((sum, day) => sum + day.mealCount, 0)}회`}
              >
                <p>수신된 식단 {rangedNutrition.length}일</p>
                <p>일별 합계는 아래 식단 요약에서 확인하세요.</p>
              </MetricPanel>
            </div>
          ) : (
            <div className="mt-3">
              <div className="mb-2 truncate text-xs text-slate-500 dark:text-neutral-400">
                파일명: {exportFileName}
              </div>
              <textarea
                readOnly
                value={summaryExport}
                className="h-48 w-full resize-none rounded-md border border-slate-200 bg-slate-50 p-3 font-mono text-xs leading-5 text-slate-700 dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-200"
              />
            </div>
          )}
        </div>
      ) : null}

      <FitnessNutritionCard summaries={nutritionSummaries} date={selectedDate} />

      <div className="shrink-0 rounded-md border border-slate-300 bg-white p-3 dark:border-neutral-800 dark:bg-black">
        <div className="flex items-center justify-between gap-2">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-normal text-red-600 dark:text-red-300">
              {formatLocalDate(new Date(`${selectedDate}T00:00:00`))}
            </div>
            <h3 className="mt-1 text-sm font-semibold text-slate-900 dark:text-neutral-100">
              선택 날짜 운동 요약
            </h3>
          </div>
          <span className="rounded-full border border-slate-300 px-2 py-0.5 text-[11px] font-semibold text-slate-600 dark:border-neutral-700 dark:text-neutral-300">
            {selectedDateProjections.length}회
          </span>
        </div>
        {selectedDateProjections.length === 0 ? (
          <p className="mt-3 text-xs text-slate-500 dark:text-neutral-400">
            공유된 완료 운동 요약이 없습니다.
          </p>
        ) : (
          <div className="mt-3 space-y-2">
            {selectedDateProjections.map((projection) => (
              <div
                key={projection.id}
                className="rounded-md border border-slate-200 px-3 py-2 dark:border-neutral-800"
              >
                <div className="text-sm font-semibold text-slate-900 dark:text-neutral-100">
                  {formatSharedWorkoutLabels(projection).join(" · ")}
                </div>
                {sharedWorkoutDurationSeconds(projection) !== null ? (
                  <div className="mt-1 text-xs text-slate-500 dark:text-neutral-400">
                    총 운동시간 {formatMetric(sharedWorkoutDurationSeconds(projection), 0)}초
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
