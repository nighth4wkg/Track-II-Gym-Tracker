-- Validate complete client payloads before the transactional write functions
-- touch any private workout rows. This keeps malformed or unexpectedly large
-- requests from becoming stored data or an expensive database operation.

create or replace function public.validate_track_state_payload(state jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  split_value jsonb;
  task_value jsonb;
  set_value jsonb;
  weight_value numeric;
  reps_value integer;
  rir_value integer;
begin
  if state is null or jsonb_typeof(state) <> 'object' or pg_column_size(state) > 1048576 then
    raise exception 'Invalid workout state';
  end if;
  if jsonb_typeof(coalesce(state->'splits', '[]'::jsonb)) <> 'array'
    or jsonb_array_length(coalesce(state->'splits', '[]'::jsonb)) > 50 then
    raise exception 'Invalid workout splits';
  end if;

  for split_value in select value from jsonb_array_elements(coalesce(state->'splits', '[]'::jsonb)) loop
    if jsonb_typeof(split_value) <> 'object'
      or length(trim(coalesce(split_value->>'name', ''))) > 160
      or jsonb_typeof(coalesce(split_value->'tasks', '[]'::jsonb)) <> 'array'
      or jsonb_array_length(coalesce(split_value->'tasks', '[]'::jsonb)) > 100 then
      raise exception 'Invalid workout split';
    end if;

    for task_value in select value from jsonb_array_elements(coalesce(split_value->'tasks', '[]'::jsonb)) loop
      if jsonb_typeof(task_value) <> 'object'
        or length(trim(coalesce(task_value->>'name', ''))) > 160
        or jsonb_typeof(coalesce(task_value->'sets', '[]'::jsonb)) <> 'array'
        or jsonb_array_length(coalesce(task_value->'sets', '[]'::jsonb)) > 50 then
        raise exception 'Invalid workout exercise';
      end if;

      for set_value in select value from jsonb_array_elements(coalesce(task_value->'sets', '[]'::jsonb)) loop
        if jsonb_typeof(set_value) <> 'object' then
          raise exception 'Invalid workout set';
        end if;
        weight_value := coalesce((set_value->>'weight')::numeric, 0);
        reps_value := coalesce((set_value->>'reps')::integer, 0);
        rir_value := coalesce((set_value->>'rir')::integer, 0);
        if weight_value < 0 or weight_value > 100000
          or reps_value < 0 or reps_value > 1000
          or rir_value < 0 or rir_value > 10
          or coalesce(set_value->>'unit', 'kg') not in ('kg', 'lb') then
          raise exception 'Invalid workout set values';
        end if;
      end loop;
    end loop;
  end loop;
end;
$$;

create or replace function public.validate_workout_session_payload(payload jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  log_value jsonb;
  weight_value numeric;
  reps_value integer;
  rir_value integer;
  set_number_value integer;
begin
  if payload is null or jsonb_typeof(payload) <> 'object' or pg_column_size(payload) > 524288
    or length(coalesce(payload->>'splitName', '')) > 160
    or jsonb_typeof(coalesce(payload->'logs', '[]'::jsonb)) <> 'array'
    or jsonb_array_length(coalesce(payload->'logs', '[]'::jsonb)) > 500 then
    raise exception 'Invalid workout session';
  end if;

  for log_value in select value from jsonb_array_elements(coalesce(payload->'logs', '[]'::jsonb)) loop
    if jsonb_typeof(log_value) <> 'object'
      or length(trim(coalesce(log_value->>'exerciseName', ''))) = 0
      or length(trim(coalesce(log_value->>'exerciseName', ''))) > 160 then
      raise exception 'Invalid workout log';
    end if;
    weight_value := coalesce((log_value->>'weight')::numeric, 0);
    reps_value := coalesce((log_value->>'reps')::integer, 0);
    rir_value := coalesce((log_value->>'rir')::integer, 0);
    set_number_value := coalesce((log_value->>'setNumber')::integer, 1);
    if weight_value < 0 or weight_value > 100000
      or reps_value < 0 or reps_value > 1000
      or rir_value < 0 or rir_value > 10
      or set_number_value < 1 or set_number_value > 1000
      or coalesce(log_value->>'unit', 'kg') not in ('kg', 'lb') then
      raise exception 'Invalid workout log values';
    end if;
  end loop;
end;
$$;

revoke all on function public.validate_track_state_payload(jsonb) from public;
revoke all on function public.validate_workout_session_payload(jsonb) from public;
grant execute on function public.validate_track_state_payload(jsonb) to authenticated;
grant execute on function public.validate_workout_session_payload(jsonb) to authenticated;

create or replace function public.save_track_state(state jsonb, expected_revision bigint default 0)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  actor uuid := auth.uid();
  revision_row public.track_state_revisions%rowtype;
  next_revision bigint;
  split_value jsonb;
  task_value jsonb;
  set_value jsonb;
  split_id uuid;
  task_id uuid;
  updated_at_value timestamptz;
begin
  if actor is null then
    raise exception 'Authentication is required';
  end if;
  perform public.validate_track_state_payload(state);

  insert into public.track_state_revisions(user_id)
    values (actor)
    on conflict (user_id) do nothing;

  select * into revision_row
    from public.track_state_revisions
    where user_id = actor
    for update;

  if coalesce(expected_revision, 0) <> revision_row.revision then
    return jsonb_build_object('ok', false, 'conflict', true, 'revision', revision_row.revision);
  end if;

  delete from public.exercise_sets where user_id = actor;
  delete from public.exercises where user_id = actor;
  delete from public.splits where user_id = actor;

  for split_value in select value from jsonb_array_elements(coalesce(state->'splits', '[]'::jsonb)) loop
    split_id := (split_value->>'id')::uuid;
    updated_at_value := to_timestamp(coalesce((split_value->>'updatedAt')::double precision, extract(epoch from now()) * 1000) / 1000.0);
    insert into public.splits(id, user_id, name, position, updated_at)
      values (split_id, actor, coalesce(split_value->>'name', 'Untitled split'), coalesce((split_value->>'position')::integer, 0), updated_at_value);

    for task_value in select value from jsonb_array_elements(coalesce(split_value->'tasks', '[]'::jsonb)) loop
      task_id := (task_value->>'id')::uuid;
      insert into public.exercises(id, user_id, split_id, name, position, completed, collapsed)
        values (task_id, actor, split_id, coalesce(task_value->>'name', 'Exercise'), coalesce((task_value->>'position')::integer, 0), coalesce((task_value->>'completed')::boolean, false), false);

      for set_value in select value from jsonb_array_elements(coalesce(task_value->'sets', '[]'::jsonb)) loop
        insert into public.exercise_sets(id, user_id, exercise_id, set_number, weight, unit, reps, rir)
          values ((set_value->>'id')::uuid, actor, task_id, coalesce((set_value->>'setNumber')::integer, 1), coalesce((set_value->>'weight')::numeric, 0), case when set_value->>'unit' = 'lb' then 'lb' else 'kg' end, coalesce((set_value->>'reps')::integer, 0), coalesce((set_value->>'rir')::integer, 0));
      end loop;
    end loop;
  end loop;

  next_revision := revision_row.revision + 1;
  update public.track_state_revisions
    set revision = next_revision, updated_at = now()
    where user_id = actor;
  return jsonb_build_object('ok', true, 'revision', next_revision);
end;
$$;

create or replace function public.save_workout_session(payload jsonb)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  actor uuid := auth.uid();
  mutation_id uuid := (payload->>'clientMutationId')::uuid;
  session_id uuid;
  inserted_id uuid;
  log_value jsonb;
begin
  if actor is null then
    raise exception 'Authentication is required';
  end if;
  if mutation_id is null then
    raise exception 'A client mutation id is required';
  end if;
  perform public.validate_workout_session_payload(payload);

  insert into public.workout_sessions(user_id, split_id, split_name, client_mutation_id)
    values (actor, nullif(payload->>'splitId', '')::uuid, coalesce(payload->>'splitName', 'Workout'), mutation_id)
    on conflict do nothing
    returning id into inserted_id;

  if inserted_id is null then
    select id into session_id
      from public.workout_sessions
      where user_id = actor and client_mutation_id = mutation_id
      limit 1;
    return jsonb_build_object('ok', true, 'sessionId', session_id, 'replayed', true);
  end if;

  for log_value in select value from jsonb_array_elements(coalesce(payload->'logs', '[]'::jsonb)) loop
    insert into public.workout_set_logs(user_id, session_id, exercise_id, exercise_name, set_number, weight, unit, reps, rir)
      values (actor, inserted_id, nullif(log_value->>'exerciseId', '')::uuid, coalesce(log_value->>'exerciseName', 'Exercise'), coalesce((log_value->>'setNumber')::integer, 1), coalesce((log_value->>'weight')::numeric, 0), case when log_value->>'unit' = 'lb' then 'lb' else 'kg' end, coalesce((log_value->>'reps')::integer, 0), coalesce((log_value->>'rir')::integer, 0));
  end loop;

  return jsonb_build_object('ok', true, 'sessionId', inserted_id, 'replayed', false);
end;
$$;

revoke all on function public.save_track_state(jsonb, bigint) from public;
grant execute on function public.save_track_state(jsonb, bigint) to authenticated;
revoke all on function public.save_workout_session(jsonb) from public;
grant execute on function public.save_workout_session(jsonb) to authenticated;
