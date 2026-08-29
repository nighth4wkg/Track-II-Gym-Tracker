-- Track II: compact evidence for the explainable progression coach.
--
-- This is read-only and additive. It never rewrites workout history. The
-- client can therefore require several comparable sessions before suggesting
-- a load change without downloading the user's full log into the browser.

create or replace function public.get_progression_workout_set_history(remember_across_splits boolean default false)
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
  created_at timestamptz,
  history_sessions integer,
  history_samples integer,
  history_failure_count integer
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
      logs.created_at,
      coalesce(logs.session_id::text, to_char(logs.created_at at time zone 'UTC', 'YYYY-MM-DD')) as session_key
    from public.workout_set_logs as logs
    left join public.workout_sessions as sessions
      on sessions.id = logs.session_id
      and sessions.user_id = auth.uid()
    where logs.user_id = auth.uid()
  ),
  exercise_stats as (
    select exercise_id, set_number,
      count(distinct session_key)::integer as history_sessions,
      count(*)::integer as history_samples,
      count(*) filter (where rir = 0)::integer as history_failure_count
    from history
    where exercise_id is not null
    group by exercise_id, set_number
  ),
  split_name_stats as (
    select split_id, normalized_name, set_number,
      count(distinct session_key)::integer as history_sessions,
      count(*)::integer as history_samples,
      count(*) filter (where rir = 0)::integer as history_failure_count
    from history
    where split_id is not null and normalized_name <> ''
    group by split_id, normalized_name, set_number
  ),
  name_stats as (
    select normalized_name, set_number,
      count(distinct session_key)::integer as history_sessions,
      count(*)::integer as history_samples,
      count(*) filter (where rir = 0)::integer as history_failure_count
    from history
    where remember_across_splits and normalized_name <> ''
    group by normalized_name, set_number
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
      history.created_at,
      stats.history_sessions,
      stats.history_samples,
      stats.history_failure_count
    from history
    join exercise_stats as stats
      on stats.exercise_id = history.exercise_id and stats.set_number = history.set_number
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
      history.created_at,
      stats.history_sessions,
      stats.history_samples,
      stats.history_failure_count
    from history
    join split_name_stats as stats
      on stats.split_id = history.split_id
      and stats.normalized_name = history.normalized_name
      and stats.set_number = history.set_number
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
      history.created_at,
      stats.history_sessions,
      stats.history_samples,
      stats.history_failure_count
    from history
    join name_stats as stats
      on stats.normalized_name = history.normalized_name and stats.set_number = history.set_number
    where remember_across_splits and history.normalized_name <> ''
    order by history.normalized_name, history.set_number, history.created_at desc
  )
  select * from latest_by_exercise
  union all
  select * from latest_by_split_name
  union all
  select * from latest_by_name;
$$;

revoke all on function public.get_progression_workout_set_history(boolean) from public;
grant execute on function public.get_progression_workout_set_history(boolean) to authenticated;
