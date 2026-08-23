-- Persist administrator announcements instead of using a public Realtime
-- broadcast channel. Realtime broadcasts are intentionally not used for
-- cross-user messages because any authenticated client could spoof them.

create table if not exists public.track_announcements (
  id uuid primary key default gen_random_uuid(),
  message text not null check (char_length(btrim(message)) between 1 and 240),
  created_at timestamptz not null default timezone('utc', now())
);

alter table public.track_announcements enable row level security;
alter table public.track_announcements force row level security;

revoke all on table public.track_announcements from anon, public;
grant select on table public.track_announcements to authenticated;
grant select, insert, update, delete on table public.track_announcements to service_role;

create index if not exists track_announcements_created_at_idx
  on public.track_announcements (created_at desc);

drop policy if exists "Authenticated users can read recent Track announcements" on public.track_announcements;
create policy "Authenticated users can read recent Track announcements"
  on public.track_announcements
  for select
  to authenticated
  using (created_at >= timezone('utc', now()) - interval '7 days');
