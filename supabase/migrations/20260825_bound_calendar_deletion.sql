-- Bound the exact ids accepted by the calendar deletion RPC. The ids are
-- still owner-scoped by the original function, but a hard cap prevents a
-- malformed client from turning one request into an unbounded delete.

create or replace function public.delete_workout_day(
  p_workout_date date,
  p_session_ids uuid[] default '{}'::uuid[]
)
returns boolean
language plpgsql
security invoker
set search_path = public
as $$
declare
  actor uuid := auth.uid();
  session_ids uuid[] := coalesce(p_session_ids, '{}'::uuid[]);
begin
  if actor is null then
    raise exception 'Authentication is required';
  end if;
  if p_workout_date is null then
    raise exception 'A workout date is required';
  end if;
  if cardinality(session_ids) > 500 then
    raise exception 'Too many workout sessions were supplied';
  end if;

  delete from public.workout_set_logs
    where user_id = actor
      and session_id = any(session_ids);

  delete from public.workout_sessions
    where user_id = actor
      and id = any(session_ids);

  delete from public.workout_notes
    where user_id = actor
      and date_key = p_workout_date;

  return true;
end;
$$;

revoke all on function public.delete_workout_day(date, uuid[]) from public;
grant execute on function public.delete_workout_day(date, uuid[]) to authenticated;
