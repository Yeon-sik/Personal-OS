-- Forward-only security hardening. No ownership or content rows are rewritten.
-- Version matches the production apply_migration receipt.
-- Producer contracts: Personal OS writes notes/devices; authenticated Fitness
-- writes devices and its workout/meal/weight rows. Both apps use Auth user.id.
-- source_app/scope describe projection provenance, not an authentication role.
-- Deletion is a tombstone update; neither producer requires remote hard DELETE.
set local lock_timeout = '5s';

-- notes.
alter table public.notes enable row level security;
revoke all on table public.notes from public, anon, authenticated;
grant select, insert, update on table public.notes to authenticated;
create policy notes_owner_select_v1 on public.notes
  for select to authenticated using (user_id = (select auth.uid())::text);
create policy notes_owner_insert_v1 on public.notes
  for insert to authenticated with check (user_id = (select auth.uid())::text);
create policy notes_owner_update_v1 on public.notes
  for update to authenticated using (user_id = (select auth.uid())::text)
  with check (user_id = (select auth.uid())::text);

-- devices uses (user_id,id); no device rows are deleted.
alter table public.devices enable row level security;
revoke all on table public.devices from public, anon, authenticated;
grant select, insert, update on table public.devices to authenticated;
create policy devices_owner_select_v1 on public.devices
  for select to authenticated using (user_id = (select auth.uid())::text);
create policy devices_owner_insert_v1 on public.devices
  for insert to authenticated with check (user_id = (select auth.uid())::text);
create policy devices_owner_update_v1 on public.devices
  for update to authenticated using (user_id = (select auth.uid())::text)
  with check (user_id = (select auth.uid())::text);

-- workout_records.
alter table public.workout_records enable row level security;
revoke all on table public.workout_records from public, anon, authenticated;
grant select, insert, update on table public.workout_records to authenticated;
create policy workout_records_owner_select_v1 on public.workout_records
  for select to authenticated using (user_id = (select auth.uid())::text);
create policy workout_records_owner_insert_v1 on public.workout_records
  for insert to authenticated with check (user_id = (select auth.uid())::text);
create policy workout_records_owner_update_v1 on public.workout_records
  for update to authenticated using (user_id = (select auth.uid())::text)
  with check (user_id = (select auth.uid())::text);

-- workout_exercises requires the same account throughout the parent chain.
alter table public.workout_exercises enable row level security;
revoke all on table public.workout_exercises from public, anon, authenticated;
grant select, insert, update on table public.workout_exercises to authenticated;
create policy workout_exercises_owner_select_v1 on public.workout_exercises
  for select to authenticated using (user_id = (select auth.uid())::text
    and exists (select 1 from public.workout_records parent
      where parent.id = workout_exercises.record_id and parent.user_id = (select auth.uid())::text));
create policy workout_exercises_owner_insert_v1 on public.workout_exercises
  for insert to authenticated with check (user_id = (select auth.uid())::text
    and exists (select 1 from public.workout_records parent
      where parent.id = workout_exercises.record_id and parent.user_id = (select auth.uid())::text));
create policy workout_exercises_owner_update_v1 on public.workout_exercises
  for update to authenticated using (user_id = (select auth.uid())::text
    and exists (select 1 from public.workout_records parent
      where parent.id = workout_exercises.record_id and parent.user_id = (select auth.uid())::text))
  with check (user_id = (select auth.uid())::text
    and exists (select 1 from public.workout_records parent
      where parent.id = workout_exercises.record_id and parent.user_id = (select auth.uid())::text));

-- workout_sets requires the same account throughout the parent chain.
alter table public.workout_sets enable row level security;
revoke all on table public.workout_sets from public, anon, authenticated;
grant select, insert, update on table public.workout_sets to authenticated;
create policy workout_sets_owner_select_v1 on public.workout_sets
  for select to authenticated using (user_id = (select auth.uid())::text
    and exists (select 1 from public.workout_exercises parent
      where parent.id = workout_sets.workout_exercise_id and parent.user_id = (select auth.uid())::text));
create policy workout_sets_owner_insert_v1 on public.workout_sets
  for insert to authenticated with check (user_id = (select auth.uid())::text
    and exists (select 1 from public.workout_exercises parent
      where parent.id = workout_sets.workout_exercise_id and parent.user_id = (select auth.uid())::text));
create policy workout_sets_owner_update_v1 on public.workout_sets
  for update to authenticated using (user_id = (select auth.uid())::text
    and exists (select 1 from public.workout_exercises parent
      where parent.id = workout_sets.workout_exercise_id and parent.user_id = (select auth.uid())::text))
  with check (user_id = (select auth.uid())::text
    and exists (select 1 from public.workout_exercises parent
      where parent.id = workout_sets.workout_exercise_id and parent.user_id = (select auth.uid())::text));

-- meal_records.
alter table public.meal_records enable row level security;
revoke all on table public.meal_records from public, anon, authenticated;
grant select, insert, update on table public.meal_records to authenticated;
create policy meal_records_owner_select_v1 on public.meal_records
  for select to authenticated using (user_id = (select auth.uid())::text);
create policy meal_records_owner_insert_v1 on public.meal_records
  for insert to authenticated with check (user_id = (select auth.uid())::text);
create policy meal_records_owner_update_v1 on public.meal_records
  for update to authenticated using (user_id = (select auth.uid())::text)
  with check (user_id = (select auth.uid())::text);

-- weight_records.
alter table public.weight_records enable row level security;
revoke all on table public.weight_records from public, anon, authenticated;
grant select, insert, update on table public.weight_records to authenticated;
create policy weight_records_owner_select_v1 on public.weight_records
  for select to authenticated using (user_id = (select auth.uid())::text);
create policy weight_records_owner_insert_v1 on public.weight_records
  for insert to authenticated with check (user_id = (select auth.uid())::text);
create policy weight_records_owner_update_v1 on public.weight_records
  for update to authenticated using (user_id = (select auth.uid())::text)
  with check (user_id = (select auth.uid())::text);
