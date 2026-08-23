-- Protect Track profile data, including height_cm and weight_kg.
-- Safe to run more than once. This deliberately removes every historical
-- profile policy before installing the two owner-only policies below.

-- Some existing Track databases predate Personal Info. Create the private
-- columns here as well so this migration does not depend on migration order.
alter table public.profiles
  add column if not exists height_cm numeric,
  add column if not exists weight_kg numeric;

alter table public.profiles enable row level security;
alter table public.profiles force row level security;

revoke all on table public.profiles from anon;
revoke all on table public.profiles from public;
revoke all on table public.profiles from authenticated;
grant select, update on table public.profiles to authenticated;

do $$
declare
  policy_row record;
begin
  for policy_row in
    select policyname
    from pg_policies
    where schemaname = 'public' and tablename = 'profiles'
  loop
    execute format('drop policy if exists %I on public.profiles', policy_row.policyname);
  end loop;
end $$;

create policy "Users can read only their own profile"
  on public.profiles
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

create policy "Users can update only their own profile"
  on public.profiles
  for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

comment on column public.profiles.height_cm is
  'Private owner-only user height in centimetres';
comment on column public.profiles.weight_kg is
  'Private owner-only user bodyweight in kilograms';
