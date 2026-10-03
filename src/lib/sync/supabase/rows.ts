import type { SupabaseClient as SupabaseClientBase } from "@supabase/supabase-js";

export interface EntityAuditRow {
  created_at?: string | null;
  is_backfilled?: boolean | null;
  backfilled_at?: string | null;
  backfill_reason?: string | null;
}

export interface NoteRow extends EntityAuditRow {
  id: string;
  user_id: string;
  title: string;
  content: string;
  updated_at: string;
  deleted_at: string | null;
  device_id: string;
}

export interface TaskRow extends EntityAuditRow {
  id: string;
  user_id: string;
  text: string;
  is_done: boolean;
  order_index: number;
  due_date: string | null;
  due_time: string | null;
  planned_date: string | null;
  updated_at: string;
  deleted_at: string | null;
  device_id: string;
}

export interface WorkoutRecordRow extends EntityAuditRow {
  id: string;
  user_id: string;
  date: string;
  workout_type: string;
  category: string;
  exercise_name: string;
  duration_seconds: number | null;
  average_heart_rate: number | null;
  source_app?: "os" | "fitness" | null;
  scope?: "os" | "fitness" | "both" | null;
  metadata?: Record<string, unknown> | null;
  contract_version?: number | null;
  updated_at: string;
  deleted_at: string | null;
  device_id: string;
}

export interface FitnessSummaryProjectionV2Row extends EntityAuditRow {
  id: string;
  user_id: string;
  source_fitness_session_id: string;
  date: string;
  completion_status: "completed";
  chest_sets: number;
  back_sets: number;
  legs_sets: number;
  shoulders_sets: number;
  abs_sets: number;
  triceps_sets: number;
  biceps_sets: number;
  total_duration_seconds: number | null;
  cardio_duration_seconds: number | null;
  contract_version: 2;
  updated_at: string;
  deleted_at: string | null;
  device_id: string;
}

export interface MealRecordRow extends EntityAuditRow {
  id: string;
  user_id: string;
  date: string;
  menu: string;
  calories: number;
  protein_grams: number;
  carbs_grams: number | null;
  fat_grams: number | null;
  source_app?: "os" | "fitness" | null;
  scope?: "os" | "fitness" | "both" | null;
  metadata?: Record<string, unknown> | null;
  contract_version?: number | null;
  updated_at: string;
  deleted_at: string | null;
  device_id: string;
}

export interface WeightRecordRow extends EntityAuditRow {
  id: string;
  user_id: string;
  date: string;
  weight_kg: number;
  source_app?: "os" | "fitness" | null;
  scope?: "os" | "fitness" | "both" | null;
  metadata?: Record<string, unknown> | null;
  contract_version?: number | null;
  updated_at: string;
  deleted_at: string | null;
  device_id: string;
}

export interface ProjectRow extends EntityAuditRow {
  id: string;
  user_id: string;
  name: string;
  /** Optional at the wire boundary so rows from pre-description schemas remain readable. */
  description?: string | null;
  repository: string | null;
  branch: string | null;
  /** Optional at the wire boundary so rows from pre-migration schemas remain readable. */
  github_repository_id?: string | null;
  github_owner?: string | null;
  github_repo?: string | null;
  status: "PLANNED" | "ACTIVE" | "COMPLETED";
  current_summary: string;
  target_summary: string;
  last_verified_commit: string | null;
  last_verified_at: string | null;
  updated_at: string;
  deleted_at: string | null;
  device_id: string;
}

export interface ProjectMilestoneRow extends EntityAuditRow {
  id: string;
  user_id: string;
  project_id: string;
  title: string;
  status: "PLANNED" | "IN_PROGRESS" | "COMPLETED";
  updated_at: string;
  deleted_at: string | null;
  device_id: string;
}

export interface ProjectActionRow extends EntityAuditRow {
  id: string;
  user_id: string;
  project_id: string;
  title: string;
  type: "NEXT" | "LATER" | "BLOCKED";
  status: "OPEN" | "DONE";
  updated_at: string;
  deleted_at: string | null;
  device_id: string;
}

export interface ProjectIdeaRow extends EntityAuditRow {
  id: string;
  user_id: string;
  project_id: string;
  title: string;
  updated_at: string;
  deleted_at: string | null;
  device_id: string;
}

export interface ProjectHistoryRow extends EntityAuditRow {
  id: string;
  user_id: string;
  project_id: string;
  type: "STATUS_CHANGE" | "MILESTONE" | "RELEASE" | "NOTE";
  summary: string;
  occurred_at: string;
  github_ref: string | null;
  updated_at: string;
  deleted_at: string | null;
  device_id: string;
}

export interface WorkstreamRow extends EntityAuditRow {
  id: string;
  user_id: string;
  name: string;
  status: "PLANNED" | "ACTIVE" | "COMPLETED";
  updated_at: string;
  deleted_at: string | null;
  device_id: string;
}

/**
 * Relation ids are stable text keys (for example workstreamId:projectId).
 * This keeps concurrent devices convergent while retaining the shared
 * Syncable/audit/tombstone contract.
 */
export interface WorkstreamProjectRow extends EntityAuditRow {
  id: string;
  user_id: string;
  workstream_id: string;
  project_id: string;
  updated_at: string;
  deleted_at: string | null;
  device_id: string;
}

export interface WorkstreamMilestoneRow extends EntityAuditRow {
  id: string;
  user_id: string;
  workstream_id: string;
  title: string;
  status: "PLANNED" | "IN_PROGRESS" | "COMPLETED";
  updated_at: string;
  deleted_at: string | null;
  device_id: string;
}

export interface WorkstreamActionRow extends EntityAuditRow {
  id: string;
  user_id: string;
  workstream_id: string;
  title: string;
  type: "NEXT" | "LATER" | "BLOCKED";
  status: "OPEN" | "DONE";
  updated_at: string;
  deleted_at: string | null;
  device_id: string;
}

export interface WorkstreamActionProjectRow extends EntityAuditRow {
  id: string;
  user_id: string;
  action_id: string;
  project_id: string;
  updated_at: string;
  deleted_at: string | null;
  device_id: string;
}

export interface WorkstreamActionDependencyRow extends EntityAuditRow {
  id: string;
  user_id: string;
  action_id: string;
  depends_on_action_id: string;
  updated_at: string;
  deleted_at: string | null;
  device_id: string;
}

export interface KnowledgeDocumentRow extends EntityAuditRow {
  id: string;
  user_id: string;
  title: string;
  type: "IDEA" | "PLAN" | "DESIGN" | "RESEARCH" | "NOTE";
  project_id: string | null;
  workstream_id: string | null;
  relative_path: string;
  updated_at: string;
  deleted_at: string | null;
  device_id: string;
}

export interface DeviceRow {
  id: string;
  user_id: string;
  name: string;
  last_seen_at: string;
  app_version: string | null;
}

export interface FinanceDailySummaryRow {
  user_id: string;
  date: string;
  income_krw: number;
  expense_krw: number;
  net_krw: number;
  entry_count: number;
}

export type FinanceDailySummarySelectedRow = Pick<
  FinanceDailySummaryRow,
  "date" | "income_krw" | "expense_krw" | "net_krw" | "entry_count"
>;

export interface PostgresChangePayload<Row> {
  eventType: "INSERT" | "UPDATE" | "DELETE";
  new?: Row | null;
  old?: Partial<Row>;
}

export interface Database {
  public: {
    Tables: {
      notes: {
        Row: NoteRow;
        Insert: NoteRow;
        Update: Partial<NoteRow>;
        Relationships: [];
      };
      tasks: {
        Row: TaskRow;
        Insert: TaskRow;
        Update: Partial<TaskRow>;
        Relationships: [];
      };
      workout_records: {
        Row: WorkoutRecordRow;
        Insert: WorkoutRecordRow;
        Update: Partial<WorkoutRecordRow>;
        Relationships: [];
      };
      fitness_summary_projections_v2: {
        Row: FitnessSummaryProjectionV2Row;
        Insert: FitnessSummaryProjectionV2Row;
        Update: Partial<FitnessSummaryProjectionV2Row>;
        Relationships: [];
      };
      meal_records: {
        Row: MealRecordRow;
        Insert: MealRecordRow;
        Update: Partial<MealRecordRow>;
        Relationships: [];
      };
      weight_records: {
        Row: WeightRecordRow;
        Insert: WeightRecordRow;
        Update: Partial<WeightRecordRow>;
        Relationships: [];
      };
      projects: {
        Row: ProjectRow;
        Insert: ProjectRow;
        Update: Partial<ProjectRow>;
        Relationships: [];
      };
      knowledge_documents: {
        Row: KnowledgeDocumentRow;
        Insert: KnowledgeDocumentRow;
        Update: Partial<KnowledgeDocumentRow>;
        Relationships: [];
      };
      project_milestones: {
        Row: ProjectMilestoneRow;
        Insert: ProjectMilestoneRow;
        Update: Partial<ProjectMilestoneRow>;
        Relationships: [];
      };
      project_actions: {
        Row: ProjectActionRow;
        Insert: ProjectActionRow;
        Update: Partial<ProjectActionRow>;
        Relationships: [];
      };
      project_ideas: {
        Row: ProjectIdeaRow;
        Insert: ProjectIdeaRow;
        Update: Partial<ProjectIdeaRow>;
        Relationships: [];
      };
      project_history: {
        Row: ProjectHistoryRow;
        Insert: ProjectHistoryRow;
        Update: Partial<ProjectHistoryRow>;
        Relationships: [];
      };
      workstreams: {
        Row: WorkstreamRow;
        Insert: WorkstreamRow;
        Update: Partial<WorkstreamRow>;
        Relationships: [];
      };
      workstream_projects: {
        Row: WorkstreamProjectRow;
        Insert: WorkstreamProjectRow;
        Update: Partial<WorkstreamProjectRow>;
        Relationships: [];
      };
      workstream_milestones: {
        Row: WorkstreamMilestoneRow;
        Insert: WorkstreamMilestoneRow;
        Update: Partial<WorkstreamMilestoneRow>;
        Relationships: [];
      };
      workstream_actions: {
        Row: WorkstreamActionRow;
        Insert: WorkstreamActionRow;
        Update: Partial<WorkstreamActionRow>;
        Relationships: [];
      };
      workstream_action_projects: {
        Row: WorkstreamActionProjectRow;
        Insert: WorkstreamActionProjectRow;
        Update: Partial<WorkstreamActionProjectRow>;
        Relationships: [];
      };
      workstream_action_dependencies: {
        Row: WorkstreamActionDependencyRow;
        Insert: WorkstreamActionDependencyRow;
        Update: Partial<WorkstreamActionDependencyRow>;
        Relationships: [];
      };
      devices: {
        Row: DeviceRow;
        Insert: DeviceRow;
        Update: Partial<DeviceRow>;
        Relationships: [];
      };
    };
    Views: {
      fitness_nutrition_summary_v1: {
        Row: { id: string; user_id: string; date: string; contract_version: 1; meal_count: number; calories: number | null; carbs_grams: number | null; protein_grams: number | null; fat_grams: number | null; updated_at: string };
        Relationships: [];
      };
      finance_summary_daily: {
        Row: FinanceDailySummaryRow;
        Relationships: [];
      };
    };
    Functions: Record<string, never>;
  };
}

export type SupabaseClient = SupabaseClientBase<Database, "public">;

export type SnapshotTableName =
  | "notes"
  | "tasks"
  | "workout_records"
  | "fitness_summary_projections_v2"
  | "fitness_nutrition_summary_v1"
  | "meal_records"
  | "weight_records"
  | "devices"
  | "projects"
  | "project_milestones"
  | "project_actions"
  | "project_ideas"
  | "project_history"
  | "workstreams"
  | "workstream_projects"
  | "workstream_milestones"
  | "workstream_actions"
  | "workstream_action_projects"
  | "workstream_action_dependencies"
  | "knowledge_documents";

export type RealtimeTableName = Exclude<SnapshotTableName, "devices" | "fitness_nutrition_summary_v1">;
