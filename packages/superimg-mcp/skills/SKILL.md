---
name: superimg
description: >
  This skill should be used when the user asks to "create a video template",
  "animate with SuperImg", "render HTML to MP4", "use defineScene", "work with
  ctx.std", or mentions SuperImg, video generation, or programmatic video.
  Provides the SuperImg framework for HTML/CSS templates rendered to video.
---

# SuperImg Skill

## Mental Model

Video is a pure function of time. Your template's `render(ctx)` is called once per frame. It receives a `RenderContext` and returns an HTML string. All animation is derived from `sceneProgress` (0→1 over the scene) or `sceneTimeSeconds` (elapsed seconds). Use `std.tween` as the canonical animation primitive. Data comes from `defaults`, merged with per-scene overrides. No timeline editor, no keyframes — just math and HTML.

## Quick Start

```typescript
import { defineScene } from "superimg";

export default defineScene({
  defaults: { message: "Hello!", accentColor: "#667eea" },
  config: {
    duration: 3,
    inlineCss: ["* { margin: 0; box-sizing: border-box; } body { background: #0f0f23; font-family: system-ui; }"],
  },
  render(ctx) {
    const { std, sceneProgress, width, height, data } = ctx;
    const { style } = std.motion.enter(sceneProgress, { y: 30 });
    return `
      <div style="${std.css({ width, height }, std.css.center())}">
        <div style="${std.css({ color: data.accentColor, fontSize: 64 }, style)}">${data.message}</div>
      </div>
    `;
  },
});
```

## Key Context Fields

Use these from `ctx`: `sceneProgress`, `sceneTimeSeconds`, `sceneDurationSeconds`, `width`, `height`, `isPortrait`, `data`, `std`, `asset()`. Ignore `globalProgress` for scene animation — use `sceneProgress` or `sceneTimeSeconds` instead.

**Co-located assets (zero config):** `ctx.asset('logo.png')` returns a URL for `assets/logo.png` next to your `.video.ts` file. For named assets with preloaded metadata, use `config.assets` + `ctx.assets`.

## Core Patterns

**Motion helpers (recommended for fade+slide animations):**
```typescript
// Single-phase enter animation
const { style } = std.motion.enter(sceneProgress, { y: 30 });

// Enter-hold-exit animation
const { style } = std.motion.enterExit(sceneProgress, { y: 40, enterEnd: 0.2, exitStart: 0.8 });
```

**Phase splitting (for multi-phase timing):**
```typescript
const { enter, hold, exit } = std.phases(sceneProgress, { enter: 1, hold: 2, exit: 1 });
const { style } = std.motion.enter(enter.progress, { y: 30 });
```

**Responsive sizing:**
```typescript
const r = std.createResponsive(ctx);
const fontSize = r({ portrait: 48, square: 32, default: 40 });
```

**Timeline API (for complex choreography):**
```typescript
const tl = std.timeline(time, duration);
const enter = tl.at("enter", 0, 0.8);
const scale = enter.active ? std.tween(0.8, 1, enter.progress, "easeOutBack") : 1;
```

**Animated counter:** `Math.floor(std.tween(0, value, progress, "easeOutCubic"))`

**Layout:** `std.css({ width, height })`, `std.css.center()`, `std.css.fill()`, `std.css.stack()`

**Color:** `std.color.alpha(color, 0.5)`, `std.color.mix(c1, c2, t)`

## Stdlib Cheat Sheet

- `std.motion.enter(progress, { y: 20 })` — fade in + slide (returns `{ style, opacity, transform }`)
- `std.motion.enterExit(progress, opts)` — three-phase enter/hold/exit animation
- `std.phases(progress, { enter: 1, hold: 2, exit: 1 })` — split progress into named phases
- `std.createResponsive(ctx)` — factory for `r({ portrait: X, default: Y })`
- `std.tween(from, to, progress, "easeOutCubic")` — low-level eased interpolation
- `std.math.clamp`, `std.math.map` — value clamping and mapping
- `std.color.alpha`, `std.color.mix` — color manipulation
- `std.css(obj)` — object → inline style string
- `std.timeline(time, duration)` — declarative timeline for complex choreography
- `std.spring(progress, config?)` — spring curve 0→1 with overshoot/bounce
- `std.springTween(from, to, progress, config?)` — spring-interpolated value
- `std.createSpring(config?)` — create spring easing for use with `std.tween()`
- `std.stagger(items, progress, opts?)` — distribute progress across items with cascading delays
- `std.interpolate(progress, inputRange, outputRange)` — multi-keyframe interpolation
- `std.interpolateColor(progress, inputRange, colors)` — multi-keyframe color interpolation

## Do / Don't

**DO:** Use `sceneProgress` or `sceneTimeSeconds` for animation. Put shared CSS in `config.inlineCss`. Use `config.fonts` for Google Fonts. Set root element to `width: ${width}px; height: ${height}px`. Use `std.css()` for inline styles. Import from `"superimg"` in templates.

**DON'T:** Return JSX — return template literal strings. Mutate state in render — keep it pure. Use `globalProgress` for scene animation. Import from `"superimg/server"` in templates. Use `@import url()` for fonts — use `config.fonts`. Override CLI output paths (e.g. using `-o`) when rendering unless explicitly instructed by the user.

## Config

`defineScene` config: `width`, `height`, `fps`, `duration`, `fonts`, `inlineCss`, `stylesheets`, `outputs`. Precedence: CLI flags > template config > `_config.ts` (cascading) > built-in defaults. Use `defineConfig` in `_config.ts` for project-wide settings.

## CLI

> **Note for AI Agents:** Do **not** use the `-o` or `--output` flag when rendering unless the user explicitly requests a custom path. Rely on the framework to determine the output location automatically.

```bash
superimg init my-project
superimg init .                    # Add to existing project
superimg dev intro
superimg render videos/intro.ts    # Outputs natively to nearest package's output/intro.mp4
superimg render videos/intro.ts -o custom.mp4
superimg list
superimg info videos/intro.ts
superimg setup
superimg add skill
```

## Server API

```typescript
import { renderVideo, loadTemplate } from "superimg/server";
const t = await loadTemplate("videos/intro.ts");
await renderVideo("videos/intro.ts", { outputPath: "out.mp4", width: 1920, height: 1080 });
```

## Additional Resources

For detailed API documentation and working examples, consult:

### Reference Files
- **[references/api.md](references/api.md)** — Complete RenderContext interface, all std.tween easings, full std.math/color/css/timing APIs, config options

### Example Files
- **[examples/hello-world.ts](examples/hello-world.ts)** — Minimal template demonstrating core concepts
- **[examples/stats-card.ts](examples/stats-card.ts)** — Advanced template with phase timing, animated counters, responsive sizing

### Project Examples
See `examples/templates/` in the SuperImg repo for full templates: `lower-thirds`, `stats-card`, `phase-demo`, `countdown`, `spring-stagger-demo`.
