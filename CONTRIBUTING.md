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

## Regenerating the Rank anatomy asset

The interactive Rank map is generated, rather than hand-edited. The generator
uses the pinned `react-muscle-highlighter@1.2.0` MIT source paths and writes the
self-contained SVG to `app/assets/rank-muscle-map.svg`:

```bash
npm run generate:rank-map
```

The transformation and all Track-specific edits live in
`scripts/generate-rank-muscle-map.mjs`: it maps upstream regions to Track's six
muscle groups, fits the front and back views into the `900 x 600` viewBox,
replaces head/neck and neutral limb pieces with featureless neutral shapes,
removes facial/nipple details, and adds the semantic IDs, data attributes, and
keyboard interaction metadata used by the app. Do not edit the generated SVG
directly; change the generator so the asset remains reproducible. Review
upstream path changes after changing the dependency version, then run
`npm run generate:rank-map` and `npm run validate:release`.

## Pull requests

Describe the user-facing behavior, the files changed, and the checks you ran.
If a change touches Supabase migrations or Edge Functions, include the SQL or
function deployment step needed by reviewers.
