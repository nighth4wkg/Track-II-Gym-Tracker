-- Defense-in-depth for Track II's private user data.
--
-- Passwords are managed by Supabase Auth and are never stored in Track's
-- public tables. These tables contain the account's profile, workout splits,
-- exercise values, workout history, notes, and sync metadata.
--
-- RLS policies remain the authorization boundary. Removing the default public
-- table grants also prevents an accidental future policy or endpoint from
-- making these tables readable by anonymous callers.

do $$
declare
  private_table text;
begin
  foreach private_table in array array[
    'profiles',
    'splits',
    'exercises',
    'exercise_sets',
    'workout_sessions',
    'workout_set_logs',
    'workout_notes',
    'track_state_revisions',
    'workout_sync_revisions'
  ] loop
    execute format('alter table public.%I enable row level security', private_table);
    execute format('alter table public.%I force row level security', private_table);
    execute format('revoke all on table public.%I from public', private_table);
    execute format('revoke all on table public.%I from anon', private_table);
    execute format('grant select, insert, update, delete on table public.%I to authenticated', private_table);
    execute format('grant all on table public.%I to service_role', private_table);
  end loop;
end $$;

-- Keep RPC writes available to signed-in users while never exposing them to
-- anonymous callers. The functions themselves use auth.uid() and the RLS
-- policies above to stay owner-scoped.
revoke all on function public.save_track_state(jsonb, bigint) from public;
grant execute on function public.save_track_state(jsonb, bigint) to authenticated;

revoke all on function public.save_workout_session(jsonb) from public;
grant execute on function public.save_workout_session(jsonb) to authenticated;
