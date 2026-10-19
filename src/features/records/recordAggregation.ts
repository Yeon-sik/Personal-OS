import type {
  LocalDataSnapshot,
  MealRecord,
  Note,
  Task,
  WeightRecord,
} from "../../types";
import type { FitnessNutritionSummaryV1 } from "../fitness-summary/fitnessNutritionContract";
import {
  countBackfilledRecords,
  hasBackfillMetadata,
} from "../../lib/dataTrust/backfillMetadata";
import { formatLocalDate, isWithinDateRange, parseDateInput } from "../fitness/fitnessDate";
import { getVisibleSharedWorkouts, type SharedWorkoutSummary } from "../fitness-summary/sharedWorkoutSummaries";
import { actionRolesOnDate, actionDatesInRange } from "../actions/actionCalendar";
import { calendarDate } from "../actions/actionTime";

export type LocalDateString = string;

export interface DateRange {
  startDate: LocalDateString;
  endDate: LocalDateString;
}

export interface CalendarTaskMarker {
  dueCount: number;
  activeCount: number;
  plannedCount: number;
  completedPlannedCount: number;
  allPlannedDone: boolean;
  confirmedCount?: number;
  candidateCount?: number;
  eventCount?: number;
  windowCount?: number;
}

export interface CalendarMarkerSet {
  notes: boolean;
  tasks: CalendarTaskMarker;
  workouts: boolean;
  meals: boolean;
  weights: boolean;
}

export type CalendarMarkers = Record<LocalDateString, CalendarMarkerSet>;

export interface DateRecords {
  notes: Note[];
  tasks: Task[];
  workoutRecords: SharedWorkoutSummary[];
  mealRecords: MealRecord[];
  fitnessNutritionSummary: FitnessNutritionSummaryV1 | null;
  weightRecords: WeightRecord[];
}

export interface DashboardStats {
  productivityScore: number | null;
  completedTasks: number;
  totalTasks: number;
  averageCalories: number | null;
  averageProteinGrams: number | null;
  weightDeltaKg: number | null;
  latestWeightKg: number | null;
  backfilledTaskCount: number;
  backfilledWorkoutCount: number;
  backfilledMealCount: number;
  backfilledWeightCount: number;
  totalBackfilledCount: number;
}

export interface ProductivityPoint {
  date: LocalDateString;
  completedTasks: number;
  totalTasks: number;
}

export interface NutritionPoint {
  date: LocalDateString;
  averageCalories: number | null;
  averageProteinGrams: number | null;
}

export interface WeightPoint {
  date: LocalDateString;
  weightKg: number;
}

function isVisibleEntity(entity: { deletedAt: string | null }): boolean {
  return entity.deletedAt === null;
}

function isVisibleInOs(
  entity: { deletedAt: string | null; scope?: string },
): boolean {
  return entity.deletedAt === null && entity.scope !== "fitness";
}

function isVisibleOsMeal(entity: MealRecord): boolean {
  return isVisibleInOs(entity) && entity.sourceApp !== "fitness";
}

function getWeightSource(snapshot: LocalDataSnapshot): WeightRecord[] {
  return snapshot.fitnessWeightRecords ?? snapshot.weightRecords.filter(isVisibleInOs);
}

function toLocalDateFromTimestamp(value: string): LocalDateString | null {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return formatLocalDate(date);
}

function getTaskActivityDate(task: Task): LocalDateString | null {
  return task.dueDate ?? toLocalDateFromTimestamp(task.updatedAt);
}

function getTaskProductivityDate(task: Task): LocalDateString | null {
  return task.registrationState === "CANDIDATE" || (task.plannedDate && task.plannedDate > calendarDate()) ? null : task.plannedDate;
}

function isTaskVisibleOnDate(task: Task, date: LocalDateString): boolean {
  return actionRolesOnDate(task, date).length > 0;
}

function isDateInRange(date: string | null, range: DateRange): boolean {
  return Boolean(date && isWithinDateRange(date, range.startDate, range.endDate));
}

function average(values: number[]): number | null {
  if (values.length === 0) {
    return null;
  }

  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function averagePositive(values: number[]): number | null {
  return average(values.filter((value) => value > 0));
}

function averagePositiveWithFitnessSummaries(
  values: number[],
  summaries: FitnessNutritionSummaryV1[],
  metric: "calories" | "proteinGrams",
): number | null {
  const positiveValues = values.filter((value) => value > 0);
  const fitnessTotals = summaries.filter((summary) => {
    const total = summary[metric];
    return total !== null && total > 0 && summary.mealCount > 0;
  });
  const count = positiveValues.length + fitnessTotals.reduce(
    (total, summary) => total + summary.mealCount,
    0,
  );
  if (count === 0) {
    return null;
  }

  const total = positiveValues.reduce((sum, value) => sum + value, 0) +
    fitnessTotals.reduce((sum, summary) => sum + (summary[metric] ?? 0), 0);
  return total / count;
}

function sortTasksBySchedule(first: Task, second: Task): number {
  const firstDate = getTaskActivityDate(first) ?? "9999-12-31";
  const secondDate = getTaskActivityDate(second) ?? "9999-12-31";

  if (firstDate !== secondDate) {
    return firstDate.localeCompare(secondDate);
  }

  const firstTime = first.dueTime ?? "99:99";
  const secondTime = second.dueTime ?? "99:99";

  if (firstTime !== secondTime) {
    return firstTime.localeCompare(secondTime);
  }

  return first.orderIndex - second.orderIndex;
}

function sortByDateThenUpdatedAt<T extends { date: string; updatedAt: string }>(
  records: T[],
): T[] {
  return [...records].sort((first, second) => {
    if (first.date !== second.date) {
      return first.date.localeCompare(second.date);
    }

    return first.updatedAt.localeCompare(second.updatedAt);
  });
}

export function getDateRangeDays(range: DateRange): LocalDateString[] {
  const start = parseDateInput(range.startDate);
  const end = parseDateInput(range.endDate);

  if (start > end) {
    return [];
  }

  const days: LocalDateString[] = [];
  const cursor = new Date(start);

  while (cursor <= end) {
    days.push(formatLocalDate(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }

  return days;
}

function emptyMarkerSet(): CalendarMarkerSet {
  return {
    notes: false,
    tasks: {
      dueCount: 0,
      activeCount: 0,
      plannedCount: 0,
      completedPlannedCount: 0,
      allPlannedDone: false,
    },
    workouts: false,
    meals: false,
    weights: false,
  };
}

function ensureMarker(
  markers: CalendarMarkers,
  date: LocalDateString,
): CalendarMarkerSet {
  const marker = markers[date] ?? emptyMarkerSet();
  markers[date] = marker;
  return marker;
}

export function getMonthRange(date: LocalDateString): DateRange {
  const parsedDate = parseDateInput(date);
  const start = new Date(parsedDate.getFullYear(), parsedDate.getMonth(), 1);
  const end = new Date(parsedDate.getFullYear(), parsedDate.getMonth() + 1, 0);

  return {
    startDate: formatLocalDate(start),
    endDate: formatLocalDate(end),
  };
}

export function getRecordsForDate(
  snapshot: LocalDataSnapshot,
  date: LocalDateString,
): DateRecords {
  return {
    notes: snapshot.notes
      .filter(isVisibleEntity)
      .filter((note) => toLocalDateFromTimestamp(note.updatedAt) === date)
      .sort((first, second) => second.updatedAt.localeCompare(first.updatedAt)),
    tasks: snapshot.tasks
      .filter(isVisibleEntity)
      .filter((task) => isTaskVisibleOnDate(task, date))
      .sort(sortTasksBySchedule),
    workoutRecords: sortByDateThenUpdatedAt(
      getVisibleSharedWorkouts(snapshot)
        .filter((record) => record.date === date),
    ),
    mealRecords: sortByDateThenUpdatedAt(
      snapshot.mealRecords
        .filter(isVisibleOsMeal)
        .filter((record) => record.date === date),
    ),
    fitnessNutritionSummary:
      snapshot.fitnessNutritionSummaries?.find((summary) => summary.date === date) ?? null,
    weightRecords: sortByDateThenUpdatedAt(
      getWeightSource(snapshot)
        .filter(isVisibleEntity)
        .filter((record) => record.date === date),
    ),
  };
}

export function getDashboardStats(
  snapshot: LocalDataSnapshot,
  range: DateRange,
): DashboardStats {
  const rangedVisibleTasks = snapshot.tasks
    .filter(isVisibleEntity)
    .filter((task) => isDateInRange(getTaskProductivityDate(task), range));
  const rangedTasks = rangedVisibleTasks.filter(
    (task) => !hasBackfillMetadata(task),
  );
  const rangedWorkouts = getVisibleSharedWorkouts(snapshot)
    .filter((record) => isWithinDateRange(record.date, range.startDate, range.endDate));
  const rangedMeals = snapshot.mealRecords
    .filter(isVisibleOsMeal)
    .filter((record) => isWithinDateRange(record.date, range.startDate, range.endDate));
  const rangedFitnessNutritionSummaries = (snapshot.fitnessNutritionSummaries ?? [])
    .filter((summary) => isWithinDateRange(summary.date, range.startDate, range.endDate));
  const rangedWeights = sortByDateThenUpdatedAt(
    getWeightSource(snapshot)
      .filter(isVisibleEntity)
      .filter((record) => isWithinDateRange(record.date, range.startDate, range.endDate)),
  );
  const completedTasks = rangedTasks.filter((task) => task.isDone).length;
  const totalTasks = rangedTasks.length;
  const firstWeight = rangedWeights[0];
  const latestWeight = rangedWeights[rangedWeights.length - 1];
  const backfilledTaskCount = countBackfilledRecords(rangedVisibleTasks);
  const backfilledWorkoutCount = countBackfilledRecords(rangedWorkouts);
  const backfilledMealCount = countBackfilledRecords(rangedMeals);
  const backfilledWeightCount = countBackfilledRecords(rangedWeights);

  return {
    productivityScore:
      totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : null,
    completedTasks,
    totalTasks,
    averageCalories: averagePositiveWithFitnessSummaries(
      rangedMeals.map((record) => record.calories),
      rangedFitnessNutritionSummaries,
      "calories",
    ),
    averageProteinGrams: averagePositiveWithFitnessSummaries(
      rangedMeals.map((record) => record.proteinGrams),
      rangedFitnessNutritionSummaries,
      "proteinGrams",
    ),
    weightDeltaKg:
      firstWeight && latestWeight
        ? latestWeight.weightKg - firstWeight.weightKg
        : null,
    latestWeightKg: latestWeight?.weightKg ?? null,
    backfilledTaskCount,
    backfilledWorkoutCount,
    backfilledMealCount,
    backfilledWeightCount,
    totalBackfilledCount:
      backfilledTaskCount +
      backfilledWorkoutCount +
      backfilledMealCount +
      backfilledWeightCount,
  };
}

export function getCalendarMarkers(
  snapshot: LocalDataSnapshot,
  month: LocalDateString,
): CalendarMarkers {
  const range = getMonthRange(month);
  const markers: CalendarMarkers = {};

  for (const note of snapshot.notes.filter(isVisibleEntity)) {
    const date = toLocalDateFromTimestamp(note.updatedAt);

    if (isDateInRange(date, range)) {
      ensureMarker(markers, date as LocalDateString).notes = true;
    }
  }

  for (const task of snapshot.tasks.filter(isVisibleEntity)) {
    for (const { date, roles } of actionDatesInRange(task, range.startDate, range.endDate)) {
      const marker = ensureMarker(markers, date).tasks;
      if (task.registrationState === "CANDIDATE") {
        marker.candidateCount = (marker.candidateCount ?? 0) + 1;
        continue;
      }
      marker.confirmedCount = (marker.confirmedCount ?? 0) + 1;
      marker.activeCount++;
      if (roles.includes("PLAN")) {
        marker.plannedCount++;
        if (task.isDone) marker.completedPlannedCount++;
      }
      if (roles.includes("DEADLINE")) marker.dueCount++;
      if (roles.includes("EVENT")) marker.eventCount = (marker.eventCount ?? 0) + 1;
      if (roles.includes("WINDOW")) marker.windowCount = (marker.windowCount ?? 0) + 1;
    }
  }

  for (const marker of Object.values(markers)) {
    marker.tasks.allPlannedDone =
      marker.tasks.plannedCount > 0 &&
      marker.tasks.completedPlannedCount === marker.tasks.plannedCount;
  }

  for (const record of getVisibleSharedWorkouts(snapshot)) {
    if (isWithinDateRange(record.date, range.startDate, range.endDate)) {
      ensureMarker(markers, record.date).workouts = true;
    }
  }

  for (const record of snapshot.mealRecords.filter(isVisibleOsMeal)) {
    if (isWithinDateRange(record.date, range.startDate, range.endDate)) {
      ensureMarker(markers, record.date).meals = true;
    }
  }

  for (const summary of snapshot.fitnessNutritionSummaries ?? []) {
    if (isWithinDateRange(summary.date, range.startDate, range.endDate)) {
      ensureMarker(markers, summary.date).meals = true;
    }
  }

  for (const record of getWeightSource(snapshot).filter(isVisibleEntity)) {
    if (isWithinDateRange(record.date, range.startDate, range.endDate)) {
      ensureMarker(markers, record.date).weights = true;
    }
  }

  return markers;
}

export function getProductivitySeries(
  tasks: Task[],
  range: DateRange,
): ProductivityPoint[] {
  const visibleTasks = tasks
    .filter(isVisibleEntity)
    .filter((task) => !hasBackfillMetadata(task))
    .filter((task) => isDateInRange(getTaskProductivityDate(task), range));

  return getDateRangeDays(range).flatMap((date) => {
    const dateTasks = visibleTasks.filter((task) => task.plannedDate === date);

    if (dateTasks.length === 0) {
      return [];
    }

    return [{
      date,
      completedTasks: dateTasks.filter((task) => task.isDone).length,
      totalTasks: dateTasks.length,
    }];
  });
}

export function getNutritionSeries(
  meals: MealRecord[],
  range: DateRange,
  fitnessNutritionSummaries: FitnessNutritionSummaryV1[] = [],
): NutritionPoint[] {
  const visibleMeals = meals.filter(isVisibleOsMeal);
  const summariesByDate = new Map(
    fitnessNutritionSummaries.map((summary) => [summary.date, summary]),
  );

  return getDateRangeDays(range).map((date) => {
    const dateMeals = visibleMeals.filter((meal) => meal.date === date);
    const summary = summariesByDate.get(date);
    const summaries = summary ? [summary] : [];

    return {
      date,
      averageCalories: averagePositiveWithFitnessSummaries(
        dateMeals.map((meal) => meal.calories),
        summaries,
        "calories",
      ),
      averageProteinGrams: averagePositiveWithFitnessSummaries(
        dateMeals.map((meal) => meal.proteinGrams),
        summaries,
        "proteinGrams",
      ),
    };
  });
}

export function getWeightRecordsForDisplay(
  weights: WeightRecord[],
  syncStatus: { mode: string },
): WeightRecord[] {
  // Local cache is an archive until a successful full remote pull confirms it.
  return syncStatus.mode === "synced" ? weights : [];
}

export function getWeightSeries(
  weights: WeightRecord[],
  range: DateRange,
): WeightPoint[] {
  return sortByDateThenUpdatedAt(
    weights
      .filter(isVisibleEntity)
      .filter((record) => isWithinDateRange(record.date, range.startDate, range.endDate)),
  ).map((record) => ({
    date: record.date,
    weightKg: record.weightKg,
  }));
}
