-- Action Calendar v1.1. Additive schema; existing Task IDs and tombstones survive.
-- The user authorized assigning the single legacy Task owner to the sole login account.
begin;
lock table public.tasks in share row exclusive mode;

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

do $adopt$
declare target_owner text; legacy_owners integer;
begin
  select count(distinct t.user_id) into legacy_owners from public.tasks t
    where not exists (select 1 from auth.users u where u.id::text=t.user_id);
  if legacy_owners > 0 then
    if legacy_owners <> 1 or (select count(*) from auth.users) <> 1 then
      raise exception 'Ambiguous legacy ownership: explicit account mapping is required';
    end if;
    select id::text into target_owner from auth.users;
    insert into public.devices(user_id,id,name,last_seen_at,app_version)
      select distinct target_owner,d.id,d.name,d.last_seen_at,d.app_version
      from public.devices d join public.tasks t on (d.user_id,d.id)=(t.user_id,t.device_id)
      where not exists (select 1 from auth.users u where u.id::text=t.user_id)
      on conflict(user_id,id) do nothing;
    update public.tasks t set user_id=target_owner,
      updated_at=greatest(clock_timestamp(),t.updated_at+interval '1 microsecond')
      where not exists (select 1 from auth.users u where u.id::text=t.user_id);
  end if;
end;
$adopt$;

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

create or replace function public.ensure_action_v1(action jsonb)
returns setof public.tasks language plpgsql security invoker set search_path = '' as $ensure$
declare proposal public.tasks%rowtype; owner_id text := auth.uid()::text;
begin
  if owner_id is null then raise exception 'Authentication required'; end if;
  if jsonb_typeof(action) <> 'object' or action->>'user_id' is distinct from owner_id then
    raise exception 'Action owner does not match authenticated user';
  end if;
  proposal := jsonb_populate_record(null::public.tasks,action);
  if proposal.source_namespace is null or proposal.external_key is null then
    raise exception 'External identity required';
  end if;
  insert into public.tasks(id,user_id,text,is_done,order_index,due_date,due_time,planned_date,updated_at,deleted_at,device_id,created_at,is_backfilled,backfilled_at,backfill_reason,kind,window_start_date,window_start_time,event_start_date,event_start_time,event_end_date,event_end_time,time_zone,registration_state,origin,source_type,verification_status,source_url,source_label,source_excerpt,source_reference_date,source_reference_time_zone,source_reported_checked_at,source_checked_at,source_checked_by,source_namespace,external_key)
    values (proposal.id,proposal.user_id,proposal.text,proposal.is_done,proposal.order_index,proposal.due_date,proposal.due_time,proposal.planned_date,proposal.updated_at,proposal.deleted_at,proposal.device_id,proposal.created_at,proposal.is_backfilled,proposal.backfilled_at,proposal.backfill_reason,proposal.kind,proposal.window_start_date,proposal.window_start_time,proposal.event_start_date,proposal.event_start_time,proposal.event_end_date,proposal.event_end_time,proposal.time_zone,proposal.registration_state,proposal.origin,proposal.source_type,proposal.verification_status,proposal.source_url,proposal.source_label,proposal.source_excerpt,proposal.source_reference_date,proposal.source_reference_time_zone,proposal.source_reported_checked_at,proposal.source_checked_at,proposal.source_checked_by,proposal.source_namespace,proposal.external_key)
    on conflict do nothing;
  return query select t.* from public.tasks t
    where t.user_id=owner_id and t.source_namespace=proposal.source_namespace and t.external_key=proposal.external_key;
  if not found then raise exception 'Action identity conflict'; end if;
end;
$ensure$;
revoke all on function public.ensure_action_v1(jsonb) from public,anon;
grant execute on function public.ensure_action_v1(jsonb) to authenticated;

-- Keep the existing realtime publication and incremental trigger, when present.
do $publication$
begin
  if exists (select 1 from pg_publication where pubname='supabase_realtime') and not exists
    (select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='tasks') then
    alter publication supabase_realtime add table public.tasks;
  end if;
end;
$publication$;
notify pgrst, 'reload schema';
commit;
