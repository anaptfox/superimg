# Testing Templates

SuperImg captures stills via the same encoder path as image output — no separate `renderStill` API. For **agent debug loops**, prefer **`superimg inspect`** over ad-hoc multi-frame render shells.

## Agent debug loop (preferred)

```bash
# Runtime config + director phases + HTML semantics at several progresses
superimg inspect my.media.ts --pretty

# What changed between two beats? (text / colors / data-eq-key)
superimg inspect my.media.ts --diff 0.35,0.85

# Optional pixel stills (Playwright)
superimg inspect my.media.ts --at 0.5,0.9 --png -o /tmp/inspect

# Final export only after structure looks right
superimg render my.media.ts -y
```

**Stdout:** single JSON report (`config`, `phases`, `samples`, optional `diff`).  
**No browser** unless `--png`. Typical HTML-only run is sub-second to a few seconds.

| Field | Meaning |
|-------|---------|
| `config.duration` | Runtime-true duration (executed template config) |
| `phases` | Director layout with start/end sec + frames (or `null`) |
| `samples[].text` / `.colors` / `.eqKeys` | Scraped from rendered HTML |
| `samples[].activePhase` | Which phase is live at that progress |
| `diff` | Added/removed text & colors between two progresses |

Also useful:

```bash
superimg validate my.media.ts   # NaN / throws / empty frames
superimg info my.media.ts       # config + phase summary
superimg doctor                 # environment only
```

## Single-frame CLI

```bash
# HTML snapshot at frame 45 (no browser)
superimg render my.media.ts --format html --frame 45

# PNG still at frame 45
superimg render my.media.ts --format png --frame 45
```

For static templates (no `fps`/`duration` in config), add `--format png`. For animated templates, add `--frame`.

> **Note:** Progress-based capture exists on the programmatic API (`renderVideo({ progress })`). CLI still capture currently takes `--frame`. Use `inspect --at 0.5` for progress-based multi-samples.

Full video HTML dump (heavy):

```bash
superimg render my.media.ts --debug-html
# → output/.superimg/debug/<name>/frame_*.html
```

## Programmatic

### Fast HTML snapshots (no Playwright)

```typescript
import { renderToHtml } from "superimg";
import { renderHtmlAtFrame, probeDirectorPhases } from "@superimg/core/testing";

// Edge / Workers — compile or pass a module
const html = renderToHtml({ template: bundledCode, frame: 45, fps: 30, durationSeconds: 5 });

// In tests — pass a compiled module
const snapshot = renderHtmlAtFrame(template, { progress: 0.5, composite: false });
const phases = probeDirectorPhases(template, { durationSeconds: 5, fps: 30 });
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

| Goal | Tool |
|------|------|
| Agent timing / content debug | **`superimg inspect`** (+ `--diff`) |
| CI HTML regression | `renderHtmlAtFrame` or `renderToHtml({ frame })` |
| Visual pixel diff | `inspect --png` or `renderVideo({ frame, encoding: { format: "png" } })` |
| Crash / NaN check | `superimg validate` |
| Static OG card | `define()` (no fps/duration) + `--format png` |
| Embedded video in frame | `std.video.sync` — Playwright seeks before capture |
