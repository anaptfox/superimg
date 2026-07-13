# Rendering Architecture

SuperImg supports two rendering modes: **Browser** (client-side) and **Playwright** (server-side). Both share the same core rendering engine.

This document describes internal workspace architecture. User-facing code should import from the published `superimg` package and its public subpaths.

## Table of Contents

- [Overview](#overview)
- [Browser Rendering](#browser-rendering)
- [Playwright Rendering](#playwright-rendering)
- [Shared Infrastructure](#shared-infrastructure)
- [Data Flow](#data-flow)
- [Key Files Reference](#key-files-reference)

---

## Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                                                                 │
│                      YOUR APPLICATION                           │
│                                                                 │
├────────────────────────────┬────────────────────────────────────┤
│                            │                                    │
│     Browser Rendering      │       Playwright Rendering         │
│     (Client-Side)          │       (Server-Side)                │
│                            │                                    │
│  - Real-time preview       │  - Batch video generation          │
│  - Interactive editing     │  - CLI rendering                   │
│  - Streaming export        │  - Deterministic output            │
│                            │                                    │
├────────────────────────────┴────────────────────────────────────┤
│                                                                 │
│              PRIVATE WORKSPACE IMPLEMENTATION                   │
│                                                                 │
│  @superimg/media        MediaSession, DOM surface             │
│  @superimg/browser-export SnapDOM capture, browser encoding   │
│  @superimg/node         Server render runtime                 │
│  @superimg/player       Player (store + timeline controls)    │
│  @superimg/core         Compiler, Context, HTML               │
│  @superimg/stdlib     Easing, Math, Color, Text, etc.           │
│  @superimg/types      TypeScript interfaces                     │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

**Key Insight:** Playwright reuses `BrowserEncoder` (via the harness running inside headless Chromium) but captures frames differently—`PlaywrightFrameRenderer` uses `page.screenshot()` instead of Snapdom's `BrowserRenderer`.

### Preview vs Capture (browser)

| Path | Package | Output | Use case |
|------|---------|--------|----------|
| **Preview / playback** | `@superimg/media` | Live DOM (iframe + morphdom) | `Player`, docs editor, `superimg dev` |
| **Browser export** | `@superimg/browser-export` | MP4/WebM blob via SnapDOM + WebCodecs | Playground export, dev-ui export |
| **Server CLI** | `@superimg/node` | MP4 on disk | `superimg render` |

`@superimg/player` sits above `MediaSession`: media owns playback/render state, while player owns UI state (`player.store`) and checkpoint navigation. React controls use `getRuntimeStore()` as a thin adapter over the same store.

---

## Browser Rendering

Client-side rendering has two tiers: **media playback** (`@superimg/media`) and **capture/encode** (`@superimg/browser-export`).

### Media Playback

```
Template.render(ctx) → buildCompositeHtml → MediaSession DOM surface (morphdom)
```

- No per-frame rasterization during preview
- `requestAnimationFrame` driven by `Player` store + playback controller
- Sandboxed iframe; Tailwind CDN requires `allow-scripts`

### Capture / Encode (runtime)

Direct client-side pixel pipeline using WebCodecs and Snapdom v2.

### Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                      BROWSER CONTEXT                            │
│                                                                 │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────────────┐  │
│  │  Template   │───▶│  Compiler   │───▶│  TemplateModule     │  │
│  │  (string)   │    │             │    │  { render(ctx) }    │  │
│  └─────────────┘    └─────────────┘    └──────────┬──────────┘  │
│                                                   │             │
│                                                   ▼             │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                    RENDER LOOP                           │   │
│  │                                                          │   │
│  │  for frame in 0..totalFrames:                           │   │
│  │    ┌─────────────────────────────────────────────────┐  │   │
│  │    │  ctx = createRenderContext(frame, fps, ...)     │  │   │
│  │    │  html = template.render(ctx)                    │  │   │
│  │    │  imageData = BrowserRenderer.render(html)       │  │   │
│  │    │  BrowserEncoder.addFrame(imageData)             │  │   │
│  │    └─────────────────────────────────────────────────┘  │   │
│  │                                                          │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                   │             │
│                                                   ▼             │
│                                        ┌─────────────────┐      │
│                                        │   MP4 Buffer    │      │
│                                        └─────────────────┘      │
└─────────────────────────────────────────────────────────────────┘
```

### Components

```
┌─────────────────────────────────────────────────────────────────┐
│  BrowserRenderer (private @superimg/runtime-web)                │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  HTML String                                                    │
│       │                                                         │
│       ▼                                                         │
│  ┌─────────────────────────────────────┐                       │
│  │  Offscreen <iframe>                 │                       │
│  │  (positioned at -9999px, -9999px)   │                       │
│  │                                     │                       │
│  │  ┌───────────────────────────────┐  │                       │
│  │  │  Real <body> (CSS works       │  │                       │
│  │  │  natively - flex, grid, etc)  │  │                       │
│  │  │  ┌─────────────────────────┐  │  │                       │
│  │  │  │  Rendered HTML Content  │  │  │                       │
│  │  │  └─────────────────────────┘  │  │                       │
│  │  └───────────────────────────────┘  │                       │
│  └─────────────────────────────────┬───┘                       │
│                                    │                            │
│                                    ▼                            │
│                              ┌───────────┐                      │
│                              │ Snapdom 2 │                      │
│                              │(DPR=1,    │                      │
│                              │ cache=full)│                     │
│                              └─────┬─────┘                      │
│                                    │                            │
│                                    ▼                            │
│                              ┌───────────┐                      │
│                              │ ImageData │                      │
│                              └───────────┘                      │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│  BrowserEncoder (private @superimg/runtime-web)                 │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ImageData                                                      │
│       │                                                         │
│       ▼                                                         │
│  ┌─────────────┐    ┌──────────────────────────┐               │
│  │   Canvas    │───▶│ CanvasSource             │               │
│  │ putImageData│    │ (mediabunny, WebCodecs)   │               │
│  └─────────────┘    └────────────┬─────────────┘               │
│                                  │                               │
│                                  ▼                               │
│                     ┌─────────────────────────────────┐        │
│                     │  Mediabunny BufferTarget        │        │
│                     │  - Codec: AVC/VP9/AV1           │        │
│                     │  - Bitrate: QUALITY_HIGH (cfg)  │        │
│                     │  - Keyframe: every 5 sec (cfg)  │        │
│                     └───────────────┬─────────────────┘        │
│                                     │                           │
│                                     ▼                           │
│                              ┌─────────────┐                    │
│                              │ MP4 Buffer  │                    │
│                              │ (Uint8Array)│                    │
│                              └─────────────┘                    │
└─────────────────────────────────────────────────────────────────┘
```

### Usage

```typescript
import {
  BrowserRenderer,
  BrowserEncoder,
  compileTemplate,
  createRenderContext,
} from 'superimg/browser';

const renderer = new BrowserRenderer();
const encoder = new BrowserEncoder(1920, 1080, 30);

const { template } = compileTemplate(templateCode);

for (let frame = 0; frame < totalFrames; frame++) {
  const ctx = createRenderContext(frame, 30, totalFrames, 1920, 1080);
  const html = template.render(ctx);
  const imageData = await renderer.render(html, { width: 1920, height: 1080 });
  const timestamp = frame / 30;
  await encoder.addFrame(imageData, timestamp);
}

const blob = await encoder.finalize(); // Returns Blob
```

---

## Playwright Rendering

Server-side rendering uses headless Chromium orchestrated from Node.js. Public code imports from `superimg/server`; internally, orchestration lives in private `@superimg/core` code and adapters live in private `@superimg/playwright` code.

### Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                       NODE.JS PROCESS                           │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  1. createRenderPlan(job)         (@superimg/core)       │   │
│  │     → compile templates, collect fonts, calc totalFrames │   │
│  └────────────────────────┬────────────────────────────────┘   │
│                           │                                     │
│                           ▼                                     │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  2. PlaywrightEngine                (@superimg/playwright) │   │
│  │     engine.init():                                        │   │
│  │     - Launch Chromium (headless, DPR=1, frozen clock)     │   │
│  │     - Start Hono HTTP server for local assets             │   │
│  │     - Reuse Chromium pages or isolated render contexts    │   │
│  │     engine.createAdapters():                              │   │
│  │     - Return { renderer, encoder } adapters               │   │
│  └────────────────────────┬────────────────────────────────┘   │
│                           │                                     │
│                           ▼                                     │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  3. executeRenderPlan(plan, renderer, encoder)           │   │
│  │     (@superimg/core — generic frame loop)                │   │
│  │                                                          │   │
│  │  for frame in 0..totalFrames:                           │   │
│  │    ctx = createRenderContext(frame, fps, ...)           │   │
│  │    html = template.render(ctx)                          │   │
│  │    compositeHtml = buildCompositeHtml(html, bg, w, h)   │   │
│  │    capturedFrame = renderer.captureFrame(compositeHtml)  │   │
│  │    encoder.addFrame(capturedFrame, timestamp)            │   │
│  │    onProgress(frame, totalFrames)                       │   │
│  │                                                          │   │
│  │  return encoder.finalize() → Uint8Array                 │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘

Adapter layer:

┌─────────────────────────────────────────────────────────────────┐
│  PlaywrightFrameRenderer          NodeVideoEncoder              │
│  (FrameRenderer<Buffer>)          (VideoEncoder<Buffer>)        │
│                                                                 │
│  captureFrame(html) →             addFrame(buffer, ts) →        │
│    page.evaluate(set #frame html)   decode PNG in Node          │
│    page.screenshot()                feed Mediabunny source      │
│    → Buffer (PNG)                                               │
│                                   finalize() →                  │
│                                     page.evaluate(finalize)     │
│                                     → Uint8Array (MP4)          │
└─────────────────────────────────────────────────────────────────┘
```

### Usage

```bash
# Render a template to video via CLI
superimg render template.js -o video.mp4
```

### Engine API

For programmatic rendering, use the engine directly:

```typescript
import { createRenderPlan, executeRenderPlan, PlaywrightEngine } from 'superimg/server';

const plan = createRenderPlan(renderJob);
const engine = new PlaywrightEngine();

try {
  await engine.init();
  const { renderer, encoder } = engine.createAdapters();
  const mp4 = await executeRenderPlan(plan, renderer, encoder, {
    onProgress: ({ frame, totalFrames }) => {
      console.log(`${frame}/${totalFrames}`);
    },
  });
  await fs.writeFile('output.mp4', mp4);
} finally {
  await engine.dispose();
}
```

---

## Shared Infrastructure

### Private Package Dependencies

Only `superimg` is published. The `@superimg/*` packages shown here are private workspace packages used to keep the implementation modular.

```
┌─────────────────────────────────────────────────────────────────┐
│                                                                 │
│                   superimg (public API)                         │
│           server: Engine + PlaywrightEngine                     │
│           browser: Player + runtime                             │
│                           │                                     │
│         ┌─────────────────┼─────────────────┐                  │
│         │                 │                 │                   │
│         ▼                 ▼                 ▼                   │
│  ┌─────────────┐  ┌─────────────┐  ┌──────────────┐           │
│  │ @superimg/  │  │ @superimg/  │  │ @superimg/   │           │
│  │ playwright  │  │ core        │  │ runtime      │           │
│  │             │  │             │  │              │           │
│  │ Playwright  │  │ .           │  │ Browser      │           │
│  │ Engine      │  │   (browser  │  │ Renderer     │           │
│  │ Frame       │  │    -safe)   │  │ Browser      │           │
│  │ Renderer    │  │ Compiler    │  │ Encoder      │           │
│  │ Video       │  │ Context     │  └──────┬───────┘           │
│  │ Encoder     │  │ HTML        │         │                    │
│  │             │  │ Utilities   │         │                    │
│  │ (adapters)  │  │             │         │                    │
│  └──────┬──────┘  │ ./engine    │         │                    │
│         │         │   (server)  │         │                    │
│         │         │ RenderPlan  │         │                    │
│         │         │ Orchestrate │         │                    │
│         │         └──────┬──────┘         │                    │
│         │                │                │                    │
│         │      ┌─────────┴─────────┐      │                    │
│         │      │                   │      │                    │
│         │      ▼                   ▼      │                    │
│         │ ┌───────────┐     ┌──────────┐  │                    │
│         │ │ @superimg/│     │@superimg/│  │                    │
│         │ │ types     │     │ stdlib   │  │                    │
│         │ │           │     │          │  │                    │
│         │ │ Render    │     │ easing   │  │                    │
│         │ │ Context   │     │ math     │  │                    │
│         │ │ Template  │     │ color    │  │                    │
│         │ │ Engine    │     │ text     │  │                    │
│         │ │ contracts │     │ timing   │  │                    │
│         └▶│           │     │ ...      │◀─┘                    │
│           └───────────┘     └──────────┘                       │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

**Key architectural boundary:** private `@superimg/core` has two kinds of entry points:
- **Browser-safe** (`.`): Compiler, context, HTML utilities — no Node.js deps
- **Server-only** (`./bundler`): Template bundling — requires `rolldown`, `fs`
- **Engine** (`./engine`): `createRenderPlan()`, `executeRenderPlan()` — browser-safe but exposed as a separate entry point for tree-shaking

### Template bundler (`import … from "superimg"`)

Templates are real ESM. The bundler plugin maps bare `superimg` / `superimg/define` to **built modules**, not hand-written JS strings:

| Path | Resolve target |
|------|----------------|
| **Server** (`@superimg/core/bundler`) | Real files: `@superimg/core/template-runtime`, `superimg/define`, stdlib dist |
| **Browser** (`superimg/bundler-browser` / `@superimg/core/bundler-browser`) | Virtual modules filled at **build time** from those same sources (`scripts/build-browser-virtuals.mjs` → cacheable `.generated/browser-virtuals.ts`, then folded into published dist) |

Canonical `define()` lives only in `@superimg/types`. Integrity: `pnpm --filter @superimg/core run verify:generated` (also wired into `just check`).

### RenderContext Flow

```
┌─────────────────────────────────────────────────────────────────┐
│  RenderContext Creation                                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  createRenderContext(frame, fps, totalFrames, width, height)    │
│                           │                                     │
│                           ▼                                     │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  RenderContext (base)                                    │   │
│  │  {                                                       │   │
│  │    std: stdlib,                                         │   │
│  │    globalFrame: 45,                                     │   │
│  │    globalTimeSeconds: 1.5,                              │   │
│  │    totalFrames: 150,                                    │   │
│  │    timeline: {                                          │   │
│  │      frame: 45, progress: 0.3,                          │   │
│  │      seconds: 1.5,  // progress × durationSeconds       │   │
│  │    },                                                   │   │
│  │    director: (phases?) => Director,                   │   │
│  │    fps: 30,                                             │   │
│  │    width: 1920,                                         │   │
│  │    height: 1080,                                        │   │
│  │    data: {},                                            │   │
│  │  }                                                       │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## Data Flow

### Complete Rendering Pipeline

```
┌─────────────────────────────────────────────────────────────────┐
│                                                                 │
│  INPUT                                                          │
│  ─────                                                          │
│  Template code (string)                                         │
│                                                                 │
│                           │                                     │
│                           ▼                                     │
│  ┌─────────────────────────────────────────────────────────┐   │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  COMPILE                                                 │   │
│  │  compileTemplate(code) → TemplateModule { render() }     │   │
│  │                                                          │   │
│  │  Templates use define({ render, config, sample })          │   │
│  │  Compiler extracts render, config, sample from default     │   │
│  │                                                          │   │
│  │  Injects: std (stdlib namespace)                         │   │
│  └────────────────────────┬────────────────────────────────┘   │
│                           │                                     │
│                           ▼                                     │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  MERGE DATA                                              │   │
│  │  { ...template.data, ...incomingData } → ctx.data       │   │
│  └────────────────────────┬────────────────────────────────┘   │
│                           │                                     │
│                           ▼                                     │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  CALCULATE FRAMES                                        │   │
│  │  totalFrames = Math.ceil(duration * fps)          │   │
│  └────────────────────────┬────────────────────────────────┘   │
│                           │                                     │
│                           ▼                                     │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  RENDER LOOP                                             │   │
│  │                                                          │   │
│  │  for frame in 0..totalFrames:                           │   │
│  │                                                          │   │
│  │    ┌──────────────────────────────────────────────────┐ │   │
│  │    │ createRenderContext(frame, fps, totalFrames,    │ │   │
│  │    │                     width, height, data)        │ │   │
│  │    │     → RenderContext { data, scene*, ... }       │ │   │
│  │    └──────────────────────┬───────────────────────────┘ │   │
│  │                           │                              │   │
│  │    ┌──────────────────────▼───────────────────────────┐ │   │
│  │    │ template.render(ctx)                             │ │   │
│  │    │     → HTML string                                │ │   │
│  │    └──────────────────────┬───────────────────────────┘ │   │
│  │                           │                              │   │
│  │    ┌──────────────────────▼───────────────────────────┐ │   │
│  │    │ BrowserRenderer.render(html)                     │ │   │
│  │    │     → ImageData                                  │ │   │
│  │    └──────────────────────┬───────────────────────────┘ │   │
│  │                           │                              │   │
│  │    ┌──────────────────────▼───────────────────────────┐ │   │
│  │    │ BrowserEncoder.addFrame(imageData)               │ │   │
│  │    │     → encoded video frame                        │ │   │
│  │    └──────────────────────────────────────────────────┘ │   │
│  │                                                          │   │
│  └────────────────────────┬────────────────────────────────┘   │
│                           │                                     │
│                           ▼                                     │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  FINALIZE                                                │   │
│  │  encoder.finalize() → Uint8Array (MP4)                   │   │
│  └────────────────────────┬────────────────────────────────┘   │
│                           │                                     │
│                           ▼                                     │
│  OUTPUT                                                         │
│  ──────                                                         │
│  MP4 file or Buffer                                             │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## Key Files Reference

### Browser Rendering

| File | Description |
|------|-------------|
| `packages/superimg-runtime-web/src/renderer.ts` | `BrowserRenderer` - HTML to ImageData via Snapdom v2 (iframe isolation) |
| `packages/superimg-runtime-web/src/encoder.ts` | `BrowserEncoder` - ImageData to MP4 via WebCodecs |
| `packages/superimg-runtime-web/src/index.ts` | Private runtime exports bundled behind `superimg/browser` |

### Playwright Rendering

| File | Description |
|------|-------------|
| `packages/superimg-playwright/src/playwright-engine.ts` | `PlaywrightEngine` - Chromium lifecycle, Hono server, adapter factory |
| `packages/superimg-playwright/src/adapters.ts` | `PlaywrightFrameRenderer` - Chromium frame capture adapter |
| `packages/superimg-playwright/src/node-encoder.ts` | `NodeVideoEncoder` - active server video encoder |
| `packages/superimg-playwright/src/browser-utils.ts` | Browser install/check utilities |

### Core (Browser-Safe)

| File | Description |
|------|-------------|
| `packages/superimg-core/src/rendering/compiler.ts` | `compileTemplate()` - Template compilation, extracts data |
| `packages/superimg-core/src/rendering/create-render-context.ts` | `createRenderContext()` |
| `packages/superimg-core/src/html/html.ts` | `buildCompositeHtml()` — background + template HTML compositing |
| `packages/superimg-core/src/shared/constants.ts` | Default width, height, fps, duration |

### Core (Server-Only Entry Points)

| File | Description |
|------|-------------|
| `packages/superimg-core/src/rendering/engine.ts` | `createRenderPlan()`, `executeRenderPlan()` - generic render orchestration |

### Types

| File | Description |
|------|-------------|
| `packages/superimg-types/src/types.ts` | `RenderContext`, `TemplateModule`, etc. |
| `packages/superimg-types/src/engine.ts` | `RenderEngine`, `FrameRenderer`, `VideoEncoder`, `RenderPlan`, `RenderJob` |

---

## Comparison

| Aspect | Browser | Playwright |
|--------|---------|------------|
| **Environment** | Client JavaScript | Node.js + Chromium |
| **Entry Point** | `BrowserRenderer` + `BrowserEncoder` | `createRenderPlan()` + `executeRenderPlan()` |
| **Template** | Single template | Single template |
| **Determinism** | Browser clock | Frozen time (2025-01-01) |
| **Use Case** | Preview, streaming | Batch generation, CLI |
| **Dependencies** | None (runs in browser) | Playwright, Chromium |

---

## See Also

- [Project Configuration](./project-config.md) - Cascading config and video discovery
