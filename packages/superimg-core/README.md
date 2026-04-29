# @superimg/core

Private workspace package for environment-agnostic SuperImg primitives.

This package is not published as a public API. User-facing code should import from the published `superimg` package instead:

```typescript
import { compileTemplate, createRenderContext } from "superimg/browser";
import { createRenderPlan, executeRenderPlan, PlaywrightEngine } from "superimg/server";
```

## Overview

This package provides the core rendering capabilities shared across browser and server environments:

- **Compiler** — `compileTemplate()` transforms template source into executable `TemplateModule`
- **Timeline** — `createRenderContext()` for building frame render contexts
- **HTML** — `buildCompositeHtml()` for background + template HTML
- **Constants** — Default width, height, fps, duration

### Server-Only Entry Points

These are separate entry points that require Node.js (not bundled into the browser-safe main export):

- **`@superimg/core/engine`** — `createRenderPlan()` and `executeRenderPlan()` for generic render orchestration with pluggable adapters
- **`@superimg/core/bundler`** — `bundleTemplate()` using esbuild (native)
- **`@superimg/core/bundler-browser`** — `bundleTemplate()` using esbuild-wasm (browser)

## Internal Usage

### Browser (compiler + context)

```typescript
import { compileTemplate, createRenderContext } from "@superimg/core";

const { template } = compileTemplate(templateCode);
const ctx = createRenderContext(frame, fps, totalFrames, width, height, data, outputName);
const html = template.render(ctx);
```

### Server (engine orchestration)

```typescript
import { createRenderPlan, executeRenderPlan } from "@superimg/core/engine";
import { PlaywrightEngine } from "@superimg/playwright";

const plan = createRenderPlan(renderJob);
const engine = new PlaywrightEngine();
const { renderer, encoder } = await engine.setup(plan);
const mp4 = await executeRenderPlan(plan, renderer, encoder);
await engine.teardown();
```

## Development

```bash
pnpm build   # Uses tsup.config.ts
pnpm dev     # Watch mode
pnpm test    # Run tests
```

## Dependencies

- `@superimg/types` — TypeScript interfaces and engine contracts
- `@superimg/stdlib` — Standard library (easing, math, color, etc.)
