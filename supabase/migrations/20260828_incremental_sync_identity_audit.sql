-- Track II: compatibility-preserving data and admin hardening.
--
-- This migration adds new paths beside the existing functions. Existing
-- snapshots, revisions, RLS policies, and the original save_track_state RPC
-- remain intact so older clients can continue to read and write safely.

-- -------------------------------------------------------------------------
-- Incremental workout persistence
-- -------------------------------------------------------------------------

create or replace function public.validate_track_state_ids(state jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  split_value jsonb;
  task_value jsonb;
  set_value jsonb;
begin
  if state is null or jsonb_typeof(state) <> 'object' then
    raise exception 'Invalid workout state';
  end if;

  for split_value in select value from jsonb_array_elements(coalesce(state->'splits', '[]'::jsonb)) loop
    if coalesce(split_value->>'id', '') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' then
      raise exception 'Invalid workout split id';
    end if;
    for task_value in select value from jsonb_array_elements(coalesce(split_value->'tasks', '[]'::jsonb)) loop
      if coalesce(task_value->>'id', '') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' then
        raise exception 'Invalid workout exercise id';
      end if;
      for set_value in select value from jsonb_array_elements(coalesce(task_value->'sets', '[]'::jsonb)) loop
        if coalesce(set_value->>'id', '') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' then
          raise exception 'Invalid workout set id';
        end if;
      end loop;
    end loop;
  end loop;
end;
$$;

revoke all on function public.validate_track_state_ids(jsonb) from public;
grant execute on function public.validate_track_state_ids(jsonb) to authenticated;

create or replace function public.save_track_state_incremental(state jsonb, expected_revision bigint default 0)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  actor uuid := auth.uid();
  revision_row public.track_state_revisions%rowtype;
  next_revision bigint;
  split_value jsonb;
  task_value jsonb;
  set_value jsonb;
  split_id uuid;
  task_id uuid;
  set_id uuid;
  updated_at_value timestamptz;
  split_ids uuid[] := array[]::uuid[];
  task_ids uuid[] := array[]::uuid[];
  set_ids uuid[] := array[]::uuid[];
begin
  if actor is null then
    raise exception 'Authentication is required';
  end if;

  perform public.validate_track_state_payload(state);
  perform public.validate_track_state_ids(state);

  insert into public.track_state_revisions(user_id)
    values (actor)
    on conflict (user_id) do nothing;

  select * into revision_row
    from public.track_state_revisions
    where user_id = actor
    for update;

  if coalesce(expected_revision, 0) <> revision_row.revision then
    return jsonb_build_object('ok', false, 'conflict', true, 'revision', revision_row.revision);
  end if;

  -- Upsert the desired rows first. Existing rows keep their IDs and child
  -- relationships, which avoids the old delete/reinsert write amplification.
  for split_value in select value from jsonb_array_elements(coalesce(state->'splits', '[]'::jsonb)) loop
    split_id := (split_value->>'id')::uuid;
    split_ids := array_append(split_ids, split_id);
    updated_at_value := to_timestamp(coalesce((split_value->>'updatedAt')::double precision, extract(epoch from now()) * 1000) / 1000.0);
    if exists (select 1 from public.splits where id = split_id and user_id <> actor) then
      raise exception 'Invalid workout split ownership';
    end if;
    insert into public.splits(id, user_id, name, position, updated_at)
      values (split_id, actor, coalesce(split_value->>'name', 'Untitled split'), coalesce((split_value->>'position')::integer, 0), updated_at_value)
      on conflict (id) do update
        set name = excluded.name,
            position = excluded.position,
            updated_at = excluded.updated_at
        where public.splits.user_id = actor
          and (public.splits.name, public.splits.position, public.splits.updated_at)
            is distinct from (excluded.name, excluded.position, excluded.updated_at);

    for task_value in select value from jsonb_array_elements(coalesce(split_value->'tasks', '[]'::jsonb)) loop
      task_id := (task_value->>'id')::uuid;
      task_ids := array_append(task_ids, task_id);
      if exists (select 1 from public.exercises where id = task_id and user_id <> actor) then
        raise exception 'Invalid workout exercise ownership';
      end if;
      insert into public.exercises(id, user_id, split_id, name, position, completed, collapsed)
        values (task_id, actor, split_id, coalesce(task_value->>'name', 'Exercise'), coalesce((task_value->>'position')::integer, 0), coalesce((task_value->>'completed')::boolean, false), false)
        on conflict (id) do update
          set split_id = excluded.split_id,
            name = excluded.name,
            position = excluded.position,
               completed = excluded.completed
          where public.exercises.user_id = actor
            and (public.exercises.split_id, public.exercises.name, public.exercises.position, public.exercises.completed)
              is distinct from (excluded.split_id, excluded.name, excluded.position, excluded.completed);

      for set_value in select value from jsonb_array_elements(coalesce(task_value->'sets', '[]'::jsonb)) loop
        set_id := (set_value->>'id')::uuid;
        set_ids := array_append(set_ids, set_id);
        if exists (select 1 from public.exercise_sets where id = set_id and user_id <> actor) then
          raise exception 'Invalid workout set ownership';
        end if;
        insert into public.exercise_sets(id, user_id, exercise_id, set_number, weight, unit, reps, rir)
          values (set_id, actor, task_id, coalesce((set_value->>'setNumber')::integer, 1), coalesce((set_value->>'weight')::numeric, 0), case when set_value->>'unit' = 'lb' then 'lb' else 'kg' end, coalesce((set_value->>'reps')::integer, 0), coalesce((set_value->>'rir')::integer, 0))
          on conflict (id) do update
            set exercise_id = excluded.exercise_id,
                set_number = excluded.set_number,
                weight = excluded.weight,
                unit = excluded.unit,
                reps = excluded.reps,
                rir = excluded.rir
            where public.exercise_sets.user_id = actor
              and (public.exercise_sets.exercise_id, public.exercise_sets.set_number, public.exercise_sets.weight, public.exercise_sets.unit, public.exercise_sets.reps, public.exercise_sets.rir)
                is distinct from (excluded.exercise_id, excluded.set_number, excluded.weight, excluded.unit, excluded.reps, excluded.rir);
      end loop;
    end loop;
  end loop;

  -- Deletes are scoped to the authenticated owner and happen only after all
  -- incoming rows have been validated/upserted. The revision lock makes this
  -- safe against two devices saving concurrently.
  delete from public.exercise_sets
    where user_id = actor and not (id = any(set_ids));
  delete from public.exercises
    where user_id = actor and not (id = any(task_ids));
  delete from public.splits
    where user_id = actor and not (id = any(split_ids));

  next_revision := revision_row.revision + 1;
  update public.track_state_revisions
    set revision = next_revision, updated_at = now()
    where user_id = actor;
  return jsonb_build_object('ok', true, 'revision', next_revision, 'method', 'incremental');
end;
$$;

revoke all on function public.save_track_state_incremental(jsonb, bigint) from public;
grant execute on function public.save_track_state_incremental(jsonb, bigint) to authenticated;

-- -------------------------------------------------------------------------
-- Indexed username directory
-- -------------------------------------------------------------------------

create table if not exists public.auth_username_directory (
  user_id uuid primary key references auth.users(id) on delete cascade,
  username text not null,
  normalized_username text not null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  last_seen_at timestamptz
);

create unique index if not exists auth_username_directory_normalized_idx
  on public.auth_username_directory(normalized_username);
create index if not exists auth_username_directory_last_seen_idx
  on public.auth_username_directory(last_seen_at desc nulls last);

alter table public.auth_username_directory enable row level security;
alter table public.auth_username_directory force row level security;
revoke all on table public.auth_username_directory from public, anon, authenticated;
grant select, insert, update, delete on table public.auth_username_directory to service_role;

-- Backfill existing accounts without exposing email addresses or other Auth
-- fields. If old data contains duplicate usernames, keep the oldest mapping;
-- the trigger below prevents new duplicates from being created.
with candidates as (
  select
    id as user_id,
    regexp_replace(regexp_replace(trim(coalesce(raw_user_meta_data->>'username', '')), '^@+', ''), '\s+', '', 'g') as username,
    lower(regexp_replace(regexp_replace(trim(coalesce(raw_user_meta_data->>'username', '')), '^@+', ''), '\s+', '', 'g')) as normalized_username,
    created_at
  from auth.users
), deduplicated as (
  select distinct on (normalized_username) user_id, username, normalized_username, created_at
  from candidates
  where normalized_username ~ '^[a-z0-9_.-]{2,24}$'
  order by normalized_username, created_at, user_id
)
insert into public.auth_username_directory(user_id, username, normalized_username, created_at, updated_at)
select user_id, username, normalized_username, created_at, timezone('utc', now())
from deduplicated
on conflict (user_id) do update
  set username = excluded.username,
      normalized_username = excluded.normalized_username,
      updated_at = timezone('utc', now());

create or replace function public.sync_auth_username_directory()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  cleaned_username text;
  normalized_username_value text;
begin
  cleaned_username := regexp_replace(regexp_replace(trim(coalesce(new.raw_user_meta_data->>'username', '')), '^@+', ''), '\s+', '', 'g');
  normalized_username_value := lower(cleaned_username);

  if normalized_username_value !~ '^[a-z0-9_.-]{2,24}$' then
    delete from public.auth_username_directory where user_id = new.id;
    return new;
  end if;

  if exists (
    select 1 from public.auth_username_directory
    where normalized_username = normalized_username_value and user_id <> new.id
  ) then
    raise exception 'Username is already in use';
  end if;

  insert into public.auth_username_directory(user_id, username, normalized_username, created_at, updated_at)
    values (new.id, cleaned_username, normalized_username_value, coalesce(new.created_at, timezone('utc', now())), timezone('utc', now()))
    on conflict (user_id) do update
      set username = excluded.username,
          normalized_username = excluded.normalized_username,
          updated_at = timezone('utc', now());
  return new;
end;
$$;

revoke all on function public.sync_auth_username_directory() from public;

drop trigger if exists auth_username_directory_sync on auth.users;
create trigger auth_username_directory_sync
  after insert or update of raw_user_meta_data on auth.users
  for each row execute function public.sync_auth_username_directory();

-- -------------------------------------------------------------------------
-- Administrator audit log and atomic role changes
-- -------------------------------------------------------------------------

create table if not exists public.admin_audit_log (
  id bigint generated always as identity primary key,
  actor_user_id uuid references auth.users(id) on delete set null,
  action text not null check (action ~ '^[a-z0-9_-]{1,64}$'),
  target_user_id uuid references auth.users(id) on delete set null,
  target_username text,
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object' and pg_column_size(metadata) <= 8192),
  created_at timestamptz not null default timezone('utc', now())
);

alter table public.admin_audit_log enable row level security;
alter table public.admin_audit_log force row level security;
revoke all on table public.admin_audit_log from public, anon, authenticated;
grant select, insert on table public.admin_audit_log to service_role;
create index if not exists admin_audit_log_created_at_idx on public.admin_audit_log(created_at desc);
create index if not exists admin_audit_log_target_idx on public.admin_audit_log(target_user_id, created_at desc);

create or replace function public.set_admin_user(
  target_user_id uuid,
  should_be_admin boolean,
  actor_user_id uuid,
  target_username text default null,
  bootstrap_user_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  administrator_count integer;
  changed boolean := false;
  audit_action text;
begin
  if auth.role() <> 'service_role' then
    raise exception 'Service role is required';
  end if;
  if target_user_id is null or actor_user_id is null then
    return jsonb_build_object('ok', false, 'reason', 'invalid-user');
  end if;
  if not exists (select 1 from auth.users where id = target_user_id) then
    return jsonb_build_object('ok', false, 'reason', 'not-found');
  end if;

  perform pg_advisory_xact_lock(hashtextextended('track-admin-roster', 0));

  select count(*) into administrator_count from public.admin_users;
  if should_be_admin then
    if administrator_count = 0 and bootstrap_user_id is not null then
      insert into public.admin_users(user_id, created_by)
        values (bootstrap_user_id, actor_user_id)
        on conflict (user_id) do nothing;
    end if;
    insert into public.admin_users(user_id, created_by)
      values (target_user_id, actor_user_id)
      on conflict (user_id) do nothing;
    changed := found;
    audit_action := 'admin-promoted';
  else
    select count(*) into administrator_count from public.admin_users;
    if administrator_count <= 1 then
      return jsonb_build_object('ok', false, 'reason', 'last-admin', 'isAdmin', true);
    end if;
    delete from public.admin_users where user_id = target_user_id;
    changed := found;
    if not changed then
      return jsonb_build_object('ok', false, 'reason', 'not-admin', 'isAdmin', false);
    end if;
    audit_action := 'admin-demoted';
  end if;

  insert into public.admin_audit_log(actor_user_id, action, target_user_id, target_username, metadata)
    values (actor_user_id, audit_action, target_user_id, left(nullif(target_username, ''), 24), jsonb_build_object('isAdmin', should_be_admin));
  return jsonb_build_object('ok', true, 'changed', changed, 'isAdmin', should_be_admin);
end;
$$;

revoke all on function public.set_admin_user(uuid, boolean, uuid, text, uuid) from public;
grant execute on function public.set_admin_user(uuid, boolean, uuid, text, uuid) to service_role;
