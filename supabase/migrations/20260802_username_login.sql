-- Track username sign-in. Run once in the Supabase SQL Editor before
-- publishing the frontend that enables username login.
--
-- Supabase Auth still signs in with the account email internally. This
-- security-definer lookup lets the browser resolve a username to that email
-- without exposing the auth.users table through the client API.
create or replace function public.lookup_login_email(p_username text)
returns text
language sql
stable
security definer
set search_path = public, auth
as $$
  select u.email
  from auth.users as u
  where lower(trim(coalesce(u.raw_user_meta_data ->> 'username', ''))) = lower(trim(p_username))
    and trim(coalesce(p_username, '')) <> ''
  order by u.created_at asc
  limit 1;
$$;

revoke all on function public.lookup_login_email(text) from public;
grant execute on function public.lookup_login_email(text) to anon, authenticated;
