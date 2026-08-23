-- Track reliable saving and replay protection.
-- Run this migration once in the Supabase SQL editor before publishing the
-- frontend. Each function executes as one database transaction.

create table if not exists public.track_state_revisions (
  user_id uuid primary key references auth.users(id) on delete cascade,
  revision bigint not null default 0,
  updated_at timestamptz not null default now()
);

alter table public.track_state_revisions enable row level security;

drop policy if exists "Users can read their own Track revision" on public.track_state_revisions;
create policy "Users can read their own Track revision"
  on public.track_state_revisions for select
  using (auth.uid() = user_id);

drop policy if exists "Users can insert their own Track revision" on public.track_state_revisions;
create policy "Users can insert their own Track revision"
  on public.track_state_revisions for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can update their own Track revision" on public.track_state_revisions;
create policy "Users can update their own Track revision"
  on public.track_state_revisions for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

alter table public.workout_sessions
  add column if not exists client_mutation_id uuid;

create unique index if not exists workout_sessions_user_mutation_idx
  on public.workout_sessions(user_id, client_mutation_id)
  where client_mutation_id is not null;

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

  -- Deletions happen only after the revision lock succeeds. The frontend
  -- writes the complete desired state in this same transaction, so a failed
  -- insert rolls the deletions back automatically.
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
        values (task_id, actor, split_id, coalesce(task_value->>'name', 'Exercise'), coalesce((task_value->>'position')::integer, 0), coalesce((task_value->>'completed')::boolean, false), coalesce((task_value->>'collapsed')::boolean, false));

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

revoke all on function public.save_track_state(jsonb, bigint) from public;
grant execute on function public.save_track_state(jsonb, bigint) to authenticated;

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

revoke all on function public.save_workout_session(jsonb) from public;
grant execute on function public.save_workout_session(jsonb) to authenticated;
