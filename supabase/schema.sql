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
