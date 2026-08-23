-- Track workout detail notes. Safe to run once in Supabase SQL Editor.
alter table public.workout_sessions
  add column if not exists notes text not null default '';

create table if not exists public.workout_notes (
  user_id uuid not null references auth.users(id) on delete cascade,
  date_key date not null,
  note text not null default '',
  updated_at timestamptz not null default now(),
  primary key (user_id, date_key)
);

alter table public.workout_notes enable row level security;

drop policy if exists "Users can read their own workout notes" on public.workout_notes;
create policy "Users can read their own workout notes"
  on public.workout_notes for select
  using (auth.uid() = user_id);

drop policy if exists "Users can insert their own workout notes" on public.workout_notes;
create policy "Users can insert their own workout notes"
  on public.workout_notes for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can update their own workout notes" on public.workout_notes;
create policy "Users can update their own workout notes"
  on public.workout_notes for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Users can delete their own workout notes" on public.workout_notes;
create policy "Users can delete their own workout notes"
  on public.workout_notes for delete
  using (auth.uid() = user_id);

-- Keep row-level security aligned with the existing owner-only session policies.
-- If your project already has equivalent policies, these statements can be skipped.
drop policy if exists "Users can update their own workout sessions" on public.workout_sessions;
create policy "Users can update their own workout sessions"
  on public.workout_sessions for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Users can delete their own workout sessions" on public.workout_sessions;
create policy "Users can delete their own workout sessions"
  on public.workout_sessions for delete
  using (auth.uid() = user_id);

drop policy if exists "Users can delete their own workout set logs" on public.workout_set_logs;
create policy "Users can delete their own workout set logs"
  on public.workout_set_logs for delete
  using (auth.uid() = user_id);
