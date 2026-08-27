-- Track II: count repeated finishes as one logical session per split/day.
-- Raw workout_sessions and workout_set_logs rows remain untouched. This
-- migration only changes the read model used by the dashboard summary RPC.

alter function public.get_dashboard_summary(text) rename to get_dashboard_summary_legacy;

create or replace function public.get_dashboard_summary(time_zone text default 'UTC')
returns jsonb
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
  local_bounds as (
    select (date_trunc('day', now() at time zone requested_zone.name) at time zone requested_zone.name) as today_start
    from requested_zone
  ),
  session_base as (
    select
      case
        when sessions.split_id is not null then concat(
          'split:', sessions.split_id::text, ':date:',
          to_char(sessions.created_at at time zone requested_zone.name, 'YYYY-MM-DD')
        )
        else sessions.id::text
      end as session_key,
      sessions.split_id::text as split_id,
      sessions.created_at,
      to_char(sessions.created_at at time zone requested_zone.name, 'YYYY-MM-DD') as date_key
    from public.workout_sessions as sessions
    cross join requested_zone
    where sessions.user_id = auth.uid()
  ),
  raw_logs as (
    select
      logs.session_id,
      sessions.split_id::text as split_id,
      logs.exercise_id,
      trim(logs.exercise_name) as exercise_name,
      coalesce(logs.set_number, 0)::integer as set_number,
      coalesce(logs.weight, 0)::double precision as weight,
      case when logs.unit::text = 'lb' then 'lb' else 'kg' end as unit,
      greatest(coalesce(logs.reps, 0), 0)::integer as reps,
      logs.created_at,
      case
        when sessions.split_id is not null then concat(
          'split:', sessions.split_id::text, ':date:',
          to_char(logs.created_at at time zone requested_zone.name, 'YYYY-MM-DD')
        )
        else coalesce(logs.session_id::text, 'legacy:' || to_char(logs.created_at at time zone requested_zone.name, 'YYYY-MM-DD'))
      end as session_key,
      to_char(logs.created_at at time zone requested_zone.name, 'YYYY-MM-DD') as date_key,
      coalesce(
        logs.exercise_id::text,
        lower(regexp_replace(trim(logs.exercise_name), '\s+', ' ', 'g'))
      ) as exercise_key
    from public.workout_set_logs as logs
    left join public.workout_sessions as sessions
      on sessions.id = logs.session_id
      and sessions.user_id = auth.uid()
    cross join requested_zone
    where logs.user_id = auth.uid()
  ),
  deduped_logs as (
    select raw_logs.*,
      row_number() over (
        partition by raw_logs.session_key, raw_logs.exercise_key, raw_logs.set_number
        order by raw_logs.created_at desc
      ) as set_rank
    from raw_logs
  ),
  session_rows as (
    select session_key, split_id, min(created_at) as created_at, date_key
    from session_base
    group by session_key, split_id, date_key
    union all
    select raw.session_key, max(raw.split_id), min(raw.created_at), raw.date_key
    from raw_logs as raw
    where raw.session_id is null
      or not exists (
        select 1
        from public.workout_sessions as sessions
        where sessions.id = raw.session_id
          and sessions.user_id = auth.uid()
      )
    group by raw.session_key, raw.date_key
  ),
  session_metrics as (
    select
      rows.session_key,
      rows.split_id,
      rows.created_at,
      rows.date_key,
      coalesce(sum(
        case when logs.unit = 'lb' then logs.weight / 2.2046226218 else logs.weight end * logs.reps
      ), 0)::double precision as volume_kg,
      count(logs.exercise_key)::integer as set_count,
      count(distinct logs.exercise_key)::integer as exercise_count
    from session_rows as rows
    left join deduped_logs as logs
      on logs.session_key = rows.session_key
      and logs.set_rank = 1
    group by rows.session_key, rows.split_id, rows.created_at, rows.date_key
  ),
  period_bounds as (
    select
      requested_zone.name,
      local_bounds.today_start,
      now() as end_at,
      (date_trunc('year', now() at time zone requested_zone.name) at time zone requested_zone.name) as year_start,
      coalesce(
        (date_trunc('day', min(session_metrics.created_at) at time zone requested_zone.name)
          at time zone requested_zone.name),
        local_bounds.today_start
      ) as first_log_start
    from requested_zone
    cross join local_bounds
    left join session_metrics on true
    group by requested_zone.name, local_bounds.today_start
  ),
  volume_by_period as (
    select jsonb_build_object(
      'week', (
        select jsonb_build_object(
          'startDate', to_char((bounds.today_start - interval '6 days') at time zone bounds.name, 'YYYY-MM-DD'),
          'endDate', to_char(bounds.end_at at time zone bounds.name, 'YYYY-MM-DD'),
          'sessionCount', count(*) filter (
            where metrics.created_at >= bounds.today_start - interval '6 days'
              and metrics.created_at < bounds.end_at
          ),
          'volumeKg', coalesce(sum(metrics.volume_kg) filter (
            where metrics.created_at >= bounds.today_start - interval '6 days'
              and metrics.created_at < bounds.end_at
          ), 0)
        )
        from session_metrics as metrics
      ),
      'month', (
        select jsonb_build_object(
          'startDate', to_char((bounds.today_start - interval '29 days') at time zone bounds.name, 'YYYY-MM-DD'),
          'endDate', to_char(bounds.end_at at time zone bounds.name, 'YYYY-MM-DD'),
          'sessionCount', count(*) filter (
            where metrics.created_at >= bounds.today_start - interval '29 days'
              and metrics.created_at < bounds.end_at
          ),
          'volumeKg', coalesce(sum(metrics.volume_kg) filter (
            where metrics.created_at >= bounds.today_start - interval '29 days'
              and metrics.created_at < bounds.end_at
          ), 0)
        )
        from session_metrics as metrics
      ),
      'ytd', (
        select jsonb_build_object(
          'startDate', to_char(greatest(bounds.year_start, bounds.first_log_start) at time zone bounds.name, 'YYYY-MM-DD'),
          'endDate', to_char(bounds.end_at at time zone bounds.name, 'YYYY-MM-DD'),
          'sessionCount', count(*) filter (
            where metrics.created_at >= greatest(bounds.year_start, bounds.first_log_start)
              and metrics.created_at < bounds.end_at
          ),
          'volumeKg', coalesce(sum(metrics.volume_kg) filter (
            where metrics.created_at >= greatest(bounds.year_start, bounds.first_log_start)
              and metrics.created_at < bounds.end_at
          ), 0)
        )
        from session_metrics as metrics
      ),
      'all', (
        select jsonb_build_object(
          'startDate', to_char(bounds.first_log_start at time zone bounds.name, 'YYYY-MM-DD'),
          'endDate', to_char(bounds.end_at at time zone bounds.name, 'YYYY-MM-DD'),
          'sessionCount', count(*) filter (
            where metrics.created_at >= bounds.first_log_start
              and metrics.created_at < bounds.end_at
          ),
          'volumeKg', coalesce(sum(metrics.volume_kg) filter (
            where metrics.created_at >= bounds.first_log_start
              and metrics.created_at < bounds.end_at
          ), 0)
        )
        from session_metrics as metrics
      )
    ) as value
    from period_bounds as bounds
  ),
  best_sets as (
    select logs.*,
      case when logs.unit = 'lb' then logs.weight / 2.2046226218 else logs.weight end as load_kg,
      row_number() over (
        partition by logs.session_key, logs.exercise_key
        order by
          (case when logs.unit = 'lb' then logs.weight / 2.2046226218 else logs.weight end) desc,
          logs.reps desc,
          logs.created_at desc
      ) as best_rank
    from deduped_logs as logs
    where logs.set_rank = 1
  ),
  ordered_best as (
    select best_sets.*,
      max(best_sets.load_kg) over (
        partition by best_sets.exercise_key
        order by best_sets.created_at, best_sets.session_key
        rows between unbounded preceding and 1 preceding
      ) as previous_best_kg
    from best_sets
    where best_sets.best_rank = 1
  ),
  progress_rows as (
    select *
    from ordered_best
    order by created_at desc, session_key desc
    limit 8
  ),
  weekly_exercise_sets as (
    select
      logs.exercise_id::text as exercise_id,
      max(logs.exercise_name) as exercise_name,
      count(*)::integer as set_count
    from deduped_logs as logs
    cross join local_bounds
    where logs.set_rank = 1
      and logs.created_at >= local_bounds.today_start - interval '6 days'
      and logs.created_at < local_bounds.today_start + interval '1 day'
    group by logs.exercise_id, logs.exercise_key
    order by max(logs.exercise_name)
  ),
  weekly_muscle_classified as (
    select
      case
        when lower(logs.exercise_name) ~ '(crunch|plank|sit[- ]?up|ab wheel|rollout|roll out|leg raise|knee raise|russian twist|wood chop|pallof|dead bug|dragon flag|hollow|windshield wiper|side bend|core|toe touch|mountain climber|jackknife|windmill|landmine rotation)' then 'core'
        when lower(logs.exercise_name) ~ '(shoulder|delt|rotator|overhead press|military press|arnold press|lateral raise|front raise|upright row|cuban press)' then 'shoulders'
        when lower(logs.exercise_name) ~ '(bench press|chest|pec|fly|crossover|push[- ]?up|dip)' then 'chest'
        when lower(logs.exercise_name) ~ '(lat|pulldown|pull down|pull up|chin up|row|rowing|pullover|prayer|keenan flap|rear delt|reverse fly|face pull|pull apart|shrug|back extension|hyperextension|superman|scap pull|block pull|rack pull|high pull)' then 'back'
        when lower(logs.exercise_name) ~ '(curl|biceps|triceps|pushdown|push down|skull crusher|tate press|jm press|wrist|forearm|gripper|bar hang|farmer|carry)' then 'arms'
        when lower(logs.exercise_name) ~ '(squat|lunge|deadlift|leg press|leg extension|leg curl|hamstring|nordic|hip|glute|calf|heel|tibialis|step up|stepup|wall sit|sissy|cossack|sled|jump|cycling|bike|running|walking|elliptical|side kick|clamshell|frog pump|donkey kick|lateral bound|lateral walk|pull through)' then 'legs'
        else null
      end as muscle_group
    from deduped_logs as logs
    cross join local_bounds
    where logs.set_rank = 1
      and logs.created_at >= local_bounds.today_start - interval '6 days'
      and logs.created_at < local_bounds.today_start + interval '1 day'
  ),
  weekly_muscle_totals as (
    select muscle_group, count(*)::integer as set_count
    from weekly_muscle_classified
    where muscle_group is not null
    group by muscle_group
    order by muscle_group
  ),
  legacy as (
    select public.get_dashboard_summary_legacy(time_zone) as value
  )
  select legacy.value || jsonb_build_object(
    'sessionCount', (select count(*)::integer from session_metrics),
    'firstLogAt', (select min(created_at) from session_metrics),
    'latestLogAt', (select max(created_at) from session_metrics),
    'sessions', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', session_key,
        'splitId', split_id,
        'createdAt', created_at,
        'dateKey', date_key,
        'volumeKg', volume_kg,
        'setCount', set_count,
        'exerciseCount', exercise_count
      ) order by created_at)
      from session_metrics
    ), '[]'::jsonb),
    'volumeByPeriod', (select value from volume_by_period),
    'progressFeed', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', concat(session_key, ':', exercise_key),
        'exercise', exercise_name,
        'createdAt', created_at,
        'weight', weight,
        'unit', unit,
        'reps', reps,
        'isPr', coalesce(previous_best_kg, 0) > 0 and load_kg > previous_best_kg + 0.05
      ) order by created_at desc)
      from progress_rows
    ), '[]'::jsonb),
    'weeklyExerciseSets', coalesce((
      select jsonb_agg(jsonb_build_object(
        'exerciseId', exercise_id,
        'exerciseName', exercise_name,
        'setCount', set_count
      ) order by exercise_name)
      from weekly_exercise_sets
    ), '[]'::jsonb),
    'weeklyMuscleTotals', coalesce((
      select jsonb_agg(jsonb_build_object(
        'group', muscle_group,
        'setCount', set_count
      ) order by muscle_group)
      from weekly_muscle_totals
    ), '[]'::jsonb)
  )
  from legacy;
$$;

revoke all on function public.get_dashboard_summary(text) from public;
grant execute on function public.get_dashboard_summary(text) to authenticated;
grant execute on function public.get_dashboard_summary_legacy(text) to authenticated;
