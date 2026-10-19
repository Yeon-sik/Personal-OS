-- Repair the legacy configured account left behind by the Task account migration.
-- Only the known Personal OS config owner is eligible; never infer another owner.
begin;
set local lock_timeout = '5s';
set local statement_timeout = '30s';
lock table public.notes in access exclusive mode;
lock table auth.users in share mode;

do $repair$
begin
  if not exists (select 1 from public.notes where user_id = 'yeonsik-main') then
    return;
  end if;
  if (select count(*) from auth.users) <> 1 then
    raise exception 'Legacy notes require exactly one verified login account';
  end if;
  if not exists (
    select 1 from public.tasks t join auth.users u on t.user_id = u.id::text
  ) then
    raise exception 'Complete the authorized Task account migration before repairing notes';
  end if;
  if not exists (
    select 1 from pg_catalog.pg_trigger
    where tgrelid = 'public.notes'::regclass and tgname = 'notes_lww_guard'
      and tgenabled = 'O' and tgfoid = 'public.prevent_stale_sync_write()'::regprocedure
  ) then
    raise exception 'Unexpected notes LWW guard; inspect before repairing ownership';
  end if;

  -- Ownership is metadata, not a content edit. Keep updated_at so a newer offline
  -- edit still wins. The exclusive lock prevents concurrent unguarded writes;
  -- rollback restores the guard too if any statement fails.
  alter table public.notes disable trigger notes_lww_guard;
  insert into public.devices(user_id, id, name, last_seen_at, app_version)
  select distinct u.id::text, d.id, d.name, d.last_seen_at, d.app_version
  from public.devices d
  join public.notes n on (n.user_id, n.device_id) = (d.user_id, d.id)
  cross join auth.users u
  where n.user_id = 'yeonsik-main'
  on conflict(user_id, id) do nothing;

  update public.notes n set user_id = u.id::text
  from auth.users u where n.user_id = 'yeonsik-main';
  alter table public.notes enable trigger notes_lww_guard;
end;
$repair$;
commit;
