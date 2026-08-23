-- Track RLS hardening: remove redundant broad ALL policies.
--
-- These policies are intentionally removed because PostgreSQL combines
-- permissive policies with OR. The broad policies only checked user_id and
-- therefore bypassed the stricter relationship checks in the INSERT and
-- UPDATE policies (for example, exercise -> split ownership).

alter table public.splits enable row level security;
alter table public.exercises enable row level security;
alter table public.exercise_sets enable row level security;
alter table public.workout_sessions enable row level security;
alter table public.workout_set_logs enable row level security;

drop policy if exists "Users manage their splits" on public.splits;
drop policy if exists "Users manage their exercises" on public.exercises;
drop policy if exists "Users manage their exercise sets" on public.exercise_sets;
drop policy if exists "Users manage their workout sessions" on public.workout_sessions;
drop policy if exists "Users manage their workout logs" on public.workout_set_logs;
