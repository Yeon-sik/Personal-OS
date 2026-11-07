-- LocalSyncMemo development schema
-- user_id는 Supabase Auth의 auth.users.id를 text로 저장한다.
-- 이 파일의 마지막 RLS 정책이 익명 접근을 차단하고 소유자 행만 허용한다.

create table if not exists public.devices (
  id text not null,
  user_id text not null,
  name text not null,
  last_seen_at timestamptz not null,
  app_version text,
  primary key (user_id, id)
);

-- notes/tasks는 삭제 전파를 위해 hard delete 대신 deleted_at tombstone을 저장한다.
create table if not exists public.notes (
  id uuid primary key,
  user_id text not null,
  title text not null,
  content text not null,
  created_at timestamptz not null default now(),
  is_backfilled boolean not null default false,
  backfilled_at timestamptz,
  backfill_reason text,
  updated_at timestamptz not null,
  deleted_at timestamptz,
  device_id text not null,
  constraint notes_device_fk
    foreign key (user_id, device_id)
    references public.devices(user_id, id)
);

create table if not exists public.tasks (
  id uuid primary key,
  user_id text not null,
  text text not null,
  is_done boolean not null default false,
  order_index integer not null default 0,
  due_date date,
  due_time time,
  planned_date date,
  created_at timestamptz not null default now(),
  is_backfilled boolean not null default false,
  backfilled_at timestamptz,
  backfill_reason text,
  updated_at timestamptz not null,
  deleted_at timestamptz,
  device_id text not null,
  constraint tasks_device_fk
    foreign key (user_id, device_id)
    references public.devices(user_id, id)
);

create table if not exists public.workout_records (
  id uuid primary key,
  user_id text not null,
  date date not null,
  workout_type text not null
    check (workout_type in ('strength', 'cardio', 'other')),
  category text not null,
  exercise_name text not null,
  duration_seconds integer,
  total_volume_kg double precision not null default 0,
  average_heart_rate double precision,
  created_at timestamptz not null default now(),
  is_backfilled boolean not null default false,
  backfilled_at timestamptz,
  backfill_reason text,
  updated_at timestamptz not null,
  deleted_at timestamptz,
  device_id text not null,
  source_app text not null default 'os'
    check (source_app in ('os', 'fitness')),
  scope text not null default 'both'
    check (scope in ('os', 'fitness', 'both')),
  metadata jsonb not null default '{}'::jsonb,
  contract_version smallint not null default 1
    check (contract_version = 1),
  constraint workout_records_device_fk
    foreign key (user_id, device_id)
    references public.devices(user_id, id)
);

create table if not exists public.meal_records (
  id uuid primary key,
  user_id text not null,
  date date not null,
  menu text not null,
  calories integer not null,
  protein_grams double precision not null,
  carbs_grams double precision,
  fat_grams double precision,
  created_at timestamptz not null default now(),
  is_backfilled boolean not null default false,
  backfilled_at timestamptz,
  backfill_reason text,
  updated_at timestamptz not null,
  deleted_at timestamptz,
  device_id text not null,
  source_app text not null default 'os'
    check (source_app in ('os', 'fitness')),
  scope text not null default 'both'
    check (scope in ('os', 'fitness', 'both')),
  metadata jsonb not null default '{}'::jsonb,
  contract_version smallint not null default 1
    check (contract_version = 1),
  constraint meal_records_device_fk
    foreign key (user_id, device_id)
    references public.devices(user_id, id)
);

create table if not exists public.meal_record_items (
  id uuid primary key,
  user_id text not null,
  meal_record_id uuid not null,
  food_id text,
  food_name_snapshot text not null,
  food_kind_snapshot text,
  quantity double precision not null,
  unit text not null,
  basis_amount_snapshot double precision,
  basis_unit_snapshot text,
  prep_state_snapshot text,
  calories double precision not null default 0,
  protein_grams double precision not null default 0,
  carbs_grams double precision not null default 0,
  fat_grams double precision not null default 0,
  sodium_mg double precision,
  saturated_fat_grams double precision,
  sugars_grams double precision,
  fiber_grams double precision,
  added_sugars_grams double precision,
  trans_fat_grams double precision,
  cholesterol_mg double precision,
  source_type_snapshot text,
  source_reference_snapshot text,
  source_version_snapshot text,
  food_data_version_snapshot integer,
  order_index integer not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null,
  deleted_at timestamptz,
  device_id text not null,
  constraint meal_record_items_meal_fk
    foreign key (meal_record_id)
    references public.meal_records(id),
  constraint meal_record_items_device_fk
    foreign key (user_id, device_id)
    references public.devices(user_id, id)
);

create table if not exists public.meal_record_item_nutrients (
  id uuid primary key,
  user_id text not null,
  meal_record_id uuid not null,
  meal_record_item_id uuid not null,
  nutrient_code text not null,
  amount double precision not null,
  unit text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null,
  deleted_at timestamptz,
  device_id text not null,
  constraint meal_record_item_nutrients_item_code_key
    unique (meal_record_item_id, nutrient_code),
  constraint meal_record_item_nutrients_meal_fk
    foreign key (meal_record_id)
    references public.meal_records(id),
  constraint meal_record_item_nutrients_item_fk
    foreign key (meal_record_item_id)
    references public.meal_record_items(id),
  constraint meal_record_item_nutrients_device_fk
    foreign key (user_id, device_id)
    references public.devices(user_id, id)
);

create table if not exists public.weight_records (
  id uuid primary key,
  user_id text not null,
  date date not null,
  weight_kg double precision not null,
  created_at timestamptz not null default now(),
  is_backfilled boolean not null default false,
  backfilled_at timestamptz,
  backfill_reason text,
  updated_at timestamptz not null,
  deleted_at timestamptz,
  device_id text not null,
  source_app text not null default 'os'
    check (source_app in ('os', 'fitness')),
  scope text not null default 'both'
    check (scope in ('os', 'fitness', 'both')),
  metadata jsonb not null default '{}'::jsonb,
  contract_version smallint not null default 1
    check (contract_version = 1),
  constraint weight_records_device_fk
    foreign key (user_id, device_id)
    references public.devices(user_id, id)
);

create table if not exists public.fitness_summary_projections_v2 (
  id text not null,
  user_id text not null,
  source_fitness_session_id text not null,
  date date not null,
  completion_status text not null check (completion_status = 'completed'),
  chest_sets integer not null default 0 check (chest_sets >= 0),
  back_sets integer not null default 0 check (back_sets >= 0),
  legs_sets integer not null default 0 check (legs_sets >= 0),
  shoulders_sets integer not null default 0 check (shoulders_sets >= 0),
  abs_sets integer not null default 0 check (abs_sets >= 0),
  triceps_sets integer not null default 0 check (triceps_sets >= 0),
  biceps_sets integer not null default 0 check (biceps_sets >= 0),
  total_duration_seconds integer check (total_duration_seconds is null or total_duration_seconds >= 0),
  cardio_duration_seconds integer check (cardio_duration_seconds is null or cardio_duration_seconds >= 0),
  contract_version smallint not null default 2 check (contract_version = 2),
  created_at timestamptz not null default now(),
  is_backfilled boolean not null default false,
  backfilled_at timestamptz,
  backfill_reason text,
  updated_at timestamptz not null,
  deleted_at timestamptz,
  device_id text not null,
  primary key (user_id, id),
  constraint fitness_summary_projection_v2_source_key
    unique (user_id, source_fitness_session_id)
);

create index if not exists fitness_summary_projection_v2_user_date_idx
  on public.fitness_summary_projections_v2(user_id, date desc);

create index if not exists fitness_summary_projection_v2_user_updated_at_idx
  on public.fitness_summary_projections_v2(user_id, updated_at desc);

create table if not exists public.workout_exercises (
  id uuid primary key,
  user_id text not null,
  record_id uuid not null,
  order_index integer not null,
  exercise_id text not null,
  exercise_name_snapshot text not null,
  ui_part text not null,
  primary_sub_part_snapshot text,
  equipment_snapshot text,
  record_type text not null
    check (record_type in (
      'weight_reps',
      'reps_only',
      'time',
      'weight_time',
      'assisted_weight_reps',
      'bodyweight_added_weight_reps'
    )),
  contract_version smallint not null default 1
    check (contract_version = 1),
  memo text,
  device_id text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null,
  deleted_at timestamptz,
  constraint workout_exercises_record_fk
    foreign key (record_id)
    references public.workout_records(id),
  constraint workout_exercises_device_fk
    foreign key (user_id, device_id)
    references public.devices(user_id, id)
);

create table if not exists public.workout_sets (
  id uuid primary key,
  user_id text not null,
  workout_exercise_id uuid not null,
  set_index integer not null,
  target_reps integer,
  actual_reps integer,
  weight_kg double precision,
  volume_kg double precision,
  duration_seconds integer,
  distance_meters double precision,
  rest_seconds integer,
  assisted_weight_kg double precision,
  added_weight_kg double precision,
  is_completed boolean not null default false,
  rpe integer,
  memo text,
  device_id text not null,
  contract_version smallint not null default 1
    check (contract_version = 1),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null,
  deleted_at timestamptz,
  constraint workout_sets_exercise_fk
    foreign key (workout_exercise_id)
    references public.workout_exercises(id),
  constraint workout_sets_device_fk
    foreign key (user_id, device_id)
    references public.devices(user_id, id),
  constraint workout_sets_values_v1 check (
    set_index > 0
    and (target_reps is null or target_reps >= 0)
    and (actual_reps is null or actual_reps >= 0)
    and (weight_kg is null or weight_kg >= 0)
    and (volume_kg is null or volume_kg >= 0)
    and (duration_seconds is null or duration_seconds >= 0)
    and (distance_meters is null or distance_meters >= 0)
    and (rest_seconds is null or rest_seconds >= 0)
    and (assisted_weight_kg is null or assisted_weight_kg >= 0)
    and (added_weight_kg is null or added_weight_kg >= 0)
    and (rpe is null or rpe between 1 and 10)
  )
);

alter table public.tasks
  add column if not exists due_date date;

alter table public.tasks
  add column if not exists due_time time;

alter table public.tasks
  add column if not exists planned_date date;

alter table public.notes
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists is_backfilled boolean not null default false,
  add column if not exists backfilled_at timestamptz,
  add column if not exists backfill_reason text;

alter table public.tasks
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists is_backfilled boolean not null default false,
  add column if not exists backfilled_at timestamptz,
  add column if not exists backfill_reason text;

alter table public.workout_records
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists is_backfilled boolean not null default false,
  add column if not exists backfilled_at timestamptz,
  add column if not exists backfill_reason text,
  add column if not exists duration_seconds integer,
  add column if not exists total_volume_kg double precision not null default 0,
  add column if not exists average_heart_rate double precision,
  add column if not exists source_app text not null default 'os',
  add column if not exists scope text not null default 'both',
  add column if not exists metadata jsonb not null default '{}'::jsonb;
alter table public.workout_records
  add column if not exists contract_version smallint not null default 1;

alter table public.meal_records
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists is_backfilled boolean not null default false,
  add column if not exists backfilled_at timestamptz,
  add column if not exists backfill_reason text,
  add column if not exists source_app text not null default 'os',
  add column if not exists scope text not null default 'both',
  add column if not exists metadata jsonb not null default '{}'::jsonb;
alter table public.meal_records
  add column if not exists contract_version smallint not null default 1;

alter table public.weight_records
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists is_backfilled boolean not null default false,
  add column if not exists backfilled_at timestamptz,
  add column if not exists backfill_reason text,
  add column if not exists source_app text not null default 'os',
  add column if not exists scope text not null default 'both',
  add column if not exists metadata jsonb not null default '{}'::jsonb;
alter table public.weight_records
  add column if not exists contract_version smallint not null default 1;

alter table public.workout_exercises
  add column if not exists contract_version smallint not null default 1;

alter table public.workout_sets
  add column if not exists contract_version smallint not null default 1;

-- pull sync와 활성 목록 조회가 자주 쓰는 user_id + 시간/순서 기준 인덱스다.
create index if not exists notes_user_updated_at_idx
  on public.notes(user_id, updated_at desc);

create index if not exists notes_user_deleted_at_idx
  on public.notes(user_id, deleted_at);

create index if not exists tasks_user_updated_at_idx
  on public.tasks(user_id, updated_at desc);

create index if not exists tasks_user_deleted_at_idx
  on public.tasks(user_id, deleted_at);

create index if not exists tasks_user_order_index_idx
  on public.tasks(user_id, order_index);

create index if not exists tasks_user_due_date_idx
  on public.tasks(user_id, due_date);

create index if not exists tasks_user_planned_date_idx
  on public.tasks(user_id, planned_date);

create index if not exists workout_records_user_updated_at_idx
  on public.workout_records(user_id, updated_at desc);

create index if not exists workout_records_user_deleted_at_idx
  on public.workout_records(user_id, deleted_at);

create index if not exists workout_records_user_date_idx
  on public.workout_records(user_id, date);

create index if not exists workout_records_user_type_category_idx
  on public.workout_records(user_id, workout_type, category);

create index if not exists workout_records_user_scope_date_idx
  on public.workout_records(user_id, scope, date desc);

create index if not exists workout_exercises_user_record_order_idx
  on public.workout_exercises(user_id, record_id, order_index);

create index if not exists workout_exercises_user_updated_at_idx
  on public.workout_exercises(user_id, updated_at desc);

create index if not exists workout_sets_user_exercise_set_idx
  on public.workout_sets(user_id, workout_exercise_id, set_index);

create index if not exists workout_sets_user_updated_at_idx
  on public.workout_sets(user_id, updated_at desc);

create index if not exists meal_records_user_updated_at_idx
  on public.meal_records(user_id, updated_at desc);

create index if not exists meal_records_user_deleted_at_idx
  on public.meal_records(user_id, deleted_at);

create index if not exists meal_records_user_date_idx
  on public.meal_records(user_id, date);

create index if not exists meal_record_items_user_meal_order_idx
  on public.meal_record_items(user_id, meal_record_id, order_index);

create index if not exists meal_record_item_nutrients_user_meal_idx
  on public.meal_record_item_nutrients(user_id, meal_record_id, nutrient_code);

create index if not exists weight_records_user_updated_at_idx
  on public.weight_records(user_id, updated_at desc);

create index if not exists weight_records_user_deleted_at_idx
  on public.weight_records(user_id, deleted_at);

create index if not exists weight_records_user_date_idx
  on public.weight_records(user_id, date);

create index if not exists devices_user_last_seen_at_idx
  on public.devices(user_id, last_seen_at desc);

-- Supabase Realtime이 세 테이블의 변경 이벤트를 클라이언트로 보내도록 등록한다.
do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'notes'
  ) then
    alter publication supabase_realtime add table public.notes;
  end if;

  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'tasks'
  ) then
    alter publication supabase_realtime add table public.tasks;
  end if;

  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'devices'
  ) then
    alter publication supabase_realtime add table public.devices;
  end if;

  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'workout_records'
  ) then
    alter publication supabase_realtime add table public.workout_records;
  end if;

  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'workout_exercises'
  ) then
    alter publication supabase_realtime add table public.workout_exercises;
  end if;

  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'workout_sets'
  ) then
    alter publication supabase_realtime add table public.workout_sets;
  end if;

  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'meal_records'
  ) then
    alter publication supabase_realtime add table public.meal_records;
  end if;

  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'weight_records'
  ) then
    alter publication supabase_realtime add table public.weight_records;
  end if;

  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'fitness_summary_projections_v2'
  ) then
    alter publication supabase_realtime add table public.fitness_summary_projections_v2;
  end if;
end $$;

-- Fresh production installs are private by default. Existing installs use the
-- guarded 20260724121000 migration after assigning legacy rows to auth.users.
revoke all on table
  public.devices, public.notes, public.tasks, public.workout_records,
  public.workout_exercises, public.workout_sets, public.meal_records,
  public.meal_record_items, public.meal_record_item_nutrients,
  public.weight_records, public.fitness_summary_projections_v2
from anon;

grant select, insert, update, delete on table
  public.devices, public.notes, public.tasks, public.workout_records,
  public.workout_exercises, public.workout_sets, public.meal_records,
  public.meal_record_items, public.meal_record_item_nutrients,
  public.weight_records
to authenticated;

revoke all on table public.fitness_summary_projections_v2 from authenticated;
grant select on table public.fitness_summary_projections_v2 to authenticated;

alter table public.devices enable row level security;
alter table public.notes enable row level security;
alter table public.tasks enable row level security;
alter table public.workout_records enable row level security;
alter table public.workout_exercises enable row level security;
alter table public.workout_sets enable row level security;
alter table public.meal_records enable row level security;
alter table public.meal_record_items enable row level security;
alter table public.meal_record_item_nutrients enable row level security;
alter table public.weight_records enable row level security;
alter table public.fitness_summary_projections_v2 enable row level security;

drop policy if exists fitness_summary_projection_v2_select_own
  on public.fitness_summary_projections_v2;
create policy fitness_summary_projection_v2_select_own
  on public.fitness_summary_projections_v2
  for select to authenticated
  using ((select auth.uid())::text = user_id);

create or replace function public.upsert_fitness_summary_projection_v2(
  p_projection jsonb
)
returns setof public.fitness_summary_projections_v2
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id text := (select auth.uid())::text;
  v_source_session_id text := nullif(trim(p_projection->>'source_fitness_session_id'), '');
  v_updated_at timestamptz;
begin
  if v_user_id is null or v_user_id = '' then
    raise exception 'authenticated user is required';
  end if;
  if jsonb_typeof(p_projection) <> 'object' then
    raise exception 'projection must be a JSON object';
  end if;
  if v_source_session_id is null then
    raise exception 'source_fitness_session_id is required';
  end if;
  if p_projection->>'completion_status' <> 'completed' then
    raise exception 'only completed projections may be shared';
  end if;
  if coalesce((p_projection->>'contract_version')::integer, 0) <> 2 then
    raise exception 'fitness summary projection v2 is required';
  end if;

  v_updated_at := coalesce(
    nullif(p_projection->>'updated_at', '')::timestamptz,
    now()
  );

  return query
  insert into public.fitness_summary_projections_v2 (
    id,
    user_id,
    source_fitness_session_id,
    date,
    completion_status,
    chest_sets,
    back_sets,
    legs_sets,
    shoulders_sets,
    abs_sets,
    triceps_sets,
    biceps_sets,
    total_duration_seconds,
    cardio_duration_seconds,
    contract_version,
    created_at,
    is_backfilled,
    backfilled_at,
    backfill_reason,
    updated_at,
    deleted_at,
    device_id
  ) values (
    v_source_session_id,
    v_user_id,
    v_source_session_id,
    (p_projection->>'date')::date,
    'completed',
    coalesce((p_projection->>'chest_sets')::integer, 0),
    coalesce((p_projection->>'back_sets')::integer, 0),
    coalesce((p_projection->>'legs_sets')::integer, 0),
    coalesce((p_projection->>'shoulders_sets')::integer, 0),
    coalesce((p_projection->>'abs_sets')::integer, 0),
    coalesce((p_projection->>'triceps_sets')::integer, 0),
    coalesce((p_projection->>'biceps_sets')::integer, 0),
    nullif(p_projection->>'total_duration_seconds', '')::integer,
    nullif(p_projection->>'cardio_duration_seconds', '')::integer,
    2,
    coalesce(nullif(p_projection->>'created_at', '')::timestamptz, v_updated_at),
    coalesce((p_projection->>'is_backfilled')::boolean, false),
    nullif(p_projection->>'backfilled_at', '')::timestamptz,
    nullif(p_projection->>'backfill_reason', ''),
    v_updated_at,
    nullif(p_projection->>'deleted_at', '')::timestamptz,
    coalesce(nullif(trim(p_projection->>'device_id'), ''), 'fitness-app')
  )
  on conflict (user_id, id) do update set
    date = excluded.date,
    completion_status = excluded.completion_status,
    chest_sets = excluded.chest_sets,
    back_sets = excluded.back_sets,
    legs_sets = excluded.legs_sets,
    shoulders_sets = excluded.shoulders_sets,
    abs_sets = excluded.abs_sets,
    triceps_sets = excluded.triceps_sets,
    biceps_sets = excluded.biceps_sets,
    total_duration_seconds = excluded.total_duration_seconds,
    cardio_duration_seconds = excluded.cardio_duration_seconds,
    is_backfilled = excluded.is_backfilled,
    backfilled_at = excluded.backfilled_at,
    backfill_reason = excluded.backfill_reason,
    updated_at = excluded.updated_at,
    deleted_at = excluded.deleted_at,
    device_id = excluded.device_id
  where public.fitness_summary_projections_v2.updated_at <= excluded.updated_at
  returning *;
end;
$$;

comment on table public.fitness_summary_projections_v2 is
  'FitnessApp-owned read model for Personal OS; no exercise or per-set detail.';
comment on function public.upsert_fitness_summary_projection_v2(jsonb) is
  'FitnessApp-owned write boundary for completed Summary Projection v2 rows.';

revoke all on function public.upsert_fitness_summary_projection_v2(jsonb)
  from public, anon, authenticated;
grant execute on function public.upsert_fitness_summary_projection_v2(jsonb)
  to authenticated;

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'devices', 'notes', 'tasks', 'workout_records', 'workout_exercises',
    'workout_sets', 'meal_records', 'meal_record_items',
    'meal_record_item_nutrients', 'weight_records'
  ]
  loop
    execute format('drop policy if exists %I on public.%I', table_name || '_select_own', table_name);
    execute format('drop policy if exists %I on public.%I', table_name || '_insert_own', table_name);
    execute format('drop policy if exists %I on public.%I', table_name || '_update_own', table_name);
    execute format('drop policy if exists %I on public.%I', table_name || '_delete_own', table_name);
    execute format(
      'create policy %I on public.%I for select to authenticated
       using ((select auth.uid())::text = user_id)',
      table_name || '_select_own', table_name
    );
    execute format(
      'create policy %I on public.%I for insert to authenticated
       with check ((select auth.uid())::text = user_id)',
      table_name || '_insert_own', table_name
    );
    execute format(
      'create policy %I on public.%I for update to authenticated
       using ((select auth.uid())::text = user_id)
       with check ((select auth.uid())::text = user_id)',
      table_name || '_update_own', table_name
    );
    execute format(
      'create policy %I on public.%I for delete to authenticated
       using ((select auth.uid())::text = user_id)',
      table_name || '_delete_own', table_name
    );
  end loop;
end $$;

drop policy if exists workout_exercises_insert_own on public.workout_exercises;
create policy workout_exercises_insert_own
  on public.workout_exercises for insert to authenticated
  with check (
    (select auth.uid())::text = user_id
    and exists (
      select 1 from public.workout_records parent
      where parent.id = record_id
        and parent.user_id = (select auth.uid())::text
    )
  );

drop policy if exists workout_exercises_update_own on public.workout_exercises;
create policy workout_exercises_update_own
  on public.workout_exercises for update to authenticated
  using ((select auth.uid())::text = user_id)
  with check (
    (select auth.uid())::text = user_id
    and exists (
      select 1 from public.workout_records parent
      where parent.id = record_id
        and parent.user_id = (select auth.uid())::text
    )
  );

drop policy if exists workout_sets_insert_own on public.workout_sets;
create policy workout_sets_insert_own
  on public.workout_sets for insert to authenticated
  with check (
    (select auth.uid())::text = user_id
    and exists (
      select 1 from public.workout_exercises parent
      where parent.id = workout_exercise_id
        and parent.user_id = (select auth.uid())::text
    )
  );

drop policy if exists workout_sets_update_own on public.workout_sets;
create policy workout_sets_update_own
  on public.workout_sets for update to authenticated
  using ((select auth.uid())::text = user_id)
  with check (
    (select auth.uid())::text = user_id
    and exists (
      select 1 from public.workout_exercises parent
      where parent.id = workout_exercise_id
        and parent.user_id = (select auth.uid())::text
    )
  );

drop policy if exists meal_record_items_insert_own on public.meal_record_items;
create policy meal_record_items_insert_own
  on public.meal_record_items for insert to authenticated
  with check (
    (select auth.uid())::text = user_id
    and exists (
      select 1 from public.meal_records parent
      where parent.id = meal_record_id
        and parent.user_id = (select auth.uid())::text
    )
  );

drop policy if exists meal_record_items_update_own on public.meal_record_items;
create policy meal_record_items_update_own
  on public.meal_record_items for update to authenticated
  using ((select auth.uid())::text = user_id)
  with check (
    (select auth.uid())::text = user_id
    and exists (
      select 1 from public.meal_records parent
      where parent.id = meal_record_id
        and parent.user_id = (select auth.uid())::text
    )
  );

drop policy if exists meal_record_item_nutrients_insert_own
  on public.meal_record_item_nutrients;
create policy meal_record_item_nutrients_insert_own
  on public.meal_record_item_nutrients for insert to authenticated
  with check (
    (select auth.uid())::text = user_id
    and exists (
      select 1 from public.meal_record_items parent
      where parent.id = meal_record_item_id
        and parent.meal_record_id = meal_record_id
        and parent.user_id = (select auth.uid())::text
    )
  );

-- Dev Control v1 ---------------------------------------------------------
create table if not exists public.projects (
  id uuid primary key,
  user_id text not null,
  name text not null,
  description text not null default '',
  repository text,
  branch text,
  github_repository_id text,
  github_owner text,
  github_repo text,
  status text not null check (status in ('PLANNED', 'ACTIVE', 'COMPLETED')),
  current_summary text not null default '',
  target_summary text not null default '',
  last_verified_commit text,
  last_verified_at timestamptz,
  created_at timestamptz not null default now(),
  is_backfilled boolean not null default false,
  backfilled_at timestamptz,
  backfill_reason text,
  updated_at timestamptz not null,
  deleted_at timestamptz,
  device_id text not null,
  constraint projects_user_id_id_key unique (user_id, id),
  constraint projects_github_identity_complete check (
    (github_repository_id is null and github_owner is null and github_repo is null)
    or
    (github_repository_id is not null and github_owner is not null and github_repo is not null)
  ),
  constraint projects_device_fk foreign key (user_id, device_id)
    references public.devices(user_id, id)
);

create table if not exists public.project_milestones (
  id uuid primary key,
  user_id text not null,
  project_id uuid not null,
  title text not null,
  status text not null check (status in ('PLANNED', 'IN_PROGRESS', 'COMPLETED')),
  created_at timestamptz not null default now(),
  is_backfilled boolean not null default false,
  backfilled_at timestamptz,
  backfill_reason text,
  updated_at timestamptz not null,
  deleted_at timestamptz,
  device_id text not null,
  constraint project_milestones_project_fk foreign key (user_id, project_id)
    references public.projects(user_id, id),
  constraint project_milestones_device_fk foreign key (user_id, device_id)
    references public.devices(user_id, id)
);

create table if not exists public.project_actions (
  id uuid primary key,
  user_id text not null,
  project_id uuid not null,
  title text not null,
  type text not null check (type in ('NEXT', 'LATER', 'BLOCKED')),
  status text not null check (status in ('OPEN', 'DONE')),
  created_at timestamptz not null default now(),
  is_backfilled boolean not null default false,
  backfilled_at timestamptz,
  backfill_reason text,
  updated_at timestamptz not null,
  deleted_at timestamptz,
  device_id text not null,
  constraint project_actions_project_fk foreign key (user_id, project_id)
    references public.projects(user_id, id),
  constraint project_actions_device_fk foreign key (user_id, device_id)
    references public.devices(user_id, id)
);

create table if not exists public.project_ideas (
  id uuid primary key,
  user_id text not null,
  project_id uuid not null,
  title text not null,
  created_at timestamptz not null default now(),
  is_backfilled boolean not null default false,
  backfilled_at timestamptz,
  backfill_reason text,
  updated_at timestamptz not null,
  deleted_at timestamptz,
  device_id text not null,
  constraint project_ideas_project_fk foreign key (user_id, project_id)
    references public.projects(user_id, id),
  constraint project_ideas_device_fk foreign key (user_id, device_id)
    references public.devices(user_id, id)
);

create table if not exists public.project_history (
  id uuid primary key,
  user_id text not null,
  project_id uuid not null,
  type text not null check (type in ('STATUS_CHANGE', 'MILESTONE', 'RELEASE', 'NOTE')),
  summary text not null,
  occurred_at timestamptz not null,
  github_ref text,
  created_at timestamptz not null default now(),
  is_backfilled boolean not null default false,
  backfilled_at timestamptz,
  backfill_reason text,
  updated_at timestamptz not null,
  deleted_at timestamptz,
  device_id text not null,
  constraint project_history_project_fk foreign key (user_id, project_id)
    references public.projects(user_id, id),
  constraint project_history_device_fk foreign key (user_id, device_id)
    references public.devices(user_id, id)
);

create index if not exists projects_user_updated_at_idx on public.projects(user_id, updated_at desc);
create index if not exists projects_user_deleted_at_idx on public.projects(user_id, deleted_at);
create index if not exists projects_user_github_repository_id_idx
  on public.projects(user_id, github_repository_id)
  where github_repository_id is not null;
create index if not exists project_milestones_user_project_updated_at_idx on public.project_milestones(user_id, project_id, updated_at desc);
create index if not exists project_actions_user_project_updated_at_idx on public.project_actions(user_id, project_id, updated_at desc);
create index if not exists project_ideas_user_project_updated_at_idx on public.project_ideas(user_id, project_id, updated_at desc);
create index if not exists project_history_user_project_occurred_at_idx on public.project_history(user_id, project_id, occurred_at desc);
create index if not exists project_history_user_updated_at_idx on public.project_history(user_id, updated_at desc);

do $$
declare table_name text;
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    foreach table_name in array array['projects', 'project_milestones', 'project_actions', 'project_ideas', 'project_history'] loop
      if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = table_name) then
        execute format('alter publication supabase_realtime add table public.%I', table_name);
      end if;
    end loop;
  end if;
end $$;

create or replace function public.prevent_stale_sync_write()
returns trigger language plpgsql as $$
begin
  if TG_OP = 'UPDATE' then
    if NEW.updated_at < OLD.updated_at then return null; end if;
    if NEW.updated_at = OLD.updated_at then
      if OLD.deleted_at is null and NEW.deleted_at is not null then return NEW; end if;
      return null;
    end if;
  end if;
  return NEW;
end;
$$;
revoke all on function public.prevent_stale_sync_write() from public, anon, authenticated;

do $$
declare table_name text;
begin
  foreach table_name in array array[
    'notes', 'tasks', 'projects', 'project_milestones',
    'project_actions', 'project_ideas', 'project_history'
  ] loop
    execute format('drop trigger if exists %I on public.%I', table_name || '_lww_guard', table_name);
    execute format('create trigger %I before insert or update on public.%I for each row execute function public.prevent_stale_sync_write()', table_name || '_lww_guard', table_name);
  end loop;
end $$;

do $$
declare table_name text;
begin
  foreach table_name in array['projects', 'project_milestones', 'project_actions', 'project_ideas', 'project_history'] loop
    execute format('alter table public.%I enable row level security', table_name);
    execute format('revoke all on table public.%I from anon', table_name);
    execute format('grant select, insert, update on table public.%I to authenticated', table_name);
    execute format('drop policy if exists %I on public.%I', table_name || '_select_own', table_name);
    execute format('drop policy if exists %I on public.%I', table_name || '_insert_own', table_name);
    execute format('drop policy if exists %I on public.%I', table_name || '_update_own', table_name);
    execute format('create policy %I on public.%I for select to authenticated using ((select auth.uid())::text = user_id)', table_name || '_select_own', table_name);
    execute format('create policy %I on public.%I for insert to authenticated with check ((select auth.uid())::text = user_id)', table_name || '_insert_own', table_name);
    execute format('create policy %I on public.%I for update to authenticated using ((select auth.uid())::text = user_id) with check ((select auth.uid())::text = user_id)', table_name || '_update_own', table_name);
  end loop;
end $$;

drop policy if exists meal_record_item_nutrients_update_own
  on public.meal_record_item_nutrients;
create policy meal_record_item_nutrients_update_own
  on public.meal_record_item_nutrients for update to authenticated
  using ((select auth.uid())::text = user_id)
  with check (
    (select auth.uid())::text = user_id
    and exists (
      select 1 from public.meal_record_items parent
      where parent.id = meal_record_item_id
        and parent.meal_record_id = meal_record_id
        and parent.user_id = (select auth.uid())::text
    )
  );

-- Workstreams --------------------------------------------------------------
create table if not exists public.workstreams (
  id uuid primary key,
  user_id text not null,
  name text not null,
  status text not null check (status in ('PLANNED', 'ACTIVE', 'COMPLETED')),
  created_at timestamptz not null default now(),
  is_backfilled boolean not null default false,
  backfilled_at timestamptz,
  backfill_reason text,
  updated_at timestamptz not null,
  deleted_at timestamptz,
  device_id text not null,
  constraint workstreams_user_id_id_key unique (user_id, id),
  constraint workstreams_device_fk foreign key (user_id, device_id)
    references public.devices(user_id, id)
);

create table if not exists public.workstream_projects (
  id text primary key,
  user_id text not null,
  workstream_id uuid not null,
  project_id uuid not null,
  created_at timestamptz not null default now(),
  is_backfilled boolean not null default false,
  backfilled_at timestamptz,
  backfill_reason text,
  updated_at timestamptz not null,
  deleted_at timestamptz,
  device_id text not null,
  constraint workstream_projects_unique unique (user_id, workstream_id, project_id),
  constraint workstream_projects_workstream_fk foreign key (user_id, workstream_id)
    references public.workstreams(user_id, id),
  constraint workstream_projects_project_fk foreign key (user_id, project_id)
    references public.projects(user_id, id),
  constraint workstream_projects_device_fk foreign key (user_id, device_id)
    references public.devices(user_id, id)
);

create table if not exists public.workstream_milestones (
  id uuid primary key,
  user_id text not null,
  workstream_id uuid not null,
  title text not null,
  status text not null check (status in ('PLANNED', 'IN_PROGRESS', 'COMPLETED')),
  created_at timestamptz not null default now(),
  is_backfilled boolean not null default false,
  backfilled_at timestamptz,
  backfill_reason text,
  updated_at timestamptz not null,
  deleted_at timestamptz,
  device_id text not null,
  constraint workstream_milestones_workstream_fk foreign key (user_id, workstream_id)
    references public.workstreams(user_id, id),
  constraint workstream_milestones_device_fk foreign key (user_id, device_id)
    references public.devices(user_id, id)
);

create table if not exists public.workstream_actions (
  id uuid primary key,
  user_id text not null,
  workstream_id uuid not null,
  title text not null,
  type text not null check (type in ('NEXT', 'LATER', 'BLOCKED')),
  status text not null check (status in ('OPEN', 'DONE')),
  created_at timestamptz not null default now(),
  is_backfilled boolean not null default false,
  backfilled_at timestamptz,
  backfill_reason text,
  updated_at timestamptz not null,
  deleted_at timestamptz,
  device_id text not null,
  constraint workstream_actions_user_id_id_key unique (user_id, id),
  constraint workstream_actions_workstream_fk foreign key (user_id, workstream_id)
    references public.workstreams(user_id, id),
  constraint workstream_actions_device_fk foreign key (user_id, device_id)
    references public.devices(user_id, id)
);

create table if not exists public.workstream_action_projects (
  id text primary key,
  user_id text not null,
  action_id uuid not null,
  project_id uuid not null,
  created_at timestamptz not null default now(),
  is_backfilled boolean not null default false,
  backfilled_at timestamptz,
  backfill_reason text,
  updated_at timestamptz not null,
  deleted_at timestamptz,
  device_id text not null,
  constraint workstream_action_projects_unique unique (user_id, action_id, project_id),
  constraint workstream_action_projects_action_fk foreign key (user_id, action_id)
    references public.workstream_actions(user_id, id),
  constraint workstream_action_projects_project_fk foreign key (user_id, project_id)
    references public.projects(user_id, id),
  constraint workstream_action_projects_device_fk foreign key (user_id, device_id)
    references public.devices(user_id, id)
);

create table if not exists public.workstream_action_dependencies (
  id text primary key,
  user_id text not null,
  action_id uuid not null,
  depends_on_action_id uuid not null,
  created_at timestamptz not null default now(),
  is_backfilled boolean not null default false,
  backfilled_at timestamptz,
  backfill_reason text,
  updated_at timestamptz not null,
  deleted_at timestamptz,
  device_id text not null,
  constraint workstream_action_dependencies_unique unique (user_id, action_id, depends_on_action_id),
  constraint workstream_action_dependencies_not_self check (action_id <> depends_on_action_id),
  constraint workstream_action_dependencies_action_fk foreign key (user_id, action_id)
    references public.workstream_actions(user_id, id),
  constraint workstream_action_dependencies_prerequisite_fk
    foreign key (user_id, depends_on_action_id)
    references public.workstream_actions(user_id, id),
  constraint workstream_action_dependencies_device_fk foreign key (user_id, device_id)
    references public.devices(user_id, id)
);

create index if not exists workstreams_user_updated_at_idx
  on public.workstreams(user_id, updated_at desc);
create index if not exists workstreams_user_deleted_at_idx
  on public.workstreams(user_id, deleted_at);
create index if not exists workstream_projects_user_workstream_idx
  on public.workstream_projects(user_id, workstream_id, updated_at desc);
create index if not exists workstream_projects_user_project_idx
  on public.workstream_projects(user_id, project_id, updated_at desc);
create index if not exists workstream_milestones_user_workstream_idx
  on public.workstream_milestones(user_id, workstream_id, updated_at desc);
create index if not exists workstream_actions_user_workstream_idx
  on public.workstream_actions(user_id, workstream_id, updated_at desc);
create index if not exists workstream_action_projects_user_action_idx
  on public.workstream_action_projects(user_id, action_id, updated_at desc);
create index if not exists workstream_action_dependencies_user_action_idx
  on public.workstream_action_dependencies(user_id, action_id, updated_at desc);

create or replace function public.prevent_workstream_action_dependency_cycle()
returns trigger language plpgsql as $$
begin
  if NEW.deleted_at is not null then return NEW; end if;
  if not exists (
    select 1
    from public.workstream_actions action_row
    join public.workstream_actions prerequisite_row
      on prerequisite_row.user_id = action_row.user_id
     and prerequisite_row.workstream_id = action_row.workstream_id
    where action_row.user_id = NEW.user_id
      and action_row.id = NEW.action_id
      and prerequisite_row.id = NEW.depends_on_action_id
  ) then
    raise exception 'Workstream action dependency must stay within one Workstream';
  end if;
  if exists (
    with recursive dependency_chain(action_id) as (
      select NEW.depends_on_action_id
      union
      select dependency.depends_on_action_id
      from public.workstream_action_dependencies dependency
      join dependency_chain chain on dependency.action_id = chain.action_id
      where dependency.user_id = NEW.user_id
        and dependency.deleted_at is null
        and dependency.id <> NEW.id
    )
    select 1 from dependency_chain where action_id = NEW.action_id
  ) then
    raise exception 'Workstream action dependency cycle is not allowed';
  end if;
  return NEW;
end;
$$;
revoke all on function public.prevent_workstream_action_dependency_cycle()
  from public, anon, authenticated;
drop trigger if exists workstream_action_dependencies_cycle_guard
  on public.workstream_action_dependencies;
create trigger workstream_action_dependencies_cycle_guard
before insert or update on public.workstream_action_dependencies
for each row execute function public.prevent_workstream_action_dependency_cycle();

create or replace function public.validate_workstream_action_project()
returns trigger language plpgsql as $$
begin
  if NEW.deleted_at is not null then return NEW; end if;
  if not exists (
    select 1
    from public.workstream_actions action_row
    join public.workstream_projects participation
      on participation.user_id = action_row.user_id
     and participation.workstream_id = action_row.workstream_id
     and participation.project_id = NEW.project_id
     and participation.deleted_at is null
    where action_row.user_id = NEW.user_id
      and action_row.id = NEW.action_id
  ) then
    raise exception 'Workstream action Project must participate in the Workstream';
  end if;
  return NEW;
end;
$$;
revoke all on function public.validate_workstream_action_project()
  from public, anon, authenticated;
drop trigger if exists workstream_action_projects_membership_guard
  on public.workstream_action_projects;
create trigger workstream_action_projects_membership_guard
before insert or update on public.workstream_action_projects
for each row execute function public.validate_workstream_action_project();

do $$
declare table_name text;
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    foreach table_name in array array[
      'workstreams', 'workstream_projects', 'workstream_milestones',
      'workstream_actions', 'workstream_action_projects',
      'workstream_action_dependencies'
    ] loop
      if not exists (
        select 1 from pg_publication_tables
        where pubname = 'supabase_realtime'
          and schemaname = 'public'
          and tablename = table_name
      ) then
        execute format('alter publication supabase_realtime add table public.%I', table_name);
      end if;
    end loop;
  end if;
end $$;

do $$
declare table_name text;
begin
  foreach table_name in array array[
    'workstreams', 'workstream_projects', 'workstream_milestones',
    'workstream_actions', 'workstream_action_projects',
    'workstream_action_dependencies'
  ] loop
    execute format('drop trigger if exists %I on public.%I', table_name || '_lww_guard', table_name);
    execute format(
      'create trigger %I before insert or update on public.%I
       for each row execute function public.prevent_stale_sync_write()',
      table_name || '_lww_guard', table_name
    );
  end loop;
end $$;

do $$
declare table_name text;
begin
  foreach table_name in array array[
    'workstreams', 'workstream_projects', 'workstream_milestones',
    'workstream_actions', 'workstream_action_projects',
    'workstream_action_dependencies'
  ] loop
    execute format('alter table public.%I enable row level security', table_name);
    execute format('revoke all on table public.%I from anon', table_name);
    execute format('grant select, insert, update on table public.%I to authenticated', table_name);
    execute format('drop policy if exists %I on public.%I', table_name || '_select_own', table_name);
    execute format('drop policy if exists %I on public.%I', table_name || '_insert_own', table_name);
    execute format('drop policy if exists %I on public.%I', table_name || '_update_own', table_name);
    execute format('create policy %I on public.%I for select to authenticated using ((select auth.uid())::text = user_id)', table_name || '_select_own', table_name);
    execute format('create policy %I on public.%I for insert to authenticated with check ((select auth.uid())::text = user_id)', table_name || '_insert_own', table_name);
    execute format('create policy %I on public.%I for update to authenticated using ((select auth.uid())::text = user_id) with check ((select auth.uid())::text = user_id)', table_name || '_update_own', table_name);
  end loop;
end $$;

comment on table public.workstreams is
  'Cross-project feature/release work units; Projects remain separate entities.';

-- Knowledge Vault registry -------------------------------------------------
create table if not exists public.knowledge_documents (
  id uuid primary key,
  user_id text not null,
  title text not null,
  type text not null check (type in ('IDEA', 'PLAN', 'DESIGN', 'RESEARCH', 'NOTE')),
  project_id uuid,
  workstream_id uuid,
  relative_path text not null,
  created_at timestamptz not null default now(),
  is_backfilled boolean not null default false,
  backfilled_at timestamptz,
  backfill_reason text,
  updated_at timestamptz not null,
  deleted_at timestamptz,
  device_id text not null,
  constraint knowledge_documents_owner_exclusive check (
    not (project_id is not null and workstream_id is not null)
  ),
  constraint knowledge_documents_project_fk foreign key (user_id, project_id)
    references public.projects(user_id, id),
  constraint knowledge_documents_workstream_fk foreign key (user_id, workstream_id)
    references public.workstreams(user_id, id),
  constraint knowledge_documents_device_fk foreign key (user_id, device_id)
    references public.devices(user_id, id)
);

create index if not exists knowledge_documents_user_updated_at_idx
  on public.knowledge_documents(user_id, updated_at desc);
create index if not exists knowledge_documents_user_project_idx
  on public.knowledge_documents(user_id, project_id, updated_at desc)
  where project_id is not null;
create index if not exists knowledge_documents_user_workstream_idx
  on public.knowledge_documents(user_id, workstream_id, updated_at desc)
  where workstream_id is not null;

do $$
declare table_name text;
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = 'knowledge_documents'
    ) then
      alter publication supabase_realtime add table public.knowledge_documents;
    end if;
  end if;
end $$;

drop trigger if exists knowledge_documents_lww_guard
  on public.knowledge_documents;
create trigger knowledge_documents_lww_guard
before insert or update on public.knowledge_documents
for each row execute function public.prevent_stale_sync_write();

alter table public.knowledge_documents enable row level security;
revoke all on table public.knowledge_documents from anon;
grant select, insert, update on table public.knowledge_documents to authenticated;
drop policy if exists knowledge_documents_select_own on public.knowledge_documents;
drop policy if exists knowledge_documents_insert_own on public.knowledge_documents;
drop policy if exists knowledge_documents_update_own on public.knowledge_documents;
create policy knowledge_documents_select_own on public.knowledge_documents
  for select to authenticated
  using ((select auth.uid())::text = user_id);
create policy knowledge_documents_insert_own on public.knowledge_documents
  for insert to authenticated
  with check ((select auth.uid())::text = user_id);
create policy knowledge_documents_update_own on public.knowledge_documents
  for update to authenticated
  using ((select auth.uid())::text = user_id)
  with check ((select auth.uid())::text = user_id);

comment on table public.knowledge_documents is
  'Syncable Markdown registry metadata; document bodies remain in the configured local Vault.';

-- Task planning workflow v1 bootstrap. Fresh databases only; use forward migrations for existing data.
alter table public.tasks
  add column if not exists kind text not null default 'TASK',
  add column if not exists window_start_date date,
  add column if not exists window_start_time time,
  add column if not exists event_start_date date,
  add column if not exists event_start_time time,
  add column if not exists event_end_date date,
  add column if not exists event_end_time time,
  add column if not exists time_zone text not null default 'Asia/Seoul',
  add column if not exists registration_state text not null default 'CONFIRMED',
  add column if not exists origin text not null default 'MANUAL',
  add column if not exists source_type text not null default 'USER_STATEMENT',
  add column if not exists verification_status text not null default 'USER_PROVIDED',
  add column if not exists source_url text,
  add column if not exists source_label text,
  add column if not exists source_excerpt text,
  add column if not exists source_reference_date date,
  add column if not exists source_reference_time_zone text,
  add column if not exists source_reported_checked_at timestamptz,
  add column if not exists source_checked_at timestamptz,
  add column if not exists source_checked_by text,
  add column if not exists source_namespace text,
  add column if not exists external_key text;

create unique index if not exists tasks_action_identity_v1
  on public.tasks(user_id,source_namespace,external_key);
alter table public.tasks
  add constraint tasks_action_kind_v1 check (kind in ('TASK','APPLICATION','REGISTRATION','DEADLINE','EXAM','EVENT','RENEWAL')),
  add constraint tasks_action_state_v1 check (registration_state in ('CANDIDATE','CONFIRMED') and (registration_state <> 'CANDIDATE' or not is_done)),
  add constraint tasks_action_origin_v1 check (origin in ('MANUAL','CHATGPT','IMPORT')),
  add constraint tasks_action_source_v1 check (source_type in ('USER_STATEMENT','EXTERNAL_NOTICE')
    and verification_status in ('UNVERIFIED','USER_PROVIDED','SOURCE_CHECKED')
    and (verification_status <> 'USER_PROVIDED' or source_type='USER_STATEMENT')
    and (verification_status <> 'SOURCE_CHECKED' or
      (source_type='EXTERNAL_NOTICE' and source_url is not null and source_checked_at is not null and source_checked_by is not null))),
  add constraint tasks_action_identity_pair_v1 check ((source_namespace is null)=(external_key is null)
    and (source_namespace is null or source_namespace ~ '^[a-z0-9][a-z0-9._-]{0,79}$')
    and (external_key is null or (length(external_key) between 1 and 256 and btrim(external_key)=external_key))),
  add constraint tasks_action_source_url_v1 check (source_url is null or (source_url ~ '^https?://' and length(source_url)<=2048)),
  add constraint tasks_action_reference_v1 check ((source_reference_date is null)=(source_reference_time_zone is null)),
  add constraint tasks_action_dates_v1 check (
    (due_time is null or due_date is not null)
    and (window_start_time is null or window_start_date is not null)
    and (event_start_time is null or event_start_date is not null)
    and (event_end_time is null or event_end_date is not null)
    and (event_end_date is null or event_start_date is not null)
    and (window_start_date is null or due_date is null or window_start_date<due_date
      or (window_start_date=due_date and (window_start_time is null or due_time is null or window_start_time<=due_time)))
    and (event_end_date is null or event_start_date<event_end_date
      or (event_start_date=event_end_date and (event_start_time is null or event_end_time is null or event_start_time<=event_end_time)))),
  add constraint tasks_action_combination_v1 check (
    (kind in ('EXAM','EVENT') and due_date is null and window_start_date is null)
    or (kind in ('APPLICATION','REGISTRATION') and event_start_date is null and event_end_date is null)
    or (kind in ('TASK','DEADLINE','RENEWAL') and window_start_date is null and event_start_date is null and event_end_date is null));

create or replace function public.guard_task_action_v1()
returns trigger language plpgsql security invoker set search_path = '' as $guard$
begin
  if not exists (select 1 from pg_catalog.pg_timezone_names where name=NEW.time_zone) or
     (NEW.source_reference_time_zone is not null and not exists
       (select 1 from pg_catalog.pg_timezone_names where name=NEW.source_reference_time_zone)) then
    raise exception 'Invalid action time zone';
  end if;
  if TG_OP='UPDATE' then
    if OLD.user_id is distinct from NEW.user_id or OLD.id is distinct from NEW.id then
      raise exception 'Task identity and owner are immutable';
    end if;
    if OLD.source_namespace is not null and
      (OLD.source_namespace,OLD.external_key) is distinct from (NEW.source_namespace,NEW.external_key) then
      raise exception 'External action identity is immutable';
    end if;
    if OLD.origin in ('IMPORT','CHATGPT') and NEW.origin='MANUAL' then
      raise exception 'An older client cannot downgrade an imported action';
    end if;
    if OLD.verification_status='SOURCE_CHECKED' and
      (OLD.text,OLD.kind,OLD.due_date,OLD.due_time,OLD.window_start_date,OLD.window_start_time,
       OLD.event_start_date,OLD.event_start_time,OLD.event_end_date,OLD.event_end_time,OLD.time_zone,
       OLD.source_url,OLD.source_label,OLD.source_excerpt,OLD.source_reference_date,OLD.source_reference_time_zone)
      is distinct from
      (NEW.text,NEW.kind,NEW.due_date,NEW.due_time,NEW.window_start_date,NEW.window_start_time,
       NEW.event_start_date,NEW.event_start_time,NEW.event_end_date,NEW.event_end_time,NEW.time_zone,
       NEW.source_url,NEW.source_label,NEW.source_excerpt,NEW.source_reference_date,NEW.source_reference_time_zone)
      and NEW.source_checked_at is not distinct from OLD.source_checked_at then
      NEW.verification_status := 'UNVERIFIED';
      NEW.source_checked_at := null; NEW.source_checked_by := null;
    end if;
  end if;
  if NEW.verification_status='SOURCE_CHECKED' and
    (auth.uid() is null or NEW.source_checked_by is distinct from auth.uid()::text) then
    raise exception 'Source confirmation must belong to the authenticated user';
  end if;
  return NEW;
end;
$guard$;
revoke all on function public.guard_task_action_v1() from public,anon;
create trigger tasks_action_guard_v1 before insert or update on public.tasks
  for each row execute function public.guard_task_action_v1();

alter table public.tasks enable row level security;
revoke all on public.tasks from anon;
revoke delete,truncate,references,trigger on public.tasks from authenticated;
grant select,insert,update on public.tasks to authenticated;
create policy tasks_select_own_action_v1 on public.tasks for select to authenticated
  using (user_id=(select auth.uid())::text);
create policy tasks_insert_own_action_v1 on public.tasks for insert to authenticated
  with check (user_id=(select auth.uid())::text);
create policy tasks_update_own_action_v1 on public.tasks for update to authenticated
  using (user_id=(select auth.uid())::text) with check (user_id=(select auth.uid())::text);


create or replace function public.guard_task_ownership_revision_v1()
returns trigger language plpgsql security invoker set search_path = '' as $guard$
begin
  if OLD.user_id is distinct from NEW.user_id and
     (to_jsonb(OLD) - 'user_id') is distinct from (to_jsonb(NEW) - 'user_id') then
    raise exception 'Ownership metadata must preserve content revision and fields';
  end if;
  return NEW;
end;
$guard$;
revoke all on function public.guard_task_ownership_revision_v1() from public,anon,authenticated;

-- AFTER UPDATE also checks privileged maintenance that temporarily disables
-- only the existing LWW/owner guards. Ordinary clients still cannot change owner.
create trigger tasks_ownership_revision_guard_v1 after update on public.tasks
  for each row execute function public.guard_task_ownership_revision_v1();

-- Additive workflow data. Never infer a historical completion/skip timestamp.
begin;
set local lock_timeout = '5s';
set local statement_timeout = '30s';

alter table public.tasks
  add column if not exists completed_at timestamptz,
  add column if not exists skipped_at timestamptz,
  add column if not exists description text not null default '',
  add column if not exists category text,
  add column if not exists checklist jsonb not null default '[]'::jsonb,
  add column if not exists recurrence jsonb,
  add column if not exists recurrence_series_id uuid,
  add column if not exists recurrence_occurrence integer,
  add column if not exists project_action_id uuid;

create or replace function public.valid_task_checklist_v1(value jsonb)
returns boolean language plpgsql immutable strict security invoker set search_path = '' as $$
declare item jsonb; ids text[] := '{}';
begin
  if jsonb_typeof(value) <> 'array' then return false; end if;
  for item in select * from jsonb_array_elements(value) loop
    if jsonb_typeof(item) <> 'object' or
       jsonb_typeof(item->'id') is distinct from 'string' or btrim(item->>'id') = '' or
       jsonb_typeof(item->'text') is distinct from 'string' or btrim(item->>'text') = '' or
       jsonb_typeof(item->'isDone') is distinct from 'boolean' or (item->>'id') = any(ids) then
      return false;
    end if;
    ids := array_append(ids,item->>'id');
  end loop;
  return true;
end;
$$;

create or replace function public.valid_task_recurrence_v1(value jsonb)
returns boolean language plpgsql immutable strict security invoker set search_path = '' as $$
declare step numeric; anchor date;
begin
  if jsonb_typeof(value) <> 'object' or
     jsonb_typeof(value->'frequency') is distinct from 'string' or
     value->>'frequency' not in ('DAILY','WEEKLY','MONTHLY') or
     jsonb_typeof(value->'interval') is distinct from 'number' or
     jsonb_typeof(value->'anchorDate') is distinct from 'string' or
     value->>'anchorDate' !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' then return false; end if;
  step := (value->>'interval')::numeric;
  if step <> trunc(step) or step < 1 or step > 365 then return false; end if;
  anchor := (value->>'anchorDate')::date;
  return to_char(anchor,'YYYY-MM-DD') = value->>'anchorDate';
exception when others then return false;
end;
$$;
revoke all on function public.valid_task_checklist_v1(jsonb),public.valid_task_recurrence_v1(jsonb) from public,anon;
grant execute on function public.valid_task_checklist_v1(jsonb),public.valid_task_recurrence_v1(jsonb) to authenticated;

alter table public.tasks
  add constraint tasks_checklist_shape_v1 check (public.valid_task_checklist_v1(checklist)),
  add constraint tasks_recurrence_shape_v1 check (recurrence is null or public.valid_task_recurrence_v1(recurrence)),
  add constraint tasks_completion_state_v1 check (
    (completed_at is null or is_done) and
    (skipped_at is null or (not is_done and completed_at is null))),
  add constraint tasks_recurrence_identity_v1 check (
    (recurrence_series_id is null) = (recurrence_occurrence is null) and
    (recurrence_occurrence is null or recurrence_occurrence >= 0));

-- Include tombstones: retrying a deleted occurrence must not create a duplicate.
create unique index if not exists tasks_recurrence_occurrence_v1
  on public.tasks(user_id,recurrence_series_id,recurrence_occurrence)
  where recurrence_series_id is not null;
create unique index if not exists project_actions_user_id_id_v1
  on public.project_actions(user_id,id);
alter table public.tasks add constraint tasks_project_action_owner_v1
  foreign key (user_id,project_action_id) references public.project_actions(user_id,id);

-- Older clients only send is_done. Preserve unknown details on their partial
-- upserts, but clear an incompatible completion/skip state when they toggle it.
-- Completion time remains unknown rather than borrowing updated_at.
create or replace function public.guard_task_planning_v1()
returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  if TG_OP='UPDATE' and OLD.is_done is distinct from NEW.is_done then
    if not NEW.is_done and NEW.completed_at is not distinct from OLD.completed_at then
      NEW.completed_at := null;
    end if;
    if NEW.is_done and NEW.skipped_at is not distinct from OLD.skipped_at then
      NEW.skipped_at := null;
    end if;
  end if;
  return NEW;
end;
$$;
revoke all on function public.guard_task_planning_v1() from public,anon,authenticated;
create trigger tasks_planning_guard_v1 before update on public.tasks
  for each row execute function public.guard_task_planning_v1();

-- ensure_action_v1 is replaced below with the existing identity/owner guards
-- and an explicit insert list containing every workflow field.

create or replace function public.ensure_action_v1(action jsonb)
returns setof public.tasks language plpgsql security invoker set search_path = '' as $ensure$
declare proposal public.tasks%rowtype; owner_id text := auth.uid()::text;
begin
  if owner_id is null then raise exception 'Authentication required'; end if;
  if jsonb_typeof(action) <> 'object' or action->>'user_id' is distinct from owner_id then
    raise exception 'Action owner does not match authenticated user';
  end if;
  proposal := jsonb_populate_record(null::public.tasks,action);
  if not (action ? 'description') then proposal.description := ''; end if;
  if not (action ? 'checklist') then proposal.checklist := '[]'::jsonb; end if;
  if proposal.source_namespace is null or proposal.external_key is null then
    raise exception 'External identity required';
  end if;
  insert into public.tasks(id,user_id,text,is_done,order_index,due_date,due_time,planned_date,updated_at,deleted_at,device_id,created_at,is_backfilled,backfilled_at,backfill_reason,kind,window_start_date,window_start_time,event_start_date,event_start_time,event_end_date,event_end_time,time_zone,registration_state,origin,source_type,verification_status,source_url,source_label,source_excerpt,source_reference_date,source_reference_time_zone,source_reported_checked_at,source_checked_at,source_checked_by,source_namespace,external_key,completed_at,skipped_at,description,category,checklist,recurrence,recurrence_series_id,recurrence_occurrence,project_action_id)
    values (proposal.id,proposal.user_id,proposal.text,proposal.is_done,proposal.order_index,proposal.due_date,proposal.due_time,proposal.planned_date,proposal.updated_at,proposal.deleted_at,proposal.device_id,proposal.created_at,proposal.is_backfilled,proposal.backfilled_at,proposal.backfill_reason,proposal.kind,proposal.window_start_date,proposal.window_start_time,proposal.event_start_date,proposal.event_start_time,proposal.event_end_date,proposal.event_end_time,proposal.time_zone,proposal.registration_state,proposal.origin,proposal.source_type,proposal.verification_status,proposal.source_url,proposal.source_label,proposal.source_excerpt,proposal.source_reference_date,proposal.source_reference_time_zone,proposal.source_reported_checked_at,proposal.source_checked_at,proposal.source_checked_by,proposal.source_namespace,proposal.external_key,proposal.completed_at,proposal.skipped_at,proposal.description,proposal.category,proposal.checklist,proposal.recurrence,proposal.recurrence_series_id,proposal.recurrence_occurrence,proposal.project_action_id)
    on conflict do nothing;
  return query select t.* from public.tasks t
    where t.user_id=owner_id and t.source_namespace=proposal.source_namespace and t.external_key=proposal.external_key;
  if not found then raise exception 'Action identity conflict'; end if;
end;
$ensure$;
revoke all on function public.ensure_action_v1(jsonb) from public,anon;
grant execute on function public.ensure_action_v1(jsonb) to authenticated;

notify pgrst, 'reload schema';
commit;
