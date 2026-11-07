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
