-- Workstreams are a separate cross-project planning boundary. Existing
-- Project milestones/actions/history are intentionally not copied or linked
-- as new Workstream rows.

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
  constraint workstreams_device_fk
    foreign key (user_id, device_id)
    references public.devices(user_id, id)
);

-- Relation ids are deterministic text keys so concurrent devices converge on
-- one logical link while the link still participates in audit/tombstone LWW.
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
  constraint workstream_projects_unique
    unique (user_id, workstream_id, project_id),
  constraint workstream_projects_workstream_fk
    foreign key (user_id, workstream_id)
    references public.workstreams(user_id, id),
  constraint workstream_projects_project_fk
    foreign key (user_id, project_id)
    references public.projects(user_id, id),
  constraint workstream_projects_device_fk
    foreign key (user_id, device_id)
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
  constraint workstream_milestones_workstream_fk
    foreign key (user_id, workstream_id)
    references public.workstreams(user_id, id),
  constraint workstream_milestones_device_fk
    foreign key (user_id, device_id)
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
  constraint workstream_actions_workstream_fk
    foreign key (user_id, workstream_id)
    references public.workstreams(user_id, id),
  constraint workstream_actions_device_fk
    foreign key (user_id, device_id)
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
  constraint workstream_action_projects_unique
    unique (user_id, action_id, project_id),
  constraint workstream_action_projects_action_fk
    foreign key (user_id, action_id)
    references public.workstream_actions(user_id, id),
  constraint workstream_action_projects_project_fk
    foreign key (user_id, project_id)
    references public.projects(user_id, id),
  constraint workstream_action_projects_device_fk
    foreign key (user_id, device_id)
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
  constraint workstream_action_dependencies_unique
    unique (user_id, action_id, depends_on_action_id),
  constraint workstream_action_dependencies_not_self
    check (action_id <> depends_on_action_id),
  constraint workstream_action_dependencies_action_fk
    foreign key (user_id, action_id)
    references public.workstream_actions(user_id, id),
  constraint workstream_action_dependencies_prerequisite_fk
    foreign key (user_id, depends_on_action_id)
    references public.workstream_actions(user_id, id),
  constraint workstream_action_dependencies_device_fk
    foreign key (user_id, device_id)
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

-- Reject cross-workstream dependencies and cycles at the database boundary,
-- including writes that do not originate in this desktop client.
create or replace function public.prevent_workstream_action_dependency_cycle()
returns trigger
language plpgsql
as $$
begin
  if NEW.deleted_at is not null then
    return NEW;
  end if;

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
      join dependency_chain chain
        on dependency.action_id = chain.action_id
      where dependency.user_id = NEW.user_id
        and dependency.deleted_at is null
        and dependency.id <> NEW.id
    )
    select 1
    from dependency_chain
    where action_id = NEW.action_id
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
for each row
execute function public.prevent_workstream_action_dependency_cycle();

-- An action's explicit Project impact must be one of the Workstream's
-- participating Projects. Zero active links remains the common Workstream
-- action case.
create or replace function public.validate_workstream_action_project()
returns trigger
language plpgsql
as $$
begin
  if NEW.deleted_at is not null then
    return NEW;
  end if;

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
for each row
execute function public.validate_workstream_action_project();

do $$
declare
  table_name text;
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    foreach table_name in array array[
      'workstreams',
      'workstream_projects',
      'workstream_milestones',
      'workstream_actions',
      'workstream_action_projects',
      'workstream_action_dependencies'
    ]
    loop
      if not exists (
        select 1
        from pg_publication_tables
        where pubname = 'supabase_realtime'
          and schemaname = 'public'
          and tablename = table_name
      ) then
        execute format('alter publication supabase_realtime add table public.%I', table_name);
      end if;
    end loop;
  end if;
end;
$$;

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'workstreams',
    'workstream_projects',
    'workstream_milestones',
    'workstream_actions',
    'workstream_action_projects',
    'workstream_action_dependencies'
  ]
  loop
    execute format('drop trigger if exists %I on public.%I', table_name || '_lww_guard', table_name);
    execute format(
      'create trigger %I before insert or update on public.%I
       for each row execute function public.prevent_stale_sync_write()',
      table_name || '_lww_guard',
      table_name
    );
  end loop;
end;
$$;

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'workstreams',
    'workstream_projects',
    'workstream_milestones',
    'workstream_actions',
    'workstream_action_projects',
    'workstream_action_dependencies'
  ]
  loop
    execute format('alter table public.%I enable row level security', table_name);
    execute format('revoke all on table public.%I from anon', table_name);
    execute format('grant select, insert, update on table public.%I to authenticated', table_name);
    execute format('drop policy if exists %I on public.%I', table_name || '_select_own', table_name);
    execute format('drop policy if exists %I on public.%I', table_name || '_insert_own', table_name);
    execute format('drop policy if exists %I on public.%I', table_name || '_update_own', table_name);
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
  end loop;
end;
$$;

comment on table public.workstreams is
  'Cross-project feature/release work units; Projects remain separate entities.';
comment on table public.workstream_projects is
  'User-owned Workstream to Project participation links with tombstones.';
comment on table public.workstream_action_projects is
  'Optional explicit Project impact links; no active link means Workstream-wide action.';
