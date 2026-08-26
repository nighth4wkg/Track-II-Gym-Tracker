# Supabase RLS review

Track II's migration source is designed so workout data is private by default:

- `profiles`, splits, exercises, sets, workout sessions, notes, and sync
  revisions are owner-scoped with `auth.uid()` policies.
- Those private tables enable and force row-level security, revoke anonymous
  and public table grants, and grant normal table access only to `authenticated`
  and `service_role`.
- `admin_users`, `auth_username_directory`, `admin_audit_log`, and rate-limit
  data are service-role-only.
- `track_announcements` is intentionally readable by signed-in users for the
  seven-day announcement banner; it does not contain private workout data.
- Realtime sync topics are restricted to the signed-in user's UUID.

This source review does not prove that a deployed Supabase project has applied
every migration. Before allowing real users, run the following in the target
project's Supabase SQL editor and save the result with the deployment record.

## 1. Confirm RLS on every application table

```sql
select
  n.nspname as schema_name,
  c.relname as table_name,
  c.relrowsecurity as rls_enabled,
  c.relforcerowsecurity as rls_forced
from pg_class as c
join pg_namespace as n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relkind = 'r'
order by c.relname;
```

Every returned application table must have both `rls_enabled` and `rls_forced`
set to `true`. Review intentionally public lookup tables separately if the
project adds any later.

## 2. Review policy scope and grants

```sql
select
  schemaname,
  tablename,
  policyname,
  roles,
  cmd,
  qual,
  with_check
from pg_policies
where schemaname in ('public', 'realtime')
order by schemaname, tablename, policyname;
```

For private user tables, every read/write policy must be owner-scoped with
`auth.uid()` (or be explicitly service-role-only). The only broad signed-in
read in the current source is the recent announcement policy.

```sql
select
  table_schema,
  table_name,
  grantee,
  privilege_type
from information_schema.role_table_grants
where table_schema = 'public'
  and grantee in ('public', 'anon', 'authenticated')
order by table_name, grantee, privilege_type;
```

There must be no `public` or `anon` grants on private workout, identity,
administrator, audit, rate-limit, or sync tables. The browser must never use a
service-role key; only the deployed Edge Functions may read
`SUPABASE_SERVICE_ROLE_KEY`.

## 3. Re-run after migrations

```powershell
npx.cmd supabase db push
```

Never delete migration history to make this command succeed. If Supabase says
the local and remote migration histories differ, stop and reconcile them before
applying changes.
