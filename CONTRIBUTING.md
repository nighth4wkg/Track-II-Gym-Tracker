# Contributing to Track

Thanks for taking a look. Track is intentionally small and direct so the
workout workflow stays easy to review.

## Before opening a change

1. Keep secrets in `.env.local`; use `.env.example` for placeholders only.
2. Keep UI behavior in the shared `app/` source so the vinext and Pages entry
   points stay consistent.
3. Do not commit `dist/`, `work/`, `.wrangler/`, `node_modules/`, old upload
   archives, or generated Capacitor projects.
4. Preserve the stable Light and OLED Dark themes. Theme variants are frozen;
   future changes should focus on features, accessibility, and reliability.

## Validation checklist

Run these from the repository root:

```bash
npm run typecheck
npm run lint
npm test
npm run build:pages
```

For interaction changes, also check:

- mouse-wheel scrolling and click targets on desktop;
- portrait touch controls on iPhone, iPad, and Android;
- authenticated sync after editing the same split on two devices;
- a clean reload after a Pages deployment.

## Pull requests

Describe the user-facing behavior, the files changed, and the checks you ran.
If a change touches Supabase migrations or Edge Functions, include the SQL or
function deployment step needed by reviewers.
