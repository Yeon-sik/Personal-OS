export interface TaskChecklistItem {
  id: string;
  text: string;
  isDone: boolean;
}

export interface TaskRecurrence {
  frequency: "DAILY" | "WEEKLY" | "MONTHLY";
  interval: number;
  /** Original calendar anchor: monthly occurrences retain its day of month. */
  anchorDate: string;
}

export interface TaskPlanningFields {
  completedAt: string | null;
  skippedAt: string | null;
  description: string;
  category: string | null;
  checklist: TaskChecklistItem[];
  recurrence: TaskRecurrence | null;
  recurrenceSeriesId: string | null;
  recurrenceOccurrence: number | null;
  projectActionId: string | null;
}

export type TaskDetailsChanges = Partial<Pick<TaskPlanningFields,
  "description" | "category" | "checklist" | "recurrence" | "projectActionId"
>>;
