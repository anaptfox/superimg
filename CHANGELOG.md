# Changelog

## 0.0.14 — 2026-04-11

- Add `std.svg` module: draw, filter, morph, reveal, shape, textPath, segments
- Add `std.path` module for SVG path utilities
- `std.css()` now variadic — mix style objects and preset strings in one call
- `std.motion.enterExit()` adds `exitEasing` option
- Fix GitHub Actions CI: run `playwright install` via `pnpm --filter @superimg/playwright exec` so it resolves from the package that actually owns the dependency
- CI build now uses `build:render` — only builds packages needed for the render CLI using `pnpm -r --filter 'superimg...'`, skipping player, MCP, and React app

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
