# Track II — Gym Tracker

Track II is a privacy-focused workout tracker for planning sessions, recording sets, reviewing history, and understanding strength progress. The same React source powers the web app and Capacitor mobile builds.

## Features

- Workout splits with exercise search, sets, weight, reps, RIR, and editing.
- Automatic saving plus private realtime synchronization through Supabase.
- Calendar history, workout details, notes, and backup exports.
- Strength ranks by muscle group with an interactive anatomy view.
- Stopwatch, configurable rest timer, notifications, and haptics.
- Metric and imperial units, responsive layouts, and light/OLED themes.
- Optional AI-assisted workout import and private admin tools.

## Start locally

Requirements: Node.js 22.13 or newer and a Supabase project.

```powershell
npm.cmd install
Copy-Item .env.example .env.local
npm.cmd run dev
```

Fill the placeholders in `.env.local` with your own Supabase URL and publishable key. Never place a service-role key, database password, or signing certificate in browser environment variables or Git.

## Configure Supabase

Install or use the Supabase CLI, then link your own project and apply the included migrations:

```powershell
npx.cmd supabase login
npx.cmd supabase link --project-ref YOUR_PROJECT_REF
npx.cmd supabase db push --dry-run
npx.cmd supabase db push
```

Deploy only the Edge Functions your deployment uses. Set server-only values with `supabase secrets set`; do not add them to `.env.local`.

## Validate and deploy the web app

```powershell
npm.cmd run validate:release
npm.cmd run package:pages:release
```

The release command creates a Cloudflare Pages upload ZIP plus a rollback archive of the previous verified web build in `release-artifacts/`. Upload the release ZIP in the Cloudflare Pages dashboard, or deploy `work/cloudflare-pages` with Wrangler.

## Native builds

```powershell
npm.cmd run build:pages
npx.cmd cap add android
npx.cmd cap add ios
npx.cmd cap sync
npm.cmd run generate:native-icons
```

Android builds require Android Studio/JDK. iOS builds require macOS and Xcode. The included Native Release workflow produces an installable, debug-signed Android test APK and an unsigned iOS IPA; an App Store/TestFlight IPA still requires Apple signing. The shared `assets/icon-only.png` source generates the native icon resources.

## SideStore and AltStore

Add this source URL in SideStore or AltStore:

```text
https://github.com/nighth4wkg/Track-II-Gym-Tracker/releases/latest/download/altstore-source.json
```

SideStore or AltStore downloads the unsigned IPA from the latest GitHub release and signs it locally with your Apple account. Each future native release generates a matching source file automatically; update detection depends on the IPA version, not its release date.

## Privacy and security

This public source contains placeholders only. Local environment files, Supabase link metadata, build output, QA artifacts, platform-hosting metadata, and signing materials are excluded. Review Supabase Row Level Security policies before allowing real users.

## License

No license is granted yet. Add the license you want before inviting third-party contributions or redistribution.
