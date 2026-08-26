# Track II

Track II is a free, responsive lifting-session tracker for planning splits and
recording sets, weight, reps, and RIR. The web app is the Beta source of truth:
new UI, gesture, and security changes are tested here before a later APK or IPA
release.

The app uses React, Vite, Cloudflare Pages, and Supabase. The browser bundle is
safe to share when it is configured with a Supabase publishable key. Never put a
Supabase service-role key, database password, private admin identifier, or
personal deployment URL in the source repository.

[![Validate](https://github.com/nighth4wkg/Track-II-Gym-Tracker/actions/workflows/validate.yml/badge.svg?branch=main)](https://github.com/nighth4wkg/Track-II-Gym-Tracker/actions/workflows/validate.yml)
[![Latest release](https://img.shields.io/github/v/release/nighth4wkg/Track-II-Gym-Tracker?display_name=tag&sort=semver)](https://github.com/nighth4wkg/Track-II-Gym-Tracker/releases/latest)
[![License](https://img.shields.io/github/license/nighth4wkg/Track-II-Gym-Tracker)](LICENSE)

[Releases](https://github.com/nighth4wkg/Track-II-Gym-Tracker/releases) ·
[Architecture](docs/architecture.md) · [Testing guide](docs/testing.md) ·
[Security](SECURITY.md) · [Contributing](CONTRIBUTING.md)

## What is in this Beta

- Workout splits with exercise search, editing, reordering, and multiple sets.
- Calendar history, workout details, notes, and deletion of saved sessions.
- Stopwatch and configurable rest timer modes with mouse and touch gestures.
- Light and OLED Dark themes, responsive layouts, and mobile-safe controls.
- Username/email authentication, password recovery, Supabase sync, CSV/JSON
  backup export, and admin-only diagnostics.
- A unified Track II bottom tab bar on desktop and mobile, with a small BETA
  label while this web version is being validated.
- Settings → Updates checks the deployed web build and links to the current
  GitHub release when a newer web or native build is available.

## Project layout

| Path | Purpose |
| --- | --- |
| `app/` | Shared Track II UI, state, styles, and Supabase client |
| `cloudflare/` | Static Cloudflare Pages entry |
| `public/` | Icons, manifest, service worker, and public assets |
| `supabase/` | Database migrations and Edge Functions |
| `worker/` | Optional vinext/Cloudflare Worker entry |
| `tests/` | Source and build smoke checks |
| `tools/oxlint/anti-slop/` | Review-focused anti-slop lint rules |

Generated output, local staging folders, ZIP files, and environment files are
ignored by Git. They stay on the local computer for deployment and are not part
of the shareable source.

## 1. Install the tools

This setup is free within the usual free-tier limits of the services involved.
Install:

1. Node.js 22 or newer from [nodejs.org](https://nodejs.org/).
2. A free Supabase account at [supabase.com](https://supabase.com/).
3. A free Cloudflare account at [dash.cloudflare.com](https://dash.cloudflare.com/).

Download or copy this source folder, open a terminal in that folder, and run:

```powershell
npm.cmd ci
```

On Windows, use `npm.cmd` and `npx.cmd` if PowerShell says that running
`npm.ps1` or `npx.ps1` is disabled. This avoids changing the computer's global
execution-policy setting.

## 2. Create the Supabase project

1. In Supabase, create a new project and choose a strong database password.
2. Open Project Settings → Data API and copy the Project URL and the
   **publishable** key. Do not copy a secret/service-role key.
3. In the project folder, copy `.env.example` to `.env.local` and replace the
   two Supabase placeholders:

```dotenv
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_your_key
```

4. Add the URL where you will host the Beta and, when available, the release
   links for your own repository:

```dotenv
NEXT_PUBLIC_TRACK_WEB_ORIGIN=https://your-pages-project.pages.dev
NEXT_PUBLIC_TRACK_RELEASES_URL=https://github.com/your-account/your-repo/releases/latest
NEXT_PUBLIC_TRACK_ISSUES_URL=https://github.com/your-account/your-repo/issues
```

The release and issue URLs may be left blank during the web-only Beta stage.
The source intentionally contains only these generic examples, never an
owner's real URL.

## 3. Apply the database and server functions

Install the Supabase CLI through the project with `npx`, then log in:

```powershell
npx.cmd supabase login
npx.cmd supabase link --project-ref your-project-ref
npx.cmd supabase db push
```

The CLI asks for confirmation before applying the SQL files in
`supabase/migrations/`. If the project reports that a migration version already
exists, stop and inspect the migration history in Supabase before retrying;
never delete production migration history to force a push.

Deploy the Edge Functions used by the app. `username-auth` intentionally has
gateway JWT verification disabled because it creates the session; the other
functions verify the caller at the Supabase gateway and again in their code:

```powershell
npx.cmd supabase functions deploy username-auth --no-verify-jwt
npx.cmd supabase functions deploy extract-workout
npx.cmd supabase functions deploy admin-member-data
npx.cmd supabase functions deploy admin-announcement
```

The admin directory also needs the `admin_users` migration included in this
source. `npx.cmd supabase db push` applies it with the other migrations. The
first administrator is the bootstrap account from `TRACK_ADMIN_USERNAME` and
`TRACK_ADMIN_USER_ID`. Once that account promotes another member, the server
stores the administrator roster in `public.admin_users` and the browser never
gets direct access to that table.

The `20260821_private_data_hardening.sql` migration is also required for a
secure deployment. It forces owner-scoped row-level security and removes
anonymous table access for profiles, splits, exercises, sets, notes, and workout
history. Supabase Auth owns passwords; Track never stores them in its tables.

The `20260826_track_announcements.sql` migration stores administrator
announcements server-side, and `20260827_private_sync_channels.sql` limits
Realtime broadcasts to the signed-in user's own private channel. Do not skip
these migrations; the app no longer uses a public cross-user broadcast channel.

In the admin member directory, open a member's `…` menu to promote or demote
them. The last remaining administrator cannot be demoted, so an installation
always keeps a way back into the admin panel. Role changes are server-side and
do not require rebuilding the web bundle.

Set the server-only configuration. Replace the example values with your own
values; do not put these in `.env.local` or in the browser source:

```powershell
npx.cmd supabase secrets set TRACK_ALLOWED_ORIGINS=https://your-pages-project.pages.dev TRACK_ADMIN_USERNAME=your-admin-username TRACK_ADMIN_USER_ID=your-auth-user-uuid TRACK_GEMINI_MODEL=gemini-2.5-flash
```

`TRACK_ALLOWED_ORIGINS` is a comma-separated list of exact site origins. The
admin username and UUID are required for the first administrator when you use
the admin panel. Use the username stored in that account's profile and find
its UUID in Supabase Authentication → Users. The functions reject requests
from origins that are not in this allowlist.
`TRACK_GEMINI_MODEL` is optional; omit it to use the app's tested default model.

## 4. Run the web Beta locally

Start the hosted-runtime development server:

```powershell
npm run dev
```

Open the local URL printed in the terminal, normally
`http://localhost:3000`. Create a test account and verify sign-in, saving,
calendar history, timer gestures, the bottom tabs, Settings, and the admin
panel if you enabled it.

## 5. Build and host it on Cloudflare Pages

Build the static web bundle:

```powershell
npm run build:pages
```

The upload folder is:

```text
work/cloudflare-pages
```

To host it without a paid plan:

1. Open Cloudflare Dashboard → Workers & Pages → Create application → Pages.
2. Choose **Direct Upload**.
3. Upload the contents of `work/cloudflare-pages` so `index.html` is at the
   top level.
4. Give the project its own Pages name and open the resulting URL.
5. Put that final URL in `NEXT_PUBLIC_TRACK_WEB_ORIGIN`, rebuild, and make sure
   it is also present in the `TRACK_ALLOWED_ORIGINS` Supabase secret.

If you change the public environment values, rebuild the Pages bundle. The
browser build cannot read a changed `.env.local` after it has already been
uploaded.

Create a named release archive and a rollback archive after the build:

```powershell
npm.cmd run package:pages:release
```

The files are written to `release-artifacts` with names like
`Track-II-web-v1.0-build-20260820-184500.zip` and
`Track-II-web-v1.0-rollback-20260820-184500.zip`. The command never
overwrites an existing archive. The rollback archive points to the previous
verified web build; on the first run it preserves the current verified build
as the initial rollback point. Upload the release ZIP for a new deployment or
upload the rollback ZIP to restore the previous version.

## 6. Check the source before sharing it

Run the same checks used for the Beta source:

```powershell
npm run typecheck
npm run lint
npm test
```

Before sharing, search the source and `.env` files for real project URLs,
personal email addresses, admin usernames, UUIDs, service keys, and passwords.
Keep `.env.local` private. The public source should contain only placeholders
such as `your-project`, `your-account`, and `your-repo`.

The web build intentionally shows a small `BETA` label while this stage is
being validated. The shared app hides that label when it runs inside a native
Capacitor APK or IPA, so native packages can use the same source without the
web-only Beta badge.

## Testing

The repository CI runs the same core checks used before a release:

```powershell
npm.cmd run typecheck
npm.cmd run lint
npm.cmd test
```

`npm.cmd test` covers the production build, rendered-source checks, and Rank
behavior tests. The optional `npm.cmd run test:e2e` command runs browser smoke
tests; authenticated sync cases require the dedicated test account described
in the [testing guide](docs/testing.md). Release validation also checks the
Cloudflare Pages build, maintainability budgets, and release packaging.

## Releases and changelog

Versioned notes live in [`release-notes/`](release-notes/), while published
downloads and native packages are attached to [GitHub Releases](https://github.com/nighth4wkg/Track-II-Gym-Tracker/releases).
The current release is [Track II v1.0.5](https://github.com/nighth4wkg/Track-II-Gym-Tracker/releases/tag/v1.0.5).

## Architecture and security review

The shared React client is used by both the Cloudflare Pages entry point and
the Capacitor native shells. Supabase Auth owns identity, owner-scoped RLS
protects workout data, and server-only Edge Functions hold service-role access
for administrator and AI-import operations. See the [architecture guide](docs/architecture.md)
and [security policy](SECURITY.md) before connecting a real Supabase project.

## Deployment stages

The source is public and the current web and native artifacts are published
through the [v1.0.5 GitHub Release](https://github.com/nighth4wkg/Track-II-Gym-Tracker/releases/tag/v1.0.5).
The web bundle is uploaded to Cloudflare Pages, while the native IPA/APK
artifacts are generated by the [Native Release workflow](https://github.com/nighth4wkg/Track-II-Gym-Tracker/actions/workflows/native-release.yml).
Keep the web `BETA` label until the deployed Supabase project has passed the
live RLS checks in [docs/supabase-rls-review.md](docs/supabase-rls-review.md)
and the device smoke tests in [docs/testing.md](docs/testing.md).

## Useful commands

```powershell
npm.cmd run dev          # local hosted-runtime development
npm.cmd run build        # hosted vinext/Cloudflare worker output
npm.cmd run build:pages  # static Cloudflare Pages upload bundle
npm.cmd run package:pages:release # named Pages ZIP plus rollback archive
npm.cmd run typecheck    # TypeScript validation
npm.cmd run lint         # ESLint plus anti-slop validation
npm.cmd test             # build plus source smoke tests
```

Track II is available under the [MIT License](LICENSE). Use your own Supabase
and Cloudflare projects when hosting your own copy.
