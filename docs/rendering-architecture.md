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
│  @superimg/runtime    BrowserRenderer, BrowserEncoder           │
│  @superimg/core       Compiler, Context, HTML                   │
│  @superimg/stdlib     Easing, Math, Color, Text, etc.           │
│  @superimg/types      TypeScript interfaces                     │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

**Key Insight:** Playwright reuses `BrowserEncoder` (via the harness running inside headless Chromium) but captures frames differently—`PlaywrightFrameRenderer` uses `page.screenshot()` instead of Snapdom's `BrowserRenderer`.

---

## Browser Rendering

Direct client-side rendering using WebCodecs and Snapdom v2.

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
│  BrowserRenderer (private @superimg/runtime)                    │
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
│  BrowserEncoder (private @superimg/runtime)                     │
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
│  │     - Start Hono HTTP server for harness                  │   │
│  │     - Navigate to harness page                            │   │
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

Adapter layer (inside Chromium):

┌─────────────────────────────────────────────────────────────────┐
│  PlaywrightFrameRenderer          PlaywrightVideoEncoder        │
│  (FrameRenderer<Buffer>)          (VideoEncoder<Buffer>)        │
│                                                                 │
│  captureFrame(html) →             addFrame(buffer, ts) →        │
│    page.evaluate(set #frame html)   page.evaluate(addFrame)     │
│    page.screenshot()                (BrowserEncoder in harness) │
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
- **Server-only** (`./bundler`): Template bundling — requires `esbuild`, `fs`
- **Engine** (`./engine`): `createRenderPlan()`, `executeRenderPlan()` — browser-safe but exposed as a separate entry point for tree-shaking

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
│  │    sceneFrame: 45,         // defaults to global        │   │
│  │    sceneTimeSeconds: 1.5,  // for single-scene          │   │
│  │    sceneProgress: 0.3,                                  │   │
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
│  │  Templates use defineScene({ render, config, data })       │   │
│  │  Compiler extracts render, config, data from default       │   │
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
| `packages/superimg-runtime/src/renderer.ts` | `BrowserRenderer` - HTML to ImageData via Snapdom v2 (iframe isolation) |
| `packages/superimg-runtime/src/encoder.ts` | `BrowserEncoder` - ImageData to MP4 via WebCodecs |
| `packages/superimg-runtime/src/index.ts` | Private runtime exports bundled behind `superimg/browser` |

### Playwright Rendering

| File | Description |
|------|-------------|
| `packages/superimg-playwright/src/playwright-engine.ts` | `PlaywrightEngine` - Chromium lifecycle, Hono server, adapter factory |
| `packages/superimg-playwright/src/adapters.ts` | `PlaywrightFrameRenderer`, `PlaywrightVideoEncoder` - engine adapter implementations |
| `packages/superimg-playwright/src/harness/harness.ts` | Render harness (runs inside Chromium) |
| `packages/superimg-playwright/src/browser-utils.ts` | Browser install/check utilities |

### Core (Browser-Safe)

| File | Description |
|------|-------------|
| `packages/superimg-core/src/rendering/compiler.ts` | `compileTemplate()` - Template compilation, extracts data |
| `packages/superimg-core/src/rendering/wasm.ts` | `createRenderContext()` |
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
