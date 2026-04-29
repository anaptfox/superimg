# podcast-splash

Generate a podcast speaker splash intro and render it to **both** YouTube (1920×1080) and Reel (1080×1920) MP4s from a single responsive template.

```
  podcast-splash
  The Build Log · Ep. 042 · Jane Doe

  Rendering youtube (1920×1080)...
  [████████████████████████████] 100%
  ✓ Saved .../output/splash-youtube.mp4

  Rendering reel (1080×1920)...
  [████████████████████████████] 100%
  ✓ Saved .../output/splash-reel.mp4

  Done. 2 file(s) in .../output
```

## How it works

1. **One template** (`src/templates/splash.ts`) defines an animated splash scene.
2. The template uses `std.createResponsive(ctx)` and the `isPortrait` flag to branch its layout: photo-on-left for landscape, photo-on-top for portrait.
3. The CLI calls `renderVideo` once per target format, overriding `width` / `height`.
4. The same template's `config.outputs` declares the same presets, so it can also be rendered through SuperImg's CLI with `--presets`.

## Usage

From the monorepo root:

```bash
pnpm --filter podcast-splash dev
```

### Options

```
-o, --output <dir>       Output directory (default: ./output)
-f, --format <fmt>       youtube | reel | both (default: both)
    --podcast <name>     Podcast name
    --episode <number>   Episode number (e.g. "042")
    --title <text>       Episode title
    --speaker <name>     Speaker name
    --speaker-title <t>  Speaker role/title
    --photo <url>        Speaker photo URL
    --brand-color <hex>  Primary accent color (default: #FF4D6D)
    --accent-color <hex> Secondary accent color (default: #FFD166)
    --duration <sec>     Duration in seconds, 3-15 (default: 6)
-h, --help               Show this help
```

### Examples

```bash
# Both formats with the default speaker data
pnpm --filter podcast-splash dev

# Just the reel
pnpm --filter podcast-splash dev -- --format reel

# A real episode
pnpm --filter podcast-splash dev -- \
  --podcast "Latent Space" \
  --episode "133" \
  --title "Inside the inference stack" \
  --speaker "Ada Lovelace" \
  --speaker-title "Inference Lead, ExampleAI" \
  --photo "https://example.com/ada.jpg" \
  --brand-color "#7C3AED" \
  --accent-color "#22D3EE"
```

## Prerequisites

SuperImg renders headlessly through Playwright. Install Chromium once:

```bash
npx playwright install chromium
```

## File structure

```
src/
  cli.ts                  Arg parsing, format loop, progress bar
  templates/
    splash.ts             The responsive splash scene
```

## Why this example matters

This is a small, focused demo of **multi-output rendering** — the workflow most podcasters need:

- The **template** is written once and stays responsive via `r({ portrait, default })`
- The **app** drives both outputs in one run, no template duplication
- The same template also works under `superimg render --presets`, so the CLI loop is just one of two valid ways to drive it

For a richer end-to-end CLI app, see [`git-history-video`](../git-history-video/).
