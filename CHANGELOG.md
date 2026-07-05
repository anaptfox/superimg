# Changelog

## 0.0.21 — Unreleased

**Breaking:** Browser player preview uses `superimg/media` with iframe + morphdom instead of canvas frame caching.

- `Player.destroy()` → `Player.dispose()`
- `seekToFrame()` → `seekFrame()`
- `setData()` / `setFormat()` → `update({ data })` / `update({ format })`
- Removed `maxCacheFrames` and `captureFrame()` from `Player`
- `PlaybackMode` no longer includes `"ping-pong"` (use `std.math.pingPong()` in templates for motion)
- Removed unused `BrowserScheduler` export from `@superimg/runtime`
- `Player.store` — Zustand store for vanilla timeline/shortcut integrations; React controls use `getRuntimeStore()`

**Breaking:** Audio config is clip-based only — `AudioOptions` and bare `audio: "path.mp3"` are removed.

Migrate `audio: { src, volume, fadeIn: 0.5, fadeOut: 2, loop }` to an `AudioClip`:

```typescript
audio: {
  id: "bed",
  src: "assets/bed.mp3",
  role: "music",
  volume: 0.5,
  fadeIn: "0.5s",
  fadeOut: "2s",
  loop: true,
}
```

Multi-track: `audio: { clips: [...], mix: { ducking: true } }`. Compose scenes accept `scene(..., { audio })` with `atScene` defaulting to the scene id. See `docs/audio.md`.

**Breaking:** Unified template model — all output kinds use a single `define()` factory and `*.media.ts` filename.

### Migration guide

**Rename your files:**
```
template.video.ts  →  template.media.ts
template.image.ts  →  template.media.ts
template.gif.ts    →  template.media.ts
template.svg.ts    →  template.media.ts
```

**Replace the factory call:**
```typescript
// Before
import { defineScene, defineImage, defineGif, defineSvg } from "superimg";
export default defineScene({ ... })

// After
import { define } from "superimg";
export default define({ ... })   // output kind is inferred from config
```

Output kind is now config-driven:
| Output | Signal |
|--------|--------|
| MP4 / WebM | `fps` + `duration` in config |
| GIF | `fps` + `duration` + `--format gif` at render time |
| PNG / WebP / JPEG | no `fps` or `duration` |
| SVG | `medium: "svg"` in config |

**Rename `defaults` / `data` (define-time) to `sample`:**
```typescript
// Before
defineScene({ defaults: { title: "Hello" } })
defineScene({ data: { title: "Hello" } })      // 0.0.13 intermediate name

// After
define({ sample: { title: "Hello" } })
```

Note: `ctx.data` at render time is unchanged — this only affects the static fallback field inside `define()`.

**CLI rejects legacy extensions with a rename hint.** The `superimg list` and `superimg render` commands only discover `*.media.ts` / `*.media.js` files. Running them against an old `*.video.ts` path prints a clear migration message.

---

## 0.0.20 — 2026-04-12

- Fix CI GIF rendering: install ffmpeg via apt before render step — `ubuntu-latest` does not ship ffmpeg by default
- Add ffmpeg install to reusable `render` action for external users

## 0.0.19 — 2026-04-12

- Fix invisible CI render errors: non-TTY environments (CI, pipes) now bypass Ink and use the programmatic `renderVideo()` API directly — errors go to stderr and are always visible in logs

## 0.0.18 — 2026-04-12

- Fix CI render failure: `checkPlaywrightAvailable` now uses `PlaywrightEngine.checkBrowser()` instead of `import("playwright")` directly — the direct import failed in pnpm's isolated store since `playwright` is owned by `@superimg/playwright`, not `apps/superimg`

## 0.0.17 — 2026-04-12

- Add Playwright install note to README

## 0.0.16 — 2026-04-12

- Fix GIF corruption in CI: `ffmpeg-gif-encoder` now uses `-filter_complex "[0:v][1:v]paletteuse"` with explicit stream specifiers instead of `-lavfi` which was ambiguous with two inputs across ffmpeg versions
- Fix `renderVideo()` programmatic API: encoding options now correctly passed to `createAdapters()` so GIF output works via the public API (not just the CLI)
- Add GIF output format: `--format gif`, `--max-colors`, `--gif-loop`, `--gif-dither` CLI flags
- Migrate CLI commands to `execa`

## 0.0.15 — 2026-04-12

- Changelog video now renders as GIF and commits back to `videos/changelog/changelog.gif` automatically on every CHANGELOG.md change — embeddable directly in README
- Reusable action gains `format` (mp4/webm/gif) and `commit-back` inputs for external users
- Actor guard prevents infinite CI loop when bot pushes the rendered GIF back

## 0.0.14 — 2026-04-12

- Add `std.svg` module: draw, filter, morph, reveal, shape, textPath, segments
- Add `std.path` module for SVG path utilities
- `std.css()` now variadic — mix style objects and preset strings in one call
- `std.motion.enterExit()` adds `exitEasing` option
- Fix GitHub Actions CI: run `playwright install` via `pnpm --filter @superimg/playwright exec` so it resolves from the package that actually owns the dependency
- CI build uses `pnpm -r --filter 'superimg...'` — only builds packages needed for the render CLI, skipping player, MCP, and React app
- CI Playwright caching: cache key tied to playwright package version (not full lockfile), browser binary skipped on cache hit (~60s saved per run), OS deps always installed separately

## 0.0.13 — 2026-04-10

**Breaking:** `defaults` renamed to `data` in `defineScene()`.

```typescript
// Before
defineScene({ defaults: { title: "Hello" } })
// After
defineScene({ data: { title: "Hello" } })
```

- Rename `defaults` to `data` in defineScene — the field matches `ctx.data`
- Add companion `.data.ts` file support for dynamic data loading
- Add reusable GitHub Action for CI video rendering
- Templates using `defaults` get a clear migration error

## 0.0.12 — 2026-04-08

- Add companion `.data.ts` file support for templates
- Add reusable GitHub Action for CI rendering
- Improve asset preloading for video and audio files

## 0.0.11 — 2026-03-25

- Add MCP server for AI-powered video generation
- New stdlib utilities: `std.motion`, `std.phases`, `std.montage`
- Expand animation easing library with spring physics

## 0.0.10 — 2026-03-10

- Introduce `compose()` for multi-scene videos
- Add `_config.ts` cascading configuration
- Support output presets (`--preset`, `--presets`)

## 0.0.9 — 2026-02-20

- Add Tailwind CSS support in templates
- Watermark and background overlay options
- WebM output format with VP9/AV1 codecs

## 0.0.8 — 2026-02-05

- New `superimg dev` server with hot reload
- Asset system for images, video, and audio
- Karaoke/transcript sync with ElevenLabs
