# Track II testing

The default checks are intentionally split by responsibility:

- `npm.cmd test` runs the production build, rendered-source checks, and Rank
  behavior tests.
- `npm.cmd run typecheck` validates TypeScript contracts.
- `npm.cmd run lint` runs ESLint and the anti-slop rules.
- `npm.cmd run check:maintainability` prevents components over 700 lines and
  prevents the existing CSS override count from growing past its budget.
- `npm.cmd run test:e2e` runs real browser smoke tests with a local dev server.
- `npm.cmd run build:pages` and `npm.cmd run package:pages:release` validate the
  static deployment path and release archive.

Browser tests that do not require an account run by default. Authenticated and
two-context realtime tests require a dedicated non-production test account:

```powershell
$env:E2E_USERNAME = "test-user"
$env:E2E_PASSWORD = Read-Host "Dedicated test account password"
npm.cmd run validate:production
```

`validate:release` runs every release check and skips only account-dependent
browser cases when those variables are absent. `validate:production` fails fast
unless both variables exist. Authenticated tests run serially and remove the
temporary exercise records they create.

The test account must point at a dedicated test Supabase project. Never place
credentials in source files or commit them. Browser tests cover the native
fallback boundary; actual Capacitor haptics and notifications still require a
device or simulator smoke run because a browser cannot execute native plugins.
