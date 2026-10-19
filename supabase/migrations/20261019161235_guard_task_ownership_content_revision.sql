-- Forward-only safety guard. No historical timestamps or contents are inferred.
-- Privileged ownership maintenance must leave all content/audit fields intact.
begin;
set local lock_timeout = '5s';
set local statement_timeout = '30s';

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
commit;
