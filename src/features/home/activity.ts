import type { FitnessSummaryProjectionV2, LocalDataSnapshot } from "../../types";

export type ActivityKind = "notes" | "tasks" | "workouts" | "meals" | "weights" | "projectHistory" | "knowledgeDocuments";

export const ACTIVITY_LABELS: Record<ActivityKind, string> = {
  notes: "메모 등록",
  tasks: "할 일 등록",
  workouts: "완료 운동",
  meals: "식사 기록",
  weights: "체중 기록",
  projectHistory: "프로젝트 이력",
  knowledgeDocuments: "지식 문서 등록",
};

export interface ActivityDay {
  date: string;
  count: number;
  counts: Record<ActivityKind, number>;
}

export interface ActivityTimeline {
  startDate: string;
  endDate: string;
  days: ActivityDay[];
  totalCount: number;
  activeDayCount: number;
}

const DAY_MS = 86_400_000;

function parseCalendarDate(value: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value
    ? null
    : date;
}

function emptyCounts(): Record<ActivityKind, number> {
  return { notes: 0, tasks: 0, workouts: 0, meals: 0, weights: 0, projectHistory: 0, knowledgeDocuments: 0 };
}

/** Timestamp-backed creation days use the device calendar zone; recorded dates stay as entered. */
function timestampDate(value: string, formatter: Intl.DateTimeFormat): string | null {
  const timestamp = new Date(value);
  if (Number.isNaN(timestamp.getTime())) return null;
  const parts = formatter.formatToParts(timestamp);
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((entry) => entry.type === type)?.value;
  return `${part("year")}-${part("month")}-${part("day")}`;
}

/**
 * A snapshot-derived record count, never an edit log or productivity score.
 * Memo/task/document creation counts once. Health records use their recorded
 * day, and project history uses occurredAt. Legacy workout details are not a
 * source: the completed Fitness v2 projection is the sole workout read model.
 */
export function getActivityTimeline(
  snapshot: LocalDataSnapshot,
  options: { endDate: string; weekCount?: number; timeZone?: string },
): ActivityTimeline {
  const end = parseCalendarDate(options.endDate);
  if (!end) return { startDate: options.endDate, endDate: options.endDate, days: [], totalCount: 0, activeDayCount: 0 };

  const weekCount = Math.max(1, Math.min(53, Math.floor(options.weekCount ?? 26) || 1));
  const mondayOffset = (end.getUTCDay() + 6) % 7;
  const start = new Date(end.getTime() - (mondayOffset + (weekCount - 1) * 7) * DAY_MS);
  const days: ActivityDay[] = [];
  const byDate = new Map<string, ActivityDay>();
  for (let cursor = start.getTime(); cursor <= end.getTime(); cursor += DAY_MS) {
    const day = { date: new Date(cursor).toISOString().slice(0, 10), count: 0, counts: emptyCounts() };
    days.push(day);
    byDate.set(day.date, day);
  }

  const formatter = new Intl.DateTimeFormat("en-US", {
    year: "numeric", month: "2-digit", day: "2-digit", timeZone: options.timeZone,
  });
  const seen = new Set<string>();
  const add = (kind: ActivityKind, id: string, date: string | null) => {
    const identity = `${kind}:${id}`;
    const day = date ? byDate.get(date) : undefined;
    if (!day || seen.has(identity)) return;
    seen.add(identity);
    day.count += 1;
    day.counts[kind] += 1;
  };

  for (const note of snapshot.notes) {
    if (note.deletedAt === null) add("notes", note.id, timestampDate(note.createdAt, formatter));
  }
  for (const task of snapshot.tasks) {
    if (task.deletedAt === null) add("tasks", task.id, timestampDate(task.createdAt, formatter));
  }
  for (const document of snapshot.knowledgeDocuments) {
    if (document.deletedAt === null) add("knowledgeDocuments", document.id, timestampDate(document.createdAt, formatter));
  }
  for (const meal of snapshot.mealRecords) {
    if (meal.deletedAt === null && meal.scope !== "fitness") add("meals", meal.id, meal.date);
  }
  for (const weight of snapshot.weightRecords) {
    if (weight.deletedAt === null && weight.scope !== "fitness") add("weights", weight.id, weight.date);
  }

  // Multiple projection rows for one Fitness session still describe one workout.
  // Resolve the newest row including tombstones before checking visibility.
  const sessions = new Map<string, FitnessSummaryProjectionV2>();
  for (const projection of snapshot.fitnessSummaryProjections) {
    const current = sessions.get(projection.sourceFitnessSessionId);
    if (!current || projection.updatedAt > current.updatedAt || (projection.updatedAt === current.updatedAt && projection.deletedAt !== null)) {
      sessions.set(projection.sourceFitnessSessionId, projection);
    }
  }
  for (const [sessionId, projection] of sessions) {
    if (projection.deletedAt === null && projection.contractVersion === 2 && projection.completionStatus === "completed") {
      add("workouts", sessionId, projection.date);
    }
  }

  const liveProjects = new Set(snapshot.projects.filter((project) => project.deletedAt === null).map((project) => project.id));
  for (const history of snapshot.projectHistory) {
    if (history.deletedAt === null && liveProjects.has(history.projectId)) {
      add("projectHistory", history.id, timestampDate(history.occurredAt, formatter));
    }
  }

  return {
    startDate: days[0].date,
    endDate: options.endDate,
    days,
    totalCount: days.reduce((sum, day) => sum + day.count, 0),
    activeDayCount: days.filter((day) => day.count > 0).length,
  };
}

export function describeActivityDay(day: ActivityDay): string {
  return (Object.entries(day.counts) as Array<[ActivityKind, number]>)
    .filter(([, count]) => count > 0)
    .map(([kind, count]) => `${ACTIVITY_LABELS[kind]} ${count}건`)
    .join(" · ") || "등록된 활동이 없습니다.";
}
