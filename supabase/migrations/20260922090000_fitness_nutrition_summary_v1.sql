begin;

-- FitnessApp publishes these shared parents via its existing sync contract.
-- Aggregate at the owner boundary: Personal OS never downloads meal records.
create index if not exists meal_records_fitness_nutrition_projection_idx
  on public.meal_records (user_id, date)
  where source_app = 'fitness'
    and scope in ('fitness', 'both')
    and deleted_at is null;

create or replace view public.fitness_nutrition_summary_v1
with (security_invoker = true, security_barrier = true) as
select
  date::text as id,
  user_id,
  date,
  1::integer as contract_version,
  count(*)::integer as meal_count,
  case when count(calories) = count(*) then sum(calories) end as calories,
  case when count(carbs_grams) = count(*) then sum(carbs_grams) end as carbs_grams,
  case when count(protein_grams) = count(*) then sum(protein_grams) end as protein_grams,
  case when count(fat_grams) = count(*) then sum(fat_grams) end as fat_grams,
  max(updated_at) as updated_at
from public.meal_records
where user_id = (select auth.uid())::text
  and source_app = 'fitness'
  and scope in ('fitness', 'both')
  and deleted_at is null
group by user_id, date;

revoke all on public.fitness_nutrition_summary_v1 from public, anon, authenticated;
grant select on public.fitness_nutrition_summary_v1 to authenticated;
comment on view public.fitness_nutrition_summary_v1 is
  'Fitness-owned daily nutrition v1. Unknown nutrients remain null; no meal detail. Full refresh replaces the OS read cache, including removed dates. Commands belong to Fitness, never this view.';

commit;
