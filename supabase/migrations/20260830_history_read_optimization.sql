-- Track II: compact, owner-scoped history reads.
--
-- These functions replace browser-side full-history downloads with small
-- server-produced summaries. They are additive: no workout rows are changed or
-- removed, and older clients continue to use the existing tables and RPCs.

create index if not exists workout_sessions_owner_created_idx
  on public.workout_sessions(user_id, created_at desc);

create index if not exists workout_logs_owner_created_idx
  on public.workout_set_logs(user_id, created_at desc);

create index if not exists workout_logs_owner_exercise_set_created_idx
  on public.workout_set_logs(user_id, exercise_id, set_number, created_at desc);

create or replace function public.get_workout_date_keys(time_zone text default 'UTC')
returns table(date_key text)
language sql
stable
security invoker
set search_path = public
as $$
  with requested_zone as (
    select coalesce(
      (select name from pg_timezone_names where name = nullif(trim(time_zone), '') limit 1),
      'UTC'
    ) as name
  ),
  workout_dates as (
    select sessions.created_at
      from public.workout_sessions as sessions
      where sessions.user_id = auth.uid()
    union
    select logs.created_at
      from public.workout_set_logs as logs
      where logs.user_id = auth.uid()
  )
  select distinct to_char(workout_dates.created_at at time zone requested_zone.name, 'YYYY-MM-DD') as date_key
    from workout_dates
    cross join requested_zone
    order by date_key;
$$;

revoke all on function public.get_workout_date_keys(text) from public;
grant execute on function public.get_workout_date_keys(text) to authenticated;

create or replace function public.get_latest_workout_set_history(remember_across_splits boolean default false)
returns table(
  match_scope text,
  exercise_id uuid,
  split_id uuid,
  normalized_name text,
  set_number integer,
  weight double precision,
  unit text,
  reps integer,
  rir integer,
  created_at timestamptz
)
language sql
stable
security invoker
set search_path = public
as $$
  with history as (
    select
      logs.exercise_id,
      sessions.split_id,
      lower(regexp_replace(trim(logs.exercise_name), '\s+', ' ', 'g')) as normalized_name,
      logs.set_number::integer as set_number,
      logs.weight::double precision as weight,
      case when logs.unit = 'lb' then 'lb' else 'kg' end as unit,
      logs.reps::integer as reps,
      logs.rir::integer as rir,
      logs.created_at
    from public.workout_set_logs as logs
    left join public.workout_sessions as sessions
      on sessions.id = logs.session_id
      and sessions.user_id = auth.uid()
    where logs.user_id = auth.uid()
  ),
  latest_by_exercise as (
    select distinct on (history.exercise_id, history.set_number)
      'exercise'::text as match_scope,
      history.exercise_id,
      null::uuid as split_id,
      history.normalized_name,
      history.set_number,
      history.weight,
      history.unit,
      history.reps,
      history.rir,
      history.created_at
    from history
    where history.exercise_id is not null
    order by history.exercise_id, history.set_number, history.created_at desc
  ),
  latest_by_split_name as (
    select distinct on (history.split_id, history.normalized_name, history.set_number)
      'split-name'::text as match_scope,
      null::uuid as exercise_id,
      history.split_id,
      history.normalized_name,
      history.set_number,
      history.weight,
      history.unit,
      history.reps,
      history.rir,
      history.created_at
    from history
    where history.split_id is not null and history.normalized_name <> ''
    order by history.split_id, history.normalized_name, history.set_number, history.created_at desc
  ),
  latest_by_name as (
    select distinct on (history.normalized_name, history.set_number)
      'name'::text as match_scope,
      null::uuid as exercise_id,
      null::uuid as split_id,
      history.normalized_name,
      history.set_number,
      history.weight,
      history.unit,
      history.reps,
      history.rir,
      history.created_at
    from history
    where remember_across_splits and history.normalized_name <> ''
    order by history.normalized_name, history.set_number, history.created_at desc
  )
  select * from latest_by_exercise
  union all
  select * from latest_by_split_name
  union all
  select * from latest_by_name;
$$;

revoke all on function public.get_latest_workout_set_history(boolean) from public;
grant execute on function public.get_latest_workout_set_history(boolean) to authenticated;
