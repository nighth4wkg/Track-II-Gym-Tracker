-- Track II: durable announcement acknowledgements and replay-safe offline
-- workout uploads. This migration is additive and does not rewrite workout
-- history. Queued sessions keep the time at which the user finished them.

create table if not exists public.track_announcement_receipts (
  announcement_id uuid not null references public.track_announcements(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  dismissed_at timestamptz not null default timezone('utc', now()),
  primary key (announcement_id, user_id)
);

alter table public.track_announcement_receipts enable row level security;
alter table public.track_announcement_receipts force row level security;

revoke all on table public.track_announcement_receipts from anon, public;
grant select, insert on table public.track_announcement_receipts to authenticated;

drop policy if exists "Users can read their own announcement receipts" on public.track_announcement_receipts;
create policy "Users can read their own announcement receipts"
  on public.track_announcement_receipts for select
  using (auth.uid() = user_id);

drop policy if exists "Users can create their own announcement receipts" on public.track_announcement_receipts;
create policy "Users can create their own announcement receipts"
  on public.track_announcement_receipts for insert
  with check (auth.uid() = user_id);

create index if not exists track_announcement_receipts_user_idx
  on public.track_announcement_receipts(user_id, dismissed_at desc);

create or replace function public.get_latest_track_announcement(lookback_days integer default 7)
returns table (id uuid, message text, created_at timestamptz)
language sql
stable
security invoker
set search_path = public
as $$
  select announcements.id, announcements.message, announcements.created_at
  from public.track_announcements as announcements
  where auth.uid() is not null
    and announcements.created_at >= now() - make_interval(days => greatest(1, least(coalesce(lookback_days, 7), 30)))
    and not exists (
      select 1
      from public.track_announcement_receipts as receipts
      where receipts.announcement_id = announcements.id
        and receipts.user_id = auth.uid()
    )
  order by announcements.created_at desc
  limit 1;
$$;

create or replace function public.acknowledge_track_announcement(p_announcement_id uuid)
returns boolean
language plpgsql
security invoker
set search_path = public
as $$
declare
  actor uuid := auth.uid();
begin
  if actor is null or p_announcement_id is null then
    return false;
  end if;
  if not exists (select 1 from public.track_announcements where id = p_announcement_id) then
    return false;
  end if;
  insert into public.track_announcement_receipts(announcement_id, user_id)
    values (p_announcement_id, actor)
    on conflict (announcement_id, user_id) do nothing;
  return true;
end;
$$;

revoke all on function public.get_latest_track_announcement(integer) from public;
grant execute on function public.get_latest_track_announcement(integer) to authenticated;
revoke all on function public.acknowledge_track_announcement(uuid) from public;
grant execute on function public.acknowledge_track_announcement(uuid) to authenticated;

create or replace function public.save_workout_session(payload jsonb)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  actor uuid := auth.uid();
  mutation_id uuid := (payload->>'clientMutationId')::uuid;
  session_id uuid;
  inserted_id uuid;
  log_value jsonb;
  occurred_at_value timestamptz;
begin
  if actor is null then
    raise exception 'Authentication is required';
  end if;
  if mutation_id is null then
    raise exception 'A client mutation id is required';
  end if;
  perform public.validate_workout_session_payload(payload);

  occurred_at_value := coalesce(nullif(payload->>'occurredAt', '')::timestamptz, now());

  insert into public.workout_sessions(user_id, split_id, split_name, client_mutation_id, created_at)
    values (actor, nullif(payload->>'splitId', '')::uuid, coalesce(payload->>'splitName', 'Workout'), mutation_id, occurred_at_value)
    on conflict do nothing
    returning id into inserted_id;

  if inserted_id is null then
    select id into session_id
      from public.workout_sessions
      where user_id = actor and client_mutation_id = mutation_id
      limit 1;
    return jsonb_build_object('ok', true, 'sessionId', session_id, 'replayed', true);
  end if;

  for log_value in select value from jsonb_array_elements(coalesce(payload->'logs', '[]'::jsonb)) loop
    insert into public.workout_set_logs(user_id, session_id, exercise_id, exercise_name, set_number, weight, unit, reps, rir, created_at)
      values (actor, inserted_id, nullif(log_value->>'exerciseId', '')::uuid, coalesce(log_value->>'exerciseName', 'Exercise'), coalesce((log_value->>'setNumber')::integer, 1), coalesce((log_value->>'weight')::numeric, 0), case when log_value->>'unit' = 'lb' then 'lb' else 'kg' end, coalesce((log_value->>'reps')::integer, 0), coalesce((log_value->>'rir')::integer, 0), occurred_at_value);
  end loop;

  return jsonb_build_object('ok', true, 'sessionId', inserted_id, 'replayed', false);
end;
$$;

revoke all on function public.save_workout_session(jsonb) from public;
grant execute on function public.save_workout_session(jsonb) to authenticated;
