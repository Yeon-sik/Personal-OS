-- Schema-only fixture captured from the production catalog 2026-10-20.
-- No user rows or credentials. Exercises the real Fitness batch RPC, FKs and triggers.
create table public.devices(
  id text not null,
  user_id text not null,
  name text not null,
  last_seen_at timestamp with time zone not null,
  app_version text,
  sync_changed_at timestamp with time zone not null default clock_timestamp()
);

create table public.notes(
  id uuid not null,
  user_id text not null,
  title text not null,
  content text not null,
  updated_at timestamp with time zone not null,
  deleted_at timestamp with time zone,
  device_id text not null,
  created_at timestamp with time zone not null default now(),
  is_backfilled boolean not null default false,
  backfilled_at timestamp with time zone,
  backfill_reason text
);

create table public.workout_records(
  id uuid not null,
  user_id text not null,
  date date not null,
  workout_type text not null,
  category text not null,
  exercise_name text not null,
  updated_at timestamp with time zone not null,
  deleted_at timestamp with time zone,
  device_id text not null,
  created_at timestamp with time zone not null default now(),
  is_backfilled boolean not null default false,
  backfilled_at timestamp with time zone,
  backfill_reason text,
  duration_seconds integer,
  average_heart_rate double precision,
  source_app text not null default 'os'::text,
  scope text not null default 'both'::text,
  metadata jsonb not null default '{}'::jsonb,
  sync_changed_at timestamp with time zone not null default clock_timestamp()
);

create table public.workout_exercises(
  id uuid not null,
  user_id text not null,
  record_id uuid not null,
  order_index integer not null,
  exercise_id text not null,
  exercise_name_snapshot text not null,
  ui_part text not null,
  primary_sub_part_snapshot text,
  equipment_snapshot text,
  record_type text not null,
  memo text,
  device_id text not null,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null,
  deleted_at timestamp with time zone,
  sync_changed_at timestamp with time zone not null default clock_timestamp()
);

create table public.workout_sets(
  id uuid not null,
  user_id text not null,
  workout_exercise_id uuid not null,
  set_index integer not null,
  target_reps integer,
  actual_reps integer,
  weight_kg double precision,
  duration_seconds integer,
  distance_meters double precision,
  rest_seconds integer,
  assisted_weight_kg double precision,
  added_weight_kg double precision,
  is_completed boolean not null default false,
  rpe integer,
  memo text,
  device_id text not null,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null,
  deleted_at timestamp with time zone,
  sync_changed_at timestamp with time zone not null default clock_timestamp()
);

create table public.meal_records(
  id uuid not null,
  user_id text not null,
  date date not null,
  menu text not null,
  calories integer not null,
  protein_grams double precision not null,
  carbs_grams double precision,
  fat_grams double precision,
  updated_at timestamp with time zone not null,
  deleted_at timestamp with time zone,
  device_id text not null,
  created_at timestamp with time zone not null default now(),
  is_backfilled boolean not null default false,
  backfilled_at timestamp with time zone,
  backfill_reason text,
  source_app text not null default 'os'::text,
  scope text not null default 'both'::text,
  metadata jsonb not null default '{}'::jsonb,
  meal_kind text,
  store_name text,
  branch_name text,
  menu_name text,
  restaurant_id text,
  restaurant_location_id text,
  restaurant_menu_id text,
  catalog_product_id text,
  sync_changed_at timestamp with time zone not null default clock_timestamp()
);

create table public.weight_records(
  id uuid not null,
  user_id text not null,
  date date not null,
  weight_kg double precision not null,
  updated_at timestamp with time zone not null,
  deleted_at timestamp with time zone,
  device_id text not null,
  created_at timestamp with time zone not null default now(),
  is_backfilled boolean not null default false,
  backfilled_at timestamp with time zone,
  backfill_reason text,
  source_app text not null default 'os'::text,
  scope text not null default 'both'::text,
  metadata jsonb not null default '{}'::jsonb,
  sync_changed_at timestamp with time zone not null default clock_timestamp()
);
alter table public.devices add PRIMARY KEY (user_id, id);
alter table public.notes add PRIMARY KEY (id);
alter table public.notes add FOREIGN KEY (user_id, device_id) REFERENCES devices(user_id, id);
alter table public.workout_records add CHECK ((workout_type = ANY (ARRAY['strength'::text, 'cardio'::text, 'other'::text])));
alter table public.workout_records add PRIMARY KEY (id);
alter table public.workout_records add FOREIGN KEY (user_id, device_id) REFERENCES devices(user_id, id);
alter table public.workout_records add CHECK ((source_app = ANY (ARRAY['os'::text, 'fitness'::text])));
alter table public.workout_records add CHECK ((scope = ANY (ARRAY['os'::text, 'fitness'::text, 'both'::text])));
alter table public.workout_exercises add PRIMARY KEY (id);
alter table public.workout_exercises add FOREIGN KEY (record_id) REFERENCES workout_records(id);
alter table public.workout_exercises add FOREIGN KEY (user_id, device_id) REFERENCES devices(user_id, id);
alter table public.workout_sets add PRIMARY KEY (id);
alter table public.workout_sets add FOREIGN KEY (workout_exercise_id) REFERENCES workout_exercises(id);
alter table public.workout_sets add FOREIGN KEY (user_id, device_id) REFERENCES devices(user_id, id);
alter table public.meal_records add PRIMARY KEY (id);
alter table public.meal_records add FOREIGN KEY (user_id, device_id) REFERENCES devices(user_id, id);
alter table public.meal_records add CHECK ((source_app = ANY (ARRAY['os'::text, 'fitness'::text])));
alter table public.meal_records add CHECK ((scope = ANY (ARRAY['os'::text, 'fitness'::text, 'both'::text])));
alter table public.weight_records add PRIMARY KEY (id);
alter table public.weight_records add FOREIGN KEY (user_id, device_id) REFERENCES devices(user_id, id);
alter table public.weight_records add CHECK ((source_app = ANY (ARRAY['os'::text, 'fitness'::text])));
alter table public.weight_records add CHECK ((scope = ANY (ARRAY['os'::text, 'fitness'::text, 'both'::text])));

CREATE OR REPLACE FUNCTION public.set_fitness_sync_changed_at_v1()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
begin
  new.sync_changed_at := clock_timestamp();
  return new;
end;
$function$
;
CREATE OR REPLACE FUNCTION public.prevent_stale_sync_write()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
begin
  if TG_OP = 'UPDATE' then
    if NEW.updated_at < OLD.updated_at then
      return null;
    end if;
    if NEW.updated_at = OLD.updated_at then
      if OLD.deleted_at is null and NEW.deleted_at is not null then
        return NEW;
      end if;
      return null;
    end if;
  end if;
  return NEW;
end;
$function$
;
CREATE TRIGGER devices_set_sync_changed_at_v1 BEFORE INSERT OR UPDATE ON public.devices FOR EACH ROW EXECUTE FUNCTION set_fitness_sync_changed_at_v1();
CREATE TRIGGER workout_records_set_sync_changed_at_v1 BEFORE INSERT OR UPDATE ON public.workout_records FOR EACH ROW EXECUTE FUNCTION set_fitness_sync_changed_at_v1();
CREATE TRIGGER workout_exercises_set_sync_changed_at_v1 BEFORE INSERT OR UPDATE ON public.workout_exercises FOR EACH ROW EXECUTE FUNCTION set_fitness_sync_changed_at_v1();
CREATE TRIGGER workout_sets_set_sync_changed_at_v1 BEFORE INSERT OR UPDATE ON public.workout_sets FOR EACH ROW EXECUTE FUNCTION set_fitness_sync_changed_at_v1();
CREATE TRIGGER meal_records_set_sync_changed_at_v1 BEFORE INSERT OR UPDATE ON public.meal_records FOR EACH ROW EXECUTE FUNCTION set_fitness_sync_changed_at_v1();
CREATE TRIGGER weight_records_set_sync_changed_at_v1 BEFORE INSERT OR UPDATE ON public.weight_records FOR EACH ROW EXECUTE FUNCTION set_fitness_sync_changed_at_v1();
CREATE TRIGGER notes_lww_guard BEFORE INSERT OR UPDATE ON public.notes FOR EACH ROW EXECUTE FUNCTION prevent_stale_sync_write();
CREATE OR REPLACE FUNCTION public.sync_fitness_data_v1(p_changes jsonb DEFAULT '{}'::jsonb, p_cursors jsonb DEFAULT '{}'::jsonb, p_limit integer DEFAULT 500)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO ''
 SET statement_timeout TO '20s'
AS $function$
declare
  v_user_id text := (select auth.uid())::text;
  v_limit integer := greatest(1, least(coalesce(p_limit, 500), 500));
  v_table text;
  v_count integer;
  v_pushed jsonb := '{}'::jsonb;
  v_rows jsonb := '{}'::jsonb;
  v_echo_rows jsonb := '{}'::jsonb;
  v_next_cursors jsonb := '{}'::jsonb;
  v_has_more jsonb := '{}'::jsonb;
  v_table_rows jsonb;
  v_table_echo_rows jsonb;
  v_cursor_version timestamptz;
  v_cursor_id text;
  v_more boolean;
  v_last_row jsonb;
begin
  if v_user_id is null then
    raise exception using errcode = '42501', message = 'Authentication required';
  end if;

  if jsonb_typeof(coalesce(p_changes, '{}'::jsonb)) <> 'object'
     or jsonb_typeof(coalesce(p_cursors, '{}'::jsonb)) <> 'object' then
    raise exception using errcode = '22023', message = 'p_changes and p_cursors must be JSON objects';
  end if;

  foreach v_table in array array[
    'devices',
    'workout_records',
    'workout_exercises',
    'workout_sets',
    'meal_records',
    'weight_records'
  ]
  loop
    if jsonb_typeof(coalesce(p_changes -> v_table, '[]'::jsonb)) <> 'array' then
      raise exception using errcode = '22023', message = v_table || ' changes must be a JSON array';
    end if;
    if jsonb_array_length(coalesce(p_changes -> v_table, '[]'::jsonb)) > v_limit then
      raise exception using errcode = '22023', message = v_table || ' batch exceeds p_limit';
    end if;
    if exists (
      select 1
      from jsonb_array_elements(coalesce(p_changes -> v_table, '[]'::jsonb)) as item
      where item ->> 'user_id' is distinct from v_user_id
    ) then
      raise exception using errcode = '42501', message = 'Payload ownership mismatch for ' || v_table;
    end if;
  end loop;

  insert into public.devices as current_row (
    id, user_id, name, last_seen_at, app_version
  )
  select
    incoming.id, incoming.user_id, incoming.name,
    incoming.last_seen_at, incoming.app_version
  from jsonb_populate_recordset(
    null::public.devices,
    coalesce(p_changes -> 'devices', '[]'::jsonb)
  ) as incoming
  on conflict (user_id, id) do update
  set name = excluded.name,
      last_seen_at = excluded.last_seen_at,
      app_version = excluded.app_version
  where excluded.last_seen_at > current_row.last_seen_at;
  get diagnostics v_count = row_count;
  v_pushed := v_pushed || jsonb_build_object('devices', v_count);

  insert into public.workout_records as current_row (
    id, user_id, date, workout_type, category, exercise_name,
    duration_seconds, average_heart_rate, created_at, is_backfilled,
    backfilled_at, backfill_reason, updated_at, deleted_at, device_id,
    source_app, scope, metadata
  )
  select
    incoming.id, incoming.user_id, incoming.date, incoming.workout_type,
    incoming.category, incoming.exercise_name, incoming.duration_seconds,
    incoming.average_heart_rate, incoming.created_at, incoming.is_backfilled,
    incoming.backfilled_at, incoming.backfill_reason, incoming.updated_at,
    incoming.deleted_at, incoming.device_id, incoming.source_app,
    incoming.scope, incoming.metadata
  from jsonb_populate_recordset(
    null::public.workout_records,
    coalesce(p_changes -> 'workout_records', '[]'::jsonb)
  ) as incoming
  on conflict (id) do update
  set date = excluded.date,
      workout_type = excluded.workout_type,
      category = excluded.category,
      exercise_name = excluded.exercise_name,
      duration_seconds = excluded.duration_seconds,
      average_heart_rate = excluded.average_heart_rate,
      created_at = excluded.created_at,
      is_backfilled = excluded.is_backfilled,
      backfilled_at = excluded.backfilled_at,
      backfill_reason = excluded.backfill_reason,
      updated_at = excluded.updated_at,
      deleted_at = excluded.deleted_at,
      device_id = excluded.device_id,
      source_app = excluded.source_app,
      scope = excluded.scope,
      metadata = excluded.metadata
  where current_row.user_id = v_user_id
    and excluded.updated_at > current_row.updated_at;
  get diagnostics v_count = row_count;
  v_pushed := v_pushed || jsonb_build_object('workout_records', v_count);

  insert into public.workout_exercises as current_row (
    id, user_id, record_id, order_index, exercise_id,
    exercise_name_snapshot, ui_part, primary_sub_part_snapshot,
    equipment_snapshot, record_type, memo, device_id, created_at,
    updated_at, deleted_at
  )
  select
    incoming.id, incoming.user_id, incoming.record_id, incoming.order_index,
    incoming.exercise_id, incoming.exercise_name_snapshot, incoming.ui_part,
    incoming.primary_sub_part_snapshot, incoming.equipment_snapshot,
    incoming.record_type, incoming.memo, incoming.device_id,
    incoming.created_at, incoming.updated_at, incoming.deleted_at
  from jsonb_populate_recordset(
    null::public.workout_exercises,
    coalesce(p_changes -> 'workout_exercises', '[]'::jsonb)
  ) as incoming
  on conflict (id) do update
  set record_id = excluded.record_id,
      order_index = excluded.order_index,
      exercise_id = excluded.exercise_id,
      exercise_name_snapshot = excluded.exercise_name_snapshot,
      ui_part = excluded.ui_part,
      primary_sub_part_snapshot = excluded.primary_sub_part_snapshot,
      equipment_snapshot = excluded.equipment_snapshot,
      record_type = excluded.record_type,
      memo = excluded.memo,
      device_id = excluded.device_id,
      created_at = excluded.created_at,
      updated_at = excluded.updated_at,
      deleted_at = excluded.deleted_at
  where current_row.user_id = v_user_id
    and excluded.updated_at > current_row.updated_at;
  get diagnostics v_count = row_count;
  v_pushed := v_pushed || jsonb_build_object('workout_exercises', v_count);

  insert into public.workout_sets as current_row (
    id, user_id, workout_exercise_id, set_index, target_reps,
    actual_reps, weight_kg, duration_seconds, distance_meters,
    rest_seconds, assisted_weight_kg, added_weight_kg, is_completed,
    rpe, memo, device_id, created_at, updated_at, deleted_at
  )
  select
    incoming.id, incoming.user_id, incoming.workout_exercise_id,
    incoming.set_index, incoming.target_reps, incoming.actual_reps,
    incoming.weight_kg, incoming.duration_seconds, incoming.distance_meters,
    incoming.rest_seconds, incoming.assisted_weight_kg,
    incoming.added_weight_kg, incoming.is_completed, incoming.rpe,
    incoming.memo, incoming.device_id, incoming.created_at,
    incoming.updated_at, incoming.deleted_at
  from jsonb_populate_recordset(
    null::public.workout_sets,
    coalesce(p_changes -> 'workout_sets', '[]'::jsonb)
  ) as incoming
  on conflict (id) do update
  set workout_exercise_id = excluded.workout_exercise_id,
      set_index = excluded.set_index,
      target_reps = excluded.target_reps,
      actual_reps = excluded.actual_reps,
      weight_kg = excluded.weight_kg,
      duration_seconds = excluded.duration_seconds,
      distance_meters = excluded.distance_meters,
      rest_seconds = excluded.rest_seconds,
      assisted_weight_kg = excluded.assisted_weight_kg,
      added_weight_kg = excluded.added_weight_kg,
      is_completed = excluded.is_completed,
      rpe = excluded.rpe,
      memo = excluded.memo,
      device_id = excluded.device_id,
      created_at = excluded.created_at,
      updated_at = excluded.updated_at,
      deleted_at = excluded.deleted_at
  where current_row.user_id = v_user_id
    and excluded.updated_at > current_row.updated_at;
  get diagnostics v_count = row_count;
  v_pushed := v_pushed || jsonb_build_object('workout_sets', v_count);

  insert into public.meal_records as current_row (
    id, user_id, date, menu, calories, protein_grams, carbs_grams,
    fat_grams, created_at, is_backfilled, backfilled_at,
    backfill_reason, updated_at, deleted_at, device_id, source_app,
    scope, metadata
  )
  select
    incoming.id, incoming.user_id, incoming.date, incoming.menu,
    incoming.calories, incoming.protein_grams, incoming.carbs_grams,
    incoming.fat_grams, incoming.created_at, incoming.is_backfilled,
    incoming.backfilled_at, incoming.backfill_reason, incoming.updated_at,
    incoming.deleted_at, incoming.device_id, incoming.source_app,
    incoming.scope, incoming.metadata
  from jsonb_populate_recordset(
    null::public.meal_records,
    coalesce(p_changes -> 'meal_records', '[]'::jsonb)
  ) as incoming
  on conflict (id) do update
  set date = excluded.date,
      menu = excluded.menu,
      calories = excluded.calories,
      protein_grams = excluded.protein_grams,
      carbs_grams = excluded.carbs_grams,
      fat_grams = excluded.fat_grams,
      created_at = excluded.created_at,
      is_backfilled = excluded.is_backfilled,
      backfilled_at = excluded.backfilled_at,
      backfill_reason = excluded.backfill_reason,
      updated_at = excluded.updated_at,
      deleted_at = excluded.deleted_at,
      device_id = excluded.device_id,
      source_app = excluded.source_app,
      scope = excluded.scope,
      metadata = excluded.metadata
  where current_row.user_id = v_user_id
    and excluded.updated_at > current_row.updated_at;
  get diagnostics v_count = row_count;
  v_pushed := v_pushed || jsonb_build_object('meal_records', v_count);

  insert into public.weight_records as current_row (
    id, user_id, date, weight_kg, created_at, is_backfilled,
    backfilled_at, backfill_reason, updated_at, deleted_at, device_id,
    source_app, scope, metadata
  )
  select
    incoming.id, incoming.user_id, incoming.date, incoming.weight_kg,
    incoming.created_at, incoming.is_backfilled, incoming.backfilled_at,
    incoming.backfill_reason, incoming.updated_at, incoming.deleted_at,
    incoming.device_id, incoming.source_app, incoming.scope,
    incoming.metadata
  from jsonb_populate_recordset(
    null::public.weight_records,
    coalesce(p_changes -> 'weight_records', '[]'::jsonb)
  ) as incoming
  on conflict (id) do update
  set date = excluded.date,
      weight_kg = excluded.weight_kg,
      created_at = excluded.created_at,
      is_backfilled = excluded.is_backfilled,
      backfilled_at = excluded.backfilled_at,
      backfill_reason = excluded.backfill_reason,
      updated_at = excluded.updated_at,
      deleted_at = excluded.deleted_at,
      device_id = excluded.device_id,
      source_app = excluded.source_app,
      scope = excluded.scope,
      metadata = excluded.metadata
  where current_row.user_id = v_user_id
    and excluded.updated_at > current_row.updated_at;
  get diagnostics v_count = row_count;
  v_pushed := v_pushed || jsonb_build_object('weight_records', v_count);

  foreach v_table in array array[
    'devices',
    'workout_records',
    'workout_exercises',
    'workout_sets',
    'meal_records',
    'weight_records'
  ]
  loop
    v_cursor_version := nullif(p_cursors #>> array[v_table, 'version'], '')::timestamptz;
    v_cursor_id := coalesce(p_cursors #>> array[v_table, 'id'], '');

    execute format(
      'select coalesce(jsonb_agg(to_jsonb(page) order by page.sync_changed_at, page.id::text), ''[]''::jsonb) '
      || 'from (select * from public.%I '
      || 'where user_id = $1 and ($2 is null or sync_changed_at > $2 '
      || 'or (sync_changed_at = $2 and id::text > $3)) '
      || 'order by sync_changed_at, id::text limit $4) as page',
      v_table
    ) into v_table_rows using v_user_id, v_cursor_version, v_cursor_id, v_limit + 1;

    v_more := jsonb_array_length(v_table_rows) > v_limit;
    if v_more then
      select coalesce(jsonb_agg(item.value order by item.ordinality), '[]'::jsonb)
      into v_table_rows
      from jsonb_array_elements(v_table_rows) with ordinality as item(value, ordinality)
      where item.ordinality <= v_limit;
    end if;

    if jsonb_array_length(v_table_rows) > 0 then
      v_last_row := v_table_rows -> (jsonb_array_length(v_table_rows) - 1);
      v_next_cursors := v_next_cursors || jsonb_build_object(
        v_table,
        jsonb_build_object(
          'version', v_last_row ->> 'sync_changed_at',
          'id', v_last_row ->> 'id'
        )
      );
    else
      v_next_cursors := v_next_cursors || jsonb_build_object(
        v_table,
        coalesce(
          p_cursors -> v_table,
          jsonb_build_object('version', null, 'id', '')
        )
      );
    end if;

    execute format(
      'select coalesce(jsonb_agg(to_jsonb(current_row) order by current_row.id::text), ''[]''::jsonb) '
      || 'from public.%I as current_row '
      || 'where current_row.user_id = $1 and current_row.id::text in ('
      || 'select item ->> ''id'' from jsonb_array_elements($2) as item)',
      v_table
    ) into v_table_echo_rows
    using v_user_id, coalesce(p_changes -> v_table, '[]'::jsonb);

    v_rows := v_rows || jsonb_build_object(v_table, v_table_rows);
    v_echo_rows := v_echo_rows || jsonb_build_object(v_table, v_table_echo_rows);
    v_has_more := v_has_more || jsonb_build_object(v_table, v_more);
  end loop;

  return jsonb_build_object(
    'contract_version', 1,
    'pushed', v_pushed,
    'rows', v_rows,
    'echo_rows', v_echo_rows,
    'next_cursors', v_next_cursors,
    'has_more', v_has_more,
    'server_time', clock_timestamp()
  );
end;
$function$
;
revoke all on function public.sync_fitness_data_v1(jsonb,jsonb,integer) from public,anon;
grant execute on function public.sync_fitness_data_v1(jsonb,jsonb,integer) to authenticated;
