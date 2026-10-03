import type {
  FitnessSummaryProjectionV2,
  LegacyWorkoutRecordV1,
  LocalDataSnapshot,
} from "../../types";
import { formatDurationSeconds } from "../fitness/fitnessService";

export type SharedWorkoutSummary =
  | FitnessSummaryProjectionV2
  | LegacyWorkoutRecordV1;

export function isFitnessSummaryProjectionV2(
  record: SharedWorkoutSummary,
): record is FitnessSummaryProjectionV2 {
  return "sourceFitnessSessionId" in record;
}

/** Keep v2 authoritative and show only completed, explicitly shared v1 sessions. */
export function getVisibleSharedWorkouts(
  snapshot: Pick<LocalDataSnapshot, "fitnessSummaryProjections" | "fitnessSharedWorkoutRecords">,
): SharedWorkoutSummary[] {
  const projectionSessionIds = new Set(
    snapshot.fitnessSummaryProjections.map((record) => record.sourceFitnessSessionId),
  );
  const projections = snapshot.fitnessSummaryProjections.filter(
    (record) => record.deletedAt === null &&
      record.completionStatus === "completed" &&
      record.contractVersion === 2,
  );
  const legacy = (snapshot.fitnessSharedWorkoutRecords ?? []).filter(
    (record) => record.deletedAt === null &&
      record.sourceApp === "fitness" &&
      record.scope === "both" &&
      record.metadata?.status === "completed" &&
      record.category.trim().length > 0 &&
      !projectionSessionIds.has(record.id),
  );
  return [...projections, ...legacy];
}

export function formatSharedWorkoutLabels(record: SharedWorkoutSummary): string[] {
  if (isFitnessSummaryProjectionV2(record)) {
    const parts: Array<[number, string]> = [
      [record.chestSets, "가슴"],
      [record.backSets, "등"],
      [record.legsSets, "하체"],
      [record.shouldersSets, "어깨"],
      [record.absSets, "복부"],
      [record.tricepsSets, "삼두"],
      [record.bicepsSets, "이두"],
    ];
    const labels = parts.filter(([count]) => count > 0)
      .map(([count, label]) => `${label} 운동 ${count}세트`);
    if (record.cardioDurationSeconds !== null) {
      labels.push(`유산소 ${formatDurationSeconds(record.cardioDurationSeconds)}`);
    }
    return labels.length ? labels : ["완료 운동 요약"];
  }
  return [`${record.category.trim()} 운동`];
}

export function sharedWorkoutDurationSeconds(record: SharedWorkoutSummary): number | null {
  return isFitnessSummaryProjectionV2(record)
    ? record.totalDurationSeconds
    : record.durationSeconds;
}
