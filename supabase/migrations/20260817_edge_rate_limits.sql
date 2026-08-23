-- Distributed rate limiting for public Edge Function entry points.
-- Keys are SHA-256 fingerprints, so raw IP addresses and usernames are never
-- persisted in the limiter table.

create table if not exists public.edge_rate_limits (
  bucket text not null check (length(bucket) between 1 and 64),
  key_hash text not null check (key_hash ~ '^[0-9a-f]{64}$'),
  window_started_at timestamptz not null default now(),
  attempts integer not null default 1 check (attempts >= 0),
  updated_at timestamptz not null default now(),
  primary key (bucket, key_hash)
);

alter table public.edge_rate_limits enable row level security;
alter table public.edge_rate_limits force row level security;
revoke all on table public.edge_rate_limits from anon, authenticated, public;

create or replace function public.consume_edge_rate_limit(
  p_bucket text,
  p_key_hash text,
  p_window_seconds integer,
  p_max_attempts integer
)
returns table(allowed boolean, retry_after_seconds integer)
language plpgsql
security definer
set search_path = public
as $$
declare
  current_time_utc timestamptz := now();
  window_length interval := make_interval(secs => greatest(1, least(p_window_seconds, 86400)));
  window_started timestamptz;
  attempt_count integer;
begin
  if p_bucket is null or length(p_bucket) = 0 or length(p_bucket) > 64
     or p_key_hash is null or p_key_hash !~ '^[0-9a-f]{64}$'
     or p_window_seconds is null or p_window_seconds < 1
     or p_max_attempts is null or p_max_attempts < 1 then
    raise exception 'Invalid rate-limit parameters';
  end if;

  delete from public.edge_rate_limits
  where bucket = p_bucket
    and updated_at < current_time_utc - interval '1 day';

  insert into public.edge_rate_limits (bucket, key_hash, window_started_at, attempts, updated_at)
  values (p_bucket, p_key_hash, current_time_utc, 1, current_time_utc)
  on conflict (bucket, key_hash) do update
  set attempts = case
      when public.edge_rate_limits.window_started_at <= current_time_utc - window_length then 1
      else public.edge_rate_limits.attempts + 1
    end,
    window_started_at = case
      when public.edge_rate_limits.window_started_at <= current_time_utc - window_length then current_time_utc
      else public.edge_rate_limits.window_started_at
    end,
    updated_at = current_time_utc;

  select edge_rate_limits.window_started_at, edge_rate_limits.attempts
  into window_started, attempt_count
  from public.edge_rate_limits
  where edge_rate_limits.bucket = p_bucket
    and edge_rate_limits.key_hash = p_key_hash;

  return query
  select attempt_count <= p_max_attempts,
    greatest(0, ceil(extract(epoch from (window_started + window_length - current_time_utc))))::integer;
end;
$$;

revoke all on function public.consume_edge_rate_limit(text, text, integer, integer) from public, anon, authenticated;
grant execute on function public.consume_edge_rate_limit(text, text, integer, integer) to service_role;
