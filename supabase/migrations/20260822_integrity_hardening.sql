-- Atomic, owner-scoped calendar deletion.
-- The client passes the exact session ids shown in the selected day. Never
-- delete all rows whose timestamp happens to fall inside a local date.

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
begin
  if actor is null then
    raise exception 'Authentication is required';
  end if;

  delete from public.workout_set_logs
    where user_id = actor
      and session_id = any(coalesce(p_session_ids, '{}'::uuid[]));

  delete from public.workout_sessions
    where user_id = actor
      and id = any(coalesce(p_session_ids, '{}'::uuid[]));

  delete from public.workout_notes
    where user_id = actor
      and date_key = p_workout_date;

  return true;
end;
$$;

revoke all on function public.delete_workout_day(date, uuid[]) from public;
grant execute on function public.delete_workout_day(date, uuid[]) to authenticated;
