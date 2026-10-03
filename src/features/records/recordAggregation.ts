import type {
  LocalDataSnapshot,
  MealRecord,
  Note,
  Task,
  WeightRecord,
} from "../../types";
import {
  countBackfilledRecords,
  hasBackfillMetadata,
} from "../../lib/dataTrust/backfillMetadata";
import { formatLocalDate, isWithinDateRange, parseDateInput } from "../fitness/fitnessDate";
import { getVisibleSharedWorkouts, type SharedWorkoutSummary } from "../fitness-summary/sharedWorkoutSummaries";

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
  return task.plannedDate;
}

function getTaskVisibleRange(
  task: Task,
): { startDate: LocalDateString; endDate: LocalDateString } | null {
  const createdDate = toLocalDateFromTimestamp(task.createdAt);
  const dueDate = task.dueDate;

  if (!createdDate) {
    return dueDate ? { startDate: dueDate, endDate: dueDate } : null;
  }

  if (!dueDate) {
    return { startDate: createdDate, endDate: createdDate };
  }

  const updatedDate = toLocalDateFromTimestamp(task.updatedAt);
  const endDate =
    task.isDone && updatedDate && updatedDate.localeCompare(dueDate) < 0
      ? updatedDate
      : dueDate;

  return createdDate.localeCompare(endDate) <= 0
    ? { startDate: createdDate, endDate }
    : { startDate: endDate, endDate };
}

function isTaskVisibleOnDate(task: Task, date: LocalDateString): boolean {
  const visibleRange = getTaskVisibleRange(task);

  return (
    task.plannedDate === date ||
    (visibleRange
      ? isWithinDateRange(date, visibleRange.startDate, visibleRange.endDate)
      : false)
  );
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
    averageCalories: averagePositive(rangedMeals.map((record) => record.calories)),
    averageProteinGrams: averagePositive(
      rangedMeals.map((record) => record.proteinGrams),
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
    if (isDateInRange(task.plannedDate, range)) {
      const taskMarker = ensureMarker(markers, task.plannedDate as LocalDateString).tasks;
      taskMarker.plannedCount += 1;

      if (task.isDone) {
        taskMarker.completedPlannedCount += 1;
      }
    }

    const visibleRange = getTaskVisibleRange(task);

    if (!visibleRange) {
      continue;
    }

    const startDate =
      visibleRange.startDate.localeCompare(range.startDate) < 0
        ? range.startDate
        : visibleRange.startDate;
    const endDate =
      visibleRange.endDate.localeCompare(range.endDate) > 0
        ? range.endDate
        : visibleRange.endDate;

    if (startDate.localeCompare(endDate) > 0) {
      continue;
    }

    for (const date of getDateRangeDays({ startDate, endDate })) {
      const taskMarker = ensureMarker(markers, date).tasks;
      taskMarker.activeCount += 1;

      if (task.dueDate === date) {
        taskMarker.dueCount += 1;
      }
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
): NutritionPoint[] {
  const visibleMeals = meals.filter(isVisibleOsMeal);

  return getDateRangeDays(range).map((date) => {
    const dateMeals = visibleMeals.filter((meal) => meal.date === date);

    return {
      date,
      averageCalories: averagePositive(dateMeals.map((meal) => meal.calories)),
      averageProteinGrams: averagePositive(
        dateMeals.map((meal) => meal.proteinGrams),
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
