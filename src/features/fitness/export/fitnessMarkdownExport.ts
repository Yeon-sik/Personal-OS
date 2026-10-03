import type {
  MealRecord,
  WeightRecord,
} from "../../../types";
import {
  BACKFILL_LABEL,
  hasBackfillMetadata,
} from "../../../lib/dataTrust/backfillMetadata";
import { formatKoreanDate, isWithinDateRange } from "../fitnessDate";
import { formatSharedWorkoutLabels, type SharedWorkoutSummary } from "../../fitness-summary/sharedWorkoutSummaries";
import { calculateFitnessStats, formatMetric } from "../stats/fitnessStats";

interface FitnessExportInput {
  workoutRecords: SharedWorkoutSummary[];
  mealRecords: MealRecord[];
  weightRecords: WeightRecord[];
  startDate: string;
  endDate: string;
}

function groupByDate<T extends { date: string }>(records: T[]): Map<string, T[]> {
  const grouped = new Map<string, T[]>();

  for (const record of records) {
    const current = grouped.get(record.date) ?? [];
    current.push(record);
    grouped.set(record.date, current);
  }

  return new Map(
    Array.from(grouped.entries()).sort(([firstDate], [secondDate]) =>
      firstDate.localeCompare(secondDate),
    ),
  );
}

function isVisibleRecord(record: { deletedAt: string | null }): boolean {
  return record.deletedAt === null;
}

function formatBackfillSuffix(record: { isBackfilled?: boolean }): string {
  return hasBackfillMetadata(record) ? ` · ${BACKFILL_LABEL}` : "";
}

function appendEmptyAwareSection<T extends { date: string }>(
  lines: string[],
  title: string,
  records: T[],
  renderRecord: (record: T) => string,
): void {
  lines.push(`## ${title}`, "");

  if (records.length === 0) {
    lines.push("- 기록 없음", "");
    return;
  }

  for (const [date, dateRecords] of groupByDate(records)) {
    lines.push(`### ${formatKoreanDate(date)}`, "");

    for (const record of dateRecords) {
      lines.push(renderRecord(record));
    }

    lines.push("");
  }
}

export function createFitnessExportFileName(
  startDate: string,
  endDate: string,
): string {
  return `yeonsik-fitness-report-${startDate.split("-").join("")}-${endDate
    .split("-")
    .join("")}.md`;
}

export function createFitnessMarkdownExport({
  workoutRecords,
  mealRecords,
  weightRecords,
  startDate,
  endDate,
}: FitnessExportInput): string {
  const rangedWorkouts = workoutRecords
    .filter(isVisibleRecord)
    .filter((record) => isWithinDateRange(record.date, startDate, endDate));
  const rangedMeals = mealRecords
    .filter(isVisibleRecord)
    .filter((record) => isWithinDateRange(record.date, startDate, endDate));
  const rangedWeights = weightRecords
    .filter(isVisibleRecord)
    .filter((record) => isWithinDateRange(record.date, startDate, endDate));
  const stats = calculateFitnessStats(
    workoutRecords,
    mealRecords,
    weightRecords,
    startDate,
    endDate,
  );
  const lines: string[] = [
    "# 운동 기록 리포트",
    "",
    `기간: ${startDate} ~ ${endDate}`,
    "",
    "## 요약",
    "",
    `- 운동 기록: ${stats.workoutTotal}회`,
    `- 식사 기록: ${stats.mealCount}개`,
    `- 평균 칼로리: ${formatMetric(stats.averageCalories, 0)} kcal`,
    `- 평균 단백질: ${formatMetric(stats.averageProteinGrams)} g`,
    `- 체중 기록: ${stats.weightCount}개`,
    `- 평균 체중: ${formatMetric(stats.averageWeightKg)} kg`,
    `- 최저 체중: ${formatMetric(stats.minWeightKg)} kg`,
    `- 최고 체중: ${formatMetric(stats.maxWeightKg)} kg`,
    stats.totalBackfilledCount > 0
      ? `- ${BACKFILL_LABEL}: ${stats.totalBackfilledCount}건 포함`
      : null,
    "",
  ].filter((line): line is string => line !== null);

  if (stats.workoutBySubcategory.length > 0) {
    lines.push("### 운동 소분류별 총합", "");

    for (const item of stats.workoutBySubcategory) {
      lines.push(`- ${item.label}: ${item.count}회`);
    }

    lines.push("");
  }

  appendEmptyAwareSection(
    lines,
    "운동",
    rangedWorkouts,
    (record) =>
      `- ${formatSharedWorkoutLabels(record).join(" · ")}${formatBackfillSuffix(record)}`,
  );
  appendEmptyAwareSection(
    lines,
    "식사",
    rangedMeals,
    (record) =>
      `- ${record.menu}, ${record.calories.toLocaleString("ko-KR")} kcal, 단백질 ${formatMetric(
        record.proteinGrams,
      )} g${formatBackfillSuffix(record)}`,
  );
  appendEmptyAwareSection(
    lines,
    "체중",
    rangedWeights,
    (record) => `- ${formatMetric(record.weightKg)} kg${formatBackfillSuffix(record)}`,
  );

  return `${lines.join("\n").trim()}\n`;
}
