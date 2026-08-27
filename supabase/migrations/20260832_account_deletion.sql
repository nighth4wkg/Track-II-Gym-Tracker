-- Delete one account's private data atomically before the Auth user is removed
-- by the protected delete-account Edge Function.
create or replace function public.delete_account_data(target_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  if target_user_id is null then
    raise exception 'Account id is required';
  end if;

  delete from public.workout_set_logs where user_id = target_user_id;
  delete from public.workout_sessions where user_id = target_user_id;
  delete from public.workout_notes where user_id = target_user_id;
  delete from public.exercise_sets where user_id = target_user_id;
  delete from public.exercises where user_id = target_user_id;
  delete from public.splits where user_id = target_user_id;
  delete from public.profiles where user_id = target_user_id;
  delete from public.track_state_revisions where user_id = target_user_id;
  delete from public.auth_username_directory where user_id = target_user_id;
  delete from public.admin_users where user_id = target_user_id;
end;
$$;

revoke all on function public.delete_account_data(uuid) from public, anon, authenticated;
grant execute on function public.delete_account_data(uuid) to service_role;
