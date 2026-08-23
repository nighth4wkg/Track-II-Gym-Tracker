-- Keep the last administrator safe even when two admin actions arrive at the
-- same time. The Edge Function uses the service role for this RPC; browsers
-- cannot call it directly.

create or replace function public.demote_admin_user(target_user_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  administrator_count integer;
begin
  if auth.role() <> 'service_role' then
    raise exception 'Service role is required';
  end if;

  if target_user_id is null then
    return false;
  end if;

  perform pg_advisory_xact_lock(hashtextextended('track-admin-roster', 0));

  select count(*) into administrator_count
    from public.admin_users;

  if administrator_count <= 1 then
    return false;
  end if;

  delete from public.admin_users
    where user_id = target_user_id;

  return found;
end;
$$;

revoke all on function public.demote_admin_user(uuid) from public;
grant execute on function public.demote_admin_user(uuid) to service_role;
