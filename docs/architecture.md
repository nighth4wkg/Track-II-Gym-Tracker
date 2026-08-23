# Track II architecture

## Runtime paths

Track II has one shared client UI with two runtime entry points:

```text
cloudflare/main.tsx  ->  app/page.tsx  ->  app/TrackApp.tsx  ->  app/TrackAppCore.tsx
worker/index.ts      ->  vinext server runtime for the hosted app
```

The static Pages build imports the same `app/page.tsx` and
`app/globals.css` through `cloudflare/main.tsx`. `vite.pages.config.ts` writes
the deployable bundle to `work/cloudflare-pages/`. The hosted runtime uses
`vite.config.ts`, `worker/index.ts`, and the same shared application modules.

## Source layout

- `app/components/` contains screen and modal components.
- `app/contexts/` contains focused context providers for the shared UI.
- `app/hooks/` contains state, persistence, gesture, lifecycle, and sync hooks.
- `app/data/` contains Supabase reads, writes, and pagination helpers.
- `app/styles/` contains the ordered CSS layers imported by `app/globals.css`.
- `app/TrackAppCore.tsx` composes the state hooks and passes behavior into the
  presentation shell.
- `supabase/migrations/` contains the ordered database changes.
- `supabase/functions/` contains the signed-in Edge Functions and shared
  request, CORS, rate-limit, and administrator helpers.
- `public/` contains only runtime assets such as icons, loading resources, the
  service worker, and response headers.
- `tests/` contains source-level, rendered-source, and Rank behavior checks.

## Data ownership and synchronization

Supabase Auth owns account identity and password recovery. Supabase tables and
Realtime own workout values, splits, exercises, sets, notes, preferences, and
workout history. Owner-scoped row-level security protects the data in the
database; the browser never accesses administrator tables directly.

Workout mutations first keep a local recovery snapshot, then save through the
revision-checked sync path. Realtime broadcasts and the fallback poll converge
changes across signed-in devices. Timer runtime is stored in the user's
`track_preferences` metadata using a stopwatch start timestamp or rest-timer
end timestamp, so refreshes reconstruct the running timer instead of resetting
it.

Presentation-only state, such as exercise collapse state and active navigation,
stays local to the device. Workout values, completed state, new records, and
other actual account data are the parts that synchronize.

## Database and functions

Apply the migrations in filename order. The current source includes migrations
through `20260830_history_read_optimization.sql`, including owner RLS,
personal-information protection, input validation, bounded calendar deletion,
private Realtime channels, administrator roster safeguards, announcements, and
sync-payload integrity checks. The latest migration adds owner-scoped compact
history RPCs and supporting indexes so startup and calendar refreshes do not
download complete workout-history tables.

The active functions are:

- `username-auth` for username-based sign-in without public email lookup.
- `extract-workout` for authenticated AI workout extraction.
- `admin-member-data` for administrator-only directory and read-only member
  operations.
- `admin-announcement` for administrator-only announcements.

Server-only administrator configuration stays in Supabase secrets. The browser
receives only the minimum directory fields and never receives service-role
credentials or direct administrator-table access.

## Keeping builds aligned

Feature UI belongs in `app/`; the runtime entry points should remain thin. After
source changes, validate both output paths:

```powershell
npm.cmd run validate:release
npm.cmd run package:pages:release
```

The static bundle must contain `index.html` at its root. Generated output,
local environments, recovery archives, and the `excluded_from_project/` folder
are local-only and are not part of the active source tree.
