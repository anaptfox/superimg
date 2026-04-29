# podcast-splash

The canonical SDK demo of **`renderBatch`** — render the same template once per data entry, across every declared output preset, in one Playwright session.

```
  podcast-splash — 2 speaker(s) × 2 formats
  [4/4] ada-lovelace (reel) 100%

  ✓ Jane Doe
      youtube  → output/splash-jane-doe-youtube.mp4
      reel     → output/splash-jane-doe-reel.mp4
  ✓ Ada Lovelace
      youtube  → output/splash-ada-lovelace-youtube.mp4
      reel     → output/splash-ada-lovelace-reel.mp4
```

## How it works

- **One template** — `src/templates/splash.video.ts` — declares `config.outputs: { youtube, reel }` and uses `std.createResponsive(ctx)` so the layout adapts per orientation.
- **One JSON** — `speakers.json` — an array of speaker entries. Each entry's fields become the template's `data`. The `slug` field (or `name`, falling back to index) drives the per-entry filename suffix.
- **One call** — `renderBatch(templatePath, { dataset, presets: true })` — boots Playwright + bundles the template **once**, then renders `entries × presets` MP4s.

## Usage

From the monorepo root:

```bash
pnpm --filter podcast-splash dev
```

### Edit the data

Edit `speakers.json` to add/remove speakers. Re-run.

### Equivalent direct CLI invocation

The same flow runs through `superimg render --data`:

```bash
superimg render examples/apps/podcast-splash/src/templates/splash.video.ts \
  --data examples/apps/podcast-splash/speakers.json \
  --presets -y
```

### Options

```
-d, --data <path>     Path to speakers JSON (default: ./speakers.json)
-o, --output <dir>    Output directory (default: next to template)
-f, --format <fmt>    youtube | reel | both (default: both)
-h, --help            Show help
```

## Prerequisites

```bash
npx playwright install chromium
```

## Why this example matters

The whole demo is a **template + a JSON file + a tiny argv loop**. Everything else — bundling, Playwright, multi-output presets, slug-based naming, single-engine reuse — comes from `renderBatch`. That's the SDK shape we want for the catalog/per-row use case: people add a JSON file and ship.
