-- Complete owner-only RLS policies for Track's user data.
--
-- PostgreSQL combines permissive policies with OR. Removing every old policy
-- first prevents a broad historical ALL policy from bypassing the stricter
-- parent-ownership checks below.

alter table public.profiles enable row level security;
alter table public.splits enable row level security;
alter table public.exercises enable row level security;
alter table public.exercise_sets enable row level security;
alter table public.workout_sessions enable row level security;
alter table public.workout_set_logs enable row level security;
alter table public.workout_notes enable row level security;
alter table public.track_state_revisions enable row level security;
alter table public.workout_sync_revisions enable row level security;

do $$
declare
  policy_row record;
begin
  for policy_row in
    select schemaname, tablename, policyname
    from pg_policies
    where schemaname = 'public'
      and tablename in (
        'profiles', 'splits', 'exercises', 'exercise_sets',
        'workout_sessions', 'workout_set_logs', 'workout_notes',
        'track_state_revisions', 'workout_sync_revisions'
      )
  loop
    execute format('drop policy if exists %I on %I.%I', policy_row.policyname, policy_row.schemaname, policy_row.tablename);
  end loop;
end $$;

create policy "Users can read their own profile"
  on public.profiles for select to authenticated
  using (auth.uid() = user_id);
create policy "Users can update their own profile"
  on public.profiles for update to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can read their own splits"
  on public.splits for select to authenticated
  using (auth.uid() = user_id);
create policy "Users can insert their own splits"
  on public.splits for insert to authenticated
  with check (auth.uid() = user_id);
create policy "Users can update their own splits"
  on public.splits for update to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
create policy "Users can delete their own splits"
  on public.splits for delete to authenticated
  using (auth.uid() = user_id);

create policy "Users can read their own exercises"
  on public.exercises for select to authenticated
  using (auth.uid() = user_id);
create policy "Users can insert their own exercises"
  on public.exercises for insert to authenticated
  with check (
    auth.uid() = user_id
    and exists (
      select 1 from public.splits
      where splits.id = exercises.split_id
        and splits.user_id = auth.uid()
    )
  );
create policy "Users can update their own exercises"
  on public.exercises for update to authenticated
  using (auth.uid() = user_id)
  with check (
    auth.uid() = user_id
    and exists (
      select 1 from public.splits
      where splits.id = exercises.split_id
        and splits.user_id = auth.uid()
    )
  );
create policy "Users can delete their own exercises"
  on public.exercises for delete to authenticated
  using (auth.uid() = user_id);

create policy "Users can read their own exercise sets"
  on public.exercise_sets for select to authenticated
  using (auth.uid() = user_id);
create policy "Users can insert their own exercise sets"
  on public.exercise_sets for insert to authenticated
  with check (
    auth.uid() = user_id
    and exists (
      select 1 from public.exercises
      where exercises.id = exercise_sets.exercise_id
        and exercises.user_id = auth.uid()
    )
  );
create policy "Users can update their own exercise sets"
  on public.exercise_sets for update to authenticated
  using (auth.uid() = user_id)
  with check (
    auth.uid() = user_id
    and exists (
      select 1 from public.exercises
      where exercises.id = exercise_sets.exercise_id
        and exercises.user_id = auth.uid()
    )
  );
create policy "Users can delete their own exercise sets"
  on public.exercise_sets for delete to authenticated
  using (auth.uid() = user_id);

create policy "Users can read their own workout sessions"
  on public.workout_sessions for select to authenticated
  using (auth.uid() = user_id);
create policy "Users can insert their own workout sessions"
  on public.workout_sessions for insert to authenticated
  with check (
    auth.uid() = user_id
    and (
      split_id is null
      or exists (
        select 1 from public.splits
        where splits.id = workout_sessions.split_id
          and splits.user_id = auth.uid()
      )
    )
  );
create policy "Users can update their own workout sessions"
  on public.workout_sessions for update to authenticated
  using (auth.uid() = user_id)
  with check (
    auth.uid() = user_id
    and (
      split_id is null
      or exists (
        select 1 from public.splits
        where splits.id = workout_sessions.split_id
          and splits.user_id = auth.uid()
      )
    )
  );
create policy "Users can delete their own workout sessions"
  on public.workout_sessions for delete to authenticated
  using (auth.uid() = user_id);

create policy "Users can read their own workout set logs"
  on public.workout_set_logs for select to authenticated
  using (auth.uid() = user_id);
create policy "Users can insert their own workout set logs"
  on public.workout_set_logs for insert to authenticated
  with check (
    auth.uid() = user_id
    and exists (
      select 1 from public.workout_sessions
      where workout_sessions.id = workout_set_logs.session_id
        and workout_sessions.user_id = auth.uid()
    )
    and (
      exercise_id is null
      or exists (
        select 1 from public.exercises
        where exercises.id = workout_set_logs.exercise_id
          and exercises.user_id = auth.uid()
      )
    )
  );
create policy "Users can update their own workout set logs"
  on public.workout_set_logs for update to authenticated
  using (auth.uid() = user_id)
  with check (
    auth.uid() = user_id
    and exists (
      select 1 from public.workout_sessions
      where workout_sessions.id = workout_set_logs.session_id
        and workout_sessions.user_id = auth.uid()
    )
    and (
      exercise_id is null
      or exists (
        select 1 from public.exercises
        where exercises.id = workout_set_logs.exercise_id
          and exercises.user_id = auth.uid()
      )
    )
  );
create policy "Users can delete their own workout set logs"
  on public.workout_set_logs for delete to authenticated
  using (auth.uid() = user_id);

create policy "Users can read their own workout notes"
  on public.workout_notes for select to authenticated
  using (auth.uid() = user_id);
create policy "Users can insert their own workout notes"
  on public.workout_notes for insert to authenticated
  with check (auth.uid() = user_id);
create policy "Users can update their own workout notes"
  on public.workout_notes for update to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
create policy "Users can delete their own workout notes"
  on public.workout_notes for delete to authenticated
  using (auth.uid() = user_id);

create policy "Users can read their own Track revision"
  on public.track_state_revisions for select to authenticated
  using (auth.uid() = user_id);
create policy "Users can insert their own Track revision"
  on public.track_state_revisions for insert to authenticated
  with check (auth.uid() = user_id);
create policy "Users can update their own Track revision"
  on public.track_state_revisions for update to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Sync revisions are written by Track's database sync routine. Browsers only
-- need owner-scoped read access.
create policy "Users can read their own sync revision"
  on public.workout_sync_revisions for select to authenticated
  using (auth.uid() = user_id);
