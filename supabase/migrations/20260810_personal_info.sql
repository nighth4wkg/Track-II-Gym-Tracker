-- Optional reporting copy of the personal information stored in auth metadata.
-- Track continues to work immediately from auth metadata before this migration
-- is deployed; these columns make the values available to future SQL reports.
alter table public.profiles
  add column if not exists height_cm numeric,
  add column if not exists weight_kg numeric;

comment on column public.profiles.height_cm is 'User height in centimetres';
comment on column public.profiles.weight_kg is 'User bodyweight in kilograms';
