# Blog to Video

Paste a blog URL. Get a karaoke read-along video.

This example turns existing writing into a short social clip: scrape the article, estimate word timings, preview in the browser, and export MP4. No AI, no narration — the active phrase highlights like karaoke captions.

## Quick start (web)

From the monorepo root:

```bash
just install
just example apps/blog-to-video
```

Open [http://localhost:3000](http://localhost:3000). Paste a URL or click **Try sample text** for an offline demo.

## CLI (headless render)

Requires Playwright (`npx superimg setup` or `just setup`):

```bash
cd examples/apps/blog-to-video

# Local fixture
pnpm cli -- --text fixtures/sample.txt

# Live URL
pnpm cli -- https://example.com/blog/post

# Options
pnpm cli -- --help
```

## Options (CLI)

```text
pnpm cli -- <url> [options]

  --text <path>          Local .txt or .html instead of a URL
  -f, --format <fmt>     horizontal | vertical | square (default: vertical)
  --wpm <number>         Reading speed 90–180 (default: 128)
  --max-words <number>   Words to include 40–420 (default: 140)
  -o, --output <file>    Output path (default: output/blog-to-video.mp4)
```

## Architecture

```
URL → POST /api/scrape (server fetch + Readability)
    → buildKaraokeData (WPM timings)
    → <Player template={karaokeTemplate} data={…} />
    → usePlaygroundExport → MP4 download
```

| File | Role |
|------|------|
| `lib/article.ts` | Fetch + Mozilla Readability extraction |
| `lib/timing.ts` | Tokenize text → word-level `start`/`end` |
| `lib/template.ts` | SuperImg `define()` karaoke template |
| `app/api/scrape/route.ts` | Server-side scrape (avoids browser CORS) |
| `app/page.tsx` | URL input, preview, export |
| `scripts/cli.ts` | Headless `renderVideo` via `superimg/server` |

## Prerequisites

- **Web preview + export:** modern browser only
- **CLI render:** `npx superimg setup` (Playwright Chromium)