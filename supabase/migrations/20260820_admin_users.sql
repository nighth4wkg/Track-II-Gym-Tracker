-- Track II administrator roster.
--
-- The roster is intentionally readable and writable only by the service role
-- used by the admin-member-data Edge Function. Browsers must never query or
-- mutate administrator membership directly.

create table if not exists public.admin_users (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default timezone('utc', now()),
  created_by uuid references auth.users(id) on delete set null
);

alter table public.admin_users enable row level security;
alter table public.admin_users force row level security;

revoke all on table public.admin_users from anon, authenticated;
grant select, insert, update, delete on table public.admin_users to service_role;
