-- Reject incomplete workout snapshots before the incremental writer can
-- interpret a missing `splits` array as "delete everything". Valid empty
-- arrays remain supported, so users can still clear a workout intentionally.

create or replace function public.validate_track_state_payload(state jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  split_value jsonb;
  task_value jsonb;
  set_value jsonb;
  weight_value numeric;
  reps_value integer;
  rir_value integer;
begin
  if state is null
    or jsonb_typeof(state) <> 'object'
    or not (state ? 'splits')
    or jsonb_typeof(state->'splits') <> 'array'
    or pg_column_size(state) > 1048576 then
    raise exception 'Invalid workout state';
  end if;
  if jsonb_array_length(state->'splits') > 50 then
    raise exception 'Invalid workout splits';
  end if;

  for split_value in select value from jsonb_array_elements(state->'splits') loop
    if jsonb_typeof(split_value) <> 'object'
      or length(trim(coalesce(split_value->>'name', ''))) > 160
      or jsonb_typeof(coalesce(split_value->'tasks', '[]'::jsonb)) <> 'array'
      or jsonb_array_length(coalesce(split_value->'tasks', '[]'::jsonb)) > 100 then
      raise exception 'Invalid workout split';
    end if;

    for task_value in select value from jsonb_array_elements(coalesce(split_value->'tasks', '[]'::jsonb)) loop
      if jsonb_typeof(task_value) <> 'object'
        or length(trim(coalesce(task_value->>'name', ''))) > 160
        or jsonb_typeof(coalesce(task_value->'sets', '[]'::jsonb)) <> 'array'
        or jsonb_array_length(coalesce(task_value->'sets', '[]'::jsonb)) > 50 then
        raise exception 'Invalid workout exercise';
      end if;

      for set_value in select value from jsonb_array_elements(coalesce(task_value->'sets', '[]'::jsonb)) loop
        if jsonb_typeof(set_value) <> 'object' then
          raise exception 'Invalid workout set';
        end if;
        weight_value := coalesce((set_value->>'weight')::numeric, 0);
        reps_value := coalesce((set_value->>'reps')::integer, 0);
        rir_value := coalesce((set_value->>'rir')::integer, 0);
        if weight_value < 0 or weight_value > 100000
          or reps_value < 0 or reps_value > 1000
          or rir_value < 0 or rir_value > 10
          or coalesce(set_value->>'unit', 'kg') not in ('kg', 'lb') then
          raise exception 'Invalid workout set values';
        end if;
      end loop;
    end loop;
  end loop;
end;
$$;

revoke all on function public.validate_track_state_payload(jsonb) from public;
grant execute on function public.validate_track_state_payload(jsonb) to authenticated, service_role;
