-- Latest changed keys, not an append-only event log. Storage grows with rows
-- and nutrition dates, including the existing soft-delete tombstones.
-- Client updated_at remains the LWW clock; this cursor is independent of it.
create table public.personal_os_sync_state_v1 (
  user_id text primary key,
  epoch uuid not null default gen_random_uuid(),
  revision bigint not null default 0 check (revision >= 0)
);

create table public.personal_os_sync_changes_v1 (
  user_id text not null references public.personal_os_sync_state_v1(user_id),
  table_name text not null check (table_name in (
    'notes', 'tasks', 'projects', 'project_milestones', 'project_actions',
    'project_ideas', 'project_history', 'workstreams', 'workstream_projects',
    'workstream_milestones', 'workstream_actions', 'workstream_action_projects',
    'workstream_action_dependencies', 'knowledge_documents',
    'fitness_summary_projections_v2', 'workout_records', 'weight_records',
    'fitness_nutrition_summary_v1'
  )),
  row_id text not null,
  revision bigint not null check (revision > 0),
  primary key (user_id, table_name, row_id),
  unique (user_id, revision)
);

alter table public.personal_os_sync_state_v1 enable row level security;
alter table public.personal_os_sync_changes_v1 enable row level security;
revoke all on public.personal_os_sync_state_v1, public.personal_os_sync_changes_v1
  from public, anon, authenticated;

create function public.touch_personal_os_sync_key_v1(p_user_id text, p_table text, p_id text)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
declare v_revision bigint;
begin
  insert into public.personal_os_sync_state_v1(user_id) values (p_user_id)
    on conflict (user_id) do nothing;
  -- This row lock lasts until COMMIT, so a committed watermark cannot skip an
  -- earlier uncommitted revision (a plain sequence/client timestamp can).
  update public.personal_os_sync_state_v1 set revision = revision + 1
    where user_id = p_user_id returning revision into v_revision;
  insert into public.personal_os_sync_changes_v1(user_id, table_name, row_id, revision)
    values (p_user_id, p_table, p_id, v_revision)
    on conflict (user_id, table_name, row_id) do update set revision = excluded.revision;
end;
$$;

create function public.track_personal_os_sync_change_v1()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
declare v_old_relevant boolean := false;
begin
  if TG_TABLE_NAME = 'meal_records' then
    -- Only date invalidations cross the Fitness nutrition boundary. No meal,
    -- item or nutrient detail is copied into the change feed.
    if TG_OP = 'UPDATE' then
      v_old_relevant := OLD.source_app = 'fitness' and OLD.scope in ('fitness', 'both');
      if v_old_relevant then
        perform public.touch_personal_os_sync_key_v1(OLD.user_id,
          'fitness_nutrition_summary_v1', OLD.date::text);
      end if;
    end if;
    if NEW.source_app = 'fitness' and NEW.scope in ('fitness', 'both') then
      if TG_OP = 'INSERT' then
        perform public.touch_personal_os_sync_key_v1(NEW.user_id,
          'fitness_nutrition_summary_v1', NEW.date::text);
      elsif not v_old_relevant or OLD.date <> NEW.date or OLD.user_id <> NEW.user_id then
        perform public.touch_personal_os_sync_key_v1(NEW.user_id,
          'fitness_nutrition_summary_v1', NEW.date::text);
      end if;
    end if;
  else
    perform public.touch_personal_os_sync_key_v1(NEW.user_id, TG_TABLE_NAME, NEW.id::text);
  end if;
  return NEW;
end;
$$;

-- AFTER triggers observe accepted writes only. Existing BEFORE LWW guards,
-- ownership/FKs, source producers and soft-delete contracts are unchanged.
do $$
declare v_table text;
begin
  foreach v_table in array array[
    'notes', 'tasks', 'projects', 'project_milestones', 'project_actions',
    'project_ideas', 'project_history', 'workstreams', 'workstream_projects',
    'workstream_milestones', 'workstream_actions', 'workstream_action_projects',
    'workstream_action_dependencies', 'knowledge_documents',
    'fitness_summary_projections_v2', 'workout_records', 'weight_records', 'meal_records'
  ] loop
    execute format('create trigger %I after insert or update on public.%I
      for each row execute function public.track_personal_os_sync_change_v1()',
      v_table || '_sync_change_v1', v_table);
  end loop;
end;
$$;

create function public.get_personal_os_sync_cursor_v1()
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare v_user text := (select auth.uid())::text; v_state public.personal_os_sync_state_v1;
begin
  if v_user is null then raise exception 'authenticated user is required' using errcode = '42501'; end if;
  insert into public.personal_os_sync_state_v1(user_id) values (v_user)
    on conflict (user_id) do nothing;
  select * into v_state from public.personal_os_sync_state_v1 where user_id = v_user;
  return jsonb_build_object('epoch', v_state.epoch::text, 'revision', v_state.revision::text);
end;
$$;

create function public.read_personal_os_sync_changes_v1(
  p_epoch uuid, p_after_revision bigint, p_until_revision bigint default null, p_limit integer default 500
)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_user text := (select auth.uid())::text;
  v_state public.personal_os_sync_state_v1;
  v_until bigint; v_next bigint := p_after_revision;
  v_rows jsonb := '[]'::jsonb;
  v_count integer := 0; v_more boolean := false; v_row record;
begin
  if v_user is null then raise exception 'authenticated user is required' using errcode = '42501'; end if;
  if p_limit is null or p_limit < 1 or p_limit > 500 then raise exception 'invalid page size'; end if;
  select * into v_state from public.personal_os_sync_state_v1 where user_id = v_user;
  v_until := coalesce(p_until_revision, v_state.revision);
  if v_state.user_id is null or p_epoch is null or p_epoch <> v_state.epoch or
    p_after_revision is null or p_after_revision < 0 or p_after_revision > v_state.revision or
    v_until < p_after_revision or v_until > v_state.revision then
    raise exception 'PERSONAL_OS_SYNC_CURSOR_RESET_REQUIRED';
  end if;
  for v_row in select table_name, row_id, revision from public.personal_os_sync_changes_v1
    where user_id = v_user and revision > p_after_revision and revision <= v_until
    order by revision limit (p_limit + 1)
  loop
    v_count := v_count + 1;
    if v_count > p_limit then v_more := true; exit; end if;
    v_next := v_row.revision;
    v_rows := v_rows || jsonb_build_array(jsonb_build_object(
      'table_name', v_row.table_name, 'id', v_row.row_id, 'revision', v_row.revision::text));
  end loop;
  if not v_more then v_next := v_until; end if;
  return jsonb_build_object('epoch', v_state.epoch::text, 'until_revision', v_until::text,
    'next_revision', v_next::text, 'has_more', v_more, 'changes', v_rows);
end;
$$;

revoke all on function public.touch_personal_os_sync_key_v1(text, text, text),
  public.track_personal_os_sync_change_v1(), public.get_personal_os_sync_cursor_v1(),
  public.read_personal_os_sync_changes_v1(uuid, bigint, bigint, integer) from public, anon, authenticated;
grant execute on function public.get_personal_os_sync_cursor_v1(),
  public.read_personal_os_sync_changes_v1(uuid, bigint, bigint, integer) to authenticated;
