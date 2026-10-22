-- Run only after the RLS migration. All probe writes are rolled back.
-- Real DB roles + JWT subject claims, not an end-user Auth/JWT or device test.
-- Fail closed if the deployment has more than one real account: choose no owner by guess.
begin;
set local statement_timeout = '30s';
do $probe$
declare
  v_owner text;
  v_other text := gen_random_uuid()::text;
  v_a jsonb;
  v_b jsonb;
  v_payload jsonb;
  v_table text;
  v_row jsonb;
  v_columns text;
  v_count integer;
  v_denied boolean;
  v_statement text;
  v_result jsonb;
  v_identity text;
begin
  if (select count(*) from auth.users) <> 1 then raise exception 'Explicit QA account selection required'; end if;
  select id::text into strict v_owner from auth.users;
  v_a := replace($json${"devices":[{"user_id":"OWNER","id":"release-security-probe","name":"rollback-only release probe","last_seen_at":"2026-01-01T00:00:00Z","app_version":"qa"}],"notes":[{"user_id":"OWNER","device_id":"release-security-probe","created_at":"2026-01-01T00:00:00Z","updated_at":"2026-01-01T00:00:00Z","deleted_at":null,"is_backfilled":false,"id":"a0000000-0000-4000-8000-000000000001","title":"rollback-only probe","content":"qa"}],"workout_records":[{"user_id":"OWNER","device_id":"release-security-probe","created_at":"2026-01-01T00:00:00Z","updated_at":"2026-01-01T00:00:00Z","deleted_at":null,"is_backfilled":false,"source_app":"fitness","scope":"fitness","metadata":{},"id":"a0000000-0000-4000-8000-000000000002","date":"2026-01-01","workout_type":"strength","category":"qa","exercise_name":"qa"}],"workout_exercises":[{"user_id":"OWNER","device_id":"release-security-probe","created_at":"2026-01-01T00:00:00Z","updated_at":"2026-01-01T00:00:00Z","id":"a0000000-0000-4000-8000-000000000003","record_id":"a0000000-0000-4000-8000-000000000002","order_index":0,"exercise_id":"qa","exercise_name_snapshot":"qa","ui_part":"qa","record_type":"strength"}],"workout_sets":[{"user_id":"OWNER","device_id":"release-security-probe","created_at":"2026-01-01T00:00:00Z","updated_at":"2026-01-01T00:00:00Z","id":"a0000000-0000-4000-8000-000000000004","workout_exercise_id":"a0000000-0000-4000-8000-000000000003","set_index":0,"is_completed":false}],"meal_records":[{"user_id":"OWNER","device_id":"release-security-probe","created_at":"2026-01-01T00:00:00Z","updated_at":"2026-01-01T00:00:00Z","deleted_at":null,"is_backfilled":false,"source_app":"fitness","scope":"fitness","metadata":{},"id":"a0000000-0000-4000-8000-000000000005","date":"2026-01-01","menu":"qa","calories":1,"protein_grams":1}],"weight_records":[{"user_id":"OWNER","device_id":"release-security-probe","created_at":"2026-01-01T00:00:00Z","updated_at":"2026-01-01T00:00:00Z","deleted_at":null,"is_backfilled":false,"source_app":"fitness","scope":"fitness","metadata":{},"id":"a0000000-0000-4000-8000-000000000006","date":"2026-01-01","weight_kg":70}]}$json$, 'OWNER', v_owner)::jsonb;
  v_b := replace($json${"devices":[{"user_id":"OTHER","id":"release-security-probe","name":"rollback-only release probe","last_seen_at":"2026-01-01T00:00:00Z","app_version":"qa"}],"notes":[{"user_id":"OTHER","device_id":"release-security-probe","created_at":"2026-01-01T00:00:00Z","updated_at":"2026-01-01T00:00:00Z","deleted_at":null,"is_backfilled":false,"id":"b0000000-0000-4000-8000-000000000001","title":"rollback-only probe","content":"qa"}],"workout_records":[{"user_id":"OTHER","device_id":"release-security-probe","created_at":"2026-01-01T00:00:00Z","updated_at":"2026-01-01T00:00:00Z","deleted_at":null,"is_backfilled":false,"source_app":"fitness","scope":"fitness","metadata":{},"id":"b0000000-0000-4000-8000-000000000002","date":"2026-01-01","workout_type":"strength","category":"qa","exercise_name":"qa"}],"workout_exercises":[{"user_id":"OTHER","device_id":"release-security-probe","created_at":"2026-01-01T00:00:00Z","updated_at":"2026-01-01T00:00:00Z","id":"b0000000-0000-4000-8000-000000000003","record_id":"b0000000-0000-4000-8000-000000000002","order_index":0,"exercise_id":"qa","exercise_name_snapshot":"qa","ui_part":"qa","record_type":"strength"}],"workout_sets":[{"user_id":"OTHER","device_id":"release-security-probe","created_at":"2026-01-01T00:00:00Z","updated_at":"2026-01-01T00:00:00Z","id":"b0000000-0000-4000-8000-000000000004","workout_exercise_id":"b0000000-0000-4000-8000-000000000003","set_index":0,"is_completed":false}],"meal_records":[{"user_id":"OTHER","device_id":"release-security-probe","created_at":"2026-01-01T00:00:00Z","updated_at":"2026-01-01T00:00:00Z","deleted_at":null,"is_backfilled":false,"source_app":"fitness","scope":"fitness","metadata":{},"id":"b0000000-0000-4000-8000-000000000005","date":"2026-01-01","menu":"qa","calories":1,"protein_grams":1}],"weight_records":[{"user_id":"OTHER","device_id":"release-security-probe","created_at":"2026-01-01T00:00:00Z","updated_at":"2026-01-01T00:00:00Z","deleted_at":null,"is_backfilled":false,"source_app":"fitness","scope":"fitness","metadata":{},"id":"b0000000-0000-4000-8000-000000000006","date":"2026-01-01","weight_kg":70}]}$json$, 'OTHER', v_other)::jsonb;

  -- Production Fitness RPC inserts devices -> parent -> exercises -> sets -> meals/weights.
  foreach v_payload in array array[v_a,v_b] loop
    v_identity := v_payload->'devices'->0->>'user_id';
    perform set_config('request.jwt.claim.sub',v_identity,true);
    execute 'set local role authenticated';
    select public.sync_fitness_data_v1(v_payload - 'notes','{}',500) into v_result;
    if (v_result->'pushed'->>'workout_sets')::integer <> 1 then raise exception 'Fitness push failed'; end if;
    v_row := v_payload->'notes'->0;
    insert into public.notes(id,user_id,title,content,updated_at,device_id)
      values((v_row->>'id')::uuid,v_identity,'rollback-only probe','qa','2026-01-01','release-security-probe');
    execute 'reset role';
  end loop;

  perform set_config('request.jwt.claim.sub',v_owner,true);
  execute 'set local role authenticated';
  foreach v_table in array array['notes','devices','workout_records','workout_exercises','workout_sets','meal_records','weight_records'] loop
    execute format('select count(*) from public.%I where user_id <> $1',v_table) into v_count using v_owner;
    if v_count <> 0 then raise exception 'Cross-account SELECT leak: %',v_table; end if;
    execute format('update public.%I set user_id=$1 where user_id=$2',v_table) using v_owner,v_other;
    get diagnostics v_count = row_count;
    if v_count <> 0 then raise exception 'Cross-account UPDATE leak: %',v_table; end if;
    v_row := v_a->v_table->0;
    if v_table='devices' then
      execute 'update public.devices set name=''probe updated'' where user_id=$1 and id=''release-security-probe''' using v_owner;
    else
      execute format('update public.%I set updated_at=''2027-01-01'',deleted_at=''2027-01-01'' where user_id=$1 and id=$2::uuid',v_table)
        using v_owner,v_row->>'id';
    end if;
    get diagnostics v_count = row_count;
    if v_count <> 1 then raise exception 'Owner UPDATE/tombstone failed: %',v_table; end if;
    execute format('select count(*) from public.%I where user_id=$1 and id::text=$2',v_table) into v_count using v_owner,v_row->>'id';
    if v_count <> 1 then raise exception 'Owner confirmation SELECT failed: %',v_table; end if;
    v_denied := false;
    begin
      if v_table='devices' then
        execute 'update public.devices set user_id=$1 where user_id=$2 and id=''release-security-probe''' using v_other,v_owner;
      else
        execute format('update public.%I set user_id=$1,updated_at=''2028-01-01'' where user_id=$2 and id=$3::uuid',v_table)
          using v_other,v_owner,v_row->>'id';
      end if;
    exception when insufficient_privilege then v_denied:=true; end;
    if not v_denied then raise exception 'Owner reassignment accepted: %',v_table; end if;
    foreach v_statement in array array[format('delete from public.%I where false',v_table),format('truncate public.%I',v_table)] loop
      v_denied:=false;
      begin execute v_statement; exception when insufficient_privilege then v_denied:=true; end;
      if not v_denied then raise exception 'Hard delete/privileged operation allowed: %',v_table; end if;
    end loop;
  end loop;

  -- A row cannot claim the current owner while referencing another owner's parent.
  v_denied:=false;
  begin
    update public.workout_exercises set record_id=(v_b->'workout_records'->0->>'id')::uuid
      where id=(v_a->'workout_exercises'->0->>'id')::uuid;
  exception when insufficient_privilege then v_denied:=true; end;
  if not v_denied then raise exception 'Foreign workout parent accepted'; end if;
  v_denied:=false;
  begin
    update public.workout_sets set workout_exercise_id=(v_b->'workout_exercises'->0->>'id')::uuid
      where id=(v_a->'workout_sets'->0->>'id')::uuid;
  exception when insufficient_privilege then v_denied:=true; end;
  if not v_denied then raise exception 'Foreign exercise parent accepted'; end if;
  v_denied:=false;
  begin perform public.sync_fitness_data_v1(v_b-'notes','{}',500);
  exception when insufficient_privilege then v_denied:=true; end;
  if not v_denied then raise exception 'Fitness RPC accepted forged owner'; end if;
  select public.sync_fitness_data_v1(v_a-'notes','{}',500) into v_result;
  if (v_result->'pushed'->>'workout_records')::integer <> 0 then raise exception 'Stale Fitness edit overwrote tombstone'; end if;
  if not exists (select 1 from jsonb_array_elements(v_result->'rows'->'workout_records') r
    where r->>'id'=v_a->'workout_records'->0->>'id' and r->>'deleted_at' is not null) then
    raise exception 'Fitness pull omitted tombstone';
  end if;
  update public.notes set content='stale',updated_at='2026-01-01' where id=(v_a->'notes'->0->>'id')::uuid;
  get diagnostics v_count=row_count;
  if v_count <> 0 then raise exception 'Note LWW regressed'; end if;
  -- The existing security-invoker read model must still work for Personal OS.
  perform * from public.fitness_nutrition_summary_v1 limit 1;
  execute 'reset role';

  perform set_config('request.jwt.claim.sub',v_other,true);
  execute 'set local role authenticated';
  foreach v_table in array array['notes','devices','workout_records','workout_exercises','workout_sets','meal_records','weight_records'] loop
    execute format('select count(*) from public.%I where user_id=$1',v_table) into v_count using v_owner;
    if v_count <> 0 then raise exception 'Other account read accepted: %',v_table; end if;
    v_row:=v_a->v_table->0;
    select string_agg(quote_ident(key),',' order by key) into v_columns from jsonb_object_keys(v_row) key;
    v_denied:=false;
    begin
      execute format('insert into public.%I(%s) select %s from jsonb_populate_record(null::public.%I,$1)',v_table,v_columns,v_columns,v_table) using v_row;
    exception when insufficient_privilege then v_denied:=true; end;
    if not v_denied then raise exception 'Other account forged insert accepted: %',v_table; end if;
  end loop;
  execute 'reset role';

  perform set_config('request.jwt.claim.sub','',true);
  execute 'set local role anon';
  foreach v_table in array array['notes','devices','workout_records','workout_exercises','workout_sets','meal_records','weight_records'] loop
    foreach v_statement in array array[format('select 1 from public.%I limit 1',v_table),
      format('insert into public.%I default values',v_table),format('update public.%I set user_id=''qa'' where false',v_table),
      format('delete from public.%I where false',v_table),format('truncate public.%I',v_table)] loop
      v_denied:=false;
      begin execute v_statement; exception when insufficient_privilege then v_denied:=true; end;
      if not v_denied then raise exception 'Anon access allowed: %',v_table; end if;
    end loop;
  end loop;
  execute 'reset role';
end;
$probe$;
select 'PASS: seven-table anon/owner/other isolation, parent scope, Fitness RPC, notes LWW, tombstones; all writes rolled back' as result;
rollback;
