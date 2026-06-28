# Testing Templates

SuperImg captures stills via the same encoder path as image output — no separate `renderStill` API. Capture a single video frame as HTML (fast, CI-friendly) or as a raster image (Playwright + Sharp).

## CLI

```bash
# HTML snapshot at frame 45 (no browser)
superimg render my.media.ts --format html --frame 45

# PNG still at frame 45
superimg render my.media.ts --format png --frame 45

# Progress-based (0–1) instead of frame index
superimg render my.media.ts --format html --progress 0.5
```

For static templates (no `fps`/`duration` in config), add `--format png`. For animated templates, add `--frame` or `--progress`.

## Programmatic

### Fast HTML snapshots (no Playwright)

```typescript
import { renderToHtml } from "superimg";
import { renderHtmlAtFrame } from "@superimg/core/testing";

// Edge / Workers — compile or pass a module
const html = renderToHtml({ template: bundledCode, frame: 45, fps: 30, durationSeconds: 5 });

// In tests — pass a compiled module
const snapshot = renderHtmlAtFrame(template, { progress: 0.5, composite: false });
```

`renderHtmlAtFrame` merges `template.sample` with optional `data` and binds `timeline` + `ctx.director()` at the requested frame.

### Pixel snapshots (Playwright)

```typescript
import { renderVideo } from "superimg/server";

const png = await renderVideo("./intro.media.ts", {
  frame: 45,
  encoding: { format: "png" },
});
```

Uses `createRenderPlan({ startFrame, endFrame: startFrame + 1 })` under the hood — the same path as full video render, but only one frame.

## Vitest pattern

```typescript
import { describe, it, expect } from "vitest";
import { compileFromString } from "./__test-utils__/index.js";
import { renderHtmlAtFrame } from "@superimg/core/testing";

describe("keyframes", () => {
  it("matches snapshots", async () => {
    const { template } = await compileFromString(TEMPLATE_SOURCE);
    for (const progress of [0, 0.25, 0.5, 0.75, 1]) {
      const html = renderHtmlAtFrame(template!, { progress, composite: false });
      expect(html).toMatchSnapshot(`progress=${progress}`);
    }
  });
});
```

Use `composite: false` when you only want the scene HTML (no background/watermark wrapper).

## When to use which

| Goal | API |
|------|-----|
| CI HTML regression | `renderHtmlAtFrame` or `renderToHtml({ frame })` |
| Visual pixel diff | `renderVideo({ frame, encoding: { format: "png" } })` |
| Static OG card | `define()` (no fps/duration) + `--format png` |
| Embedded video in frame | `std.video.sync` — Playwright seeks before capture |