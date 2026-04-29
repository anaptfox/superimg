<!-- BEGIN superimg-skill v0.1.0 — managed by `superimg skill update`; do not edit -->
# SuperImg Skill

## Mental Model

Video is a pure function of time. Your template's `render(ctx)` is called once per frame. It receives a `RenderContext` and returns an HTML string. All animation is derived from `sceneProgress` (0→1 over the scene) or `sceneTimeSeconds` (elapsed seconds). Use `std.score` as the primary orchestration primitive for layouts, and `std.interpolate` or `std.spring` for low-level math. Data comes from `data`, merged with per-scene overrides.

## Quick Start

```typescript
import { defineScene } from "superimg";

export default defineScene({
  data: { message: "Hello!", accentColor: "#667eea" },
  config: {
    duration: 3,
    inlineCss: ["* { margin: 0; box-sizing: border-box; } body { background: #0f0f23; font-family: system-ui; }"],
  },
  render(ctx) {
    const { std, width, height, data } = ctx;
    // score() handles enter/hold/exit phases automatically
    const t = std.score(); 
    const card = t.motion({ y: 30 }); // enter from y:30, stay, then auto-exit
    
    return `
      <div style="${std.css({ width, height }, std.css.center())}">
        <div style="${std.css({ color: data.accentColor, fontSize: 64 }, card.style)}">${data.message}</div>
      </div>
    `;
  },
});
```

## Key Context Fields

Use these from `ctx`: `sceneProgress`, `sceneTimeSeconds`, `sceneDurationSeconds`, `width`, `height`, `isPortrait`, `data`, `std`, `asset()`. Ignore `globalProgress` for scene animation — use `sceneProgress` or `sceneTimeSeconds` instead.

**Co-located assets (zero config):** `ctx.asset('logo.png')` returns a URL for `assets/logo.png` next to your `.video.ts` file. For named assets with preloaded metadata, use `config.assets` + `ctx.assets`.

## Core Patterns

**Score API (recommended for layouts and choreography):**
```typescript
// Define phases in fractions of scene duration
const t = std.score({ enter: 0.15, hold: 0.7, exit: 0.15 });

// Motion with automatic enter/exit
const card = t.motion({ scale: 0.8, easing: "easeOutBack" });

// Phase-scoped scalar animation (e.g. animated counter)
const count = Math.floor(t.tween(0, 100, { during: "enter", easing: "easeOutCubic" }));
```

**Responsive sizing:**
```typescript
const r = std.createResponsive(ctx);
const fontSize = r({ portrait: 48, square: 32, default: 40 });
```

**Audio & Cue Sync (transcripts, markers):**
```typescript
// Word-level timing from ElevenLabs/Whisper
const transcript = std.cue.transcript(data.words, ctx.sceneTimeSeconds);
const word = transcript.current();

// named markers for synced triggers
const m = std.cue.markers({ intro: 0, main: 2.5, outro: 8 }, ctx.sceneTimeSeconds);
const opacity = std.interpolate(m.progress("intro", "main"), [0, 1], [0, 1], "easeOutCubic");
```

**Low-level interpolation:** `std.interpolate(progress, [0, 1], [from, to], easing?)`

**Layout:** `std.css({ width, height })`, `std.css.center()`, `std.css.fill()`, `std.css.stack()`

**Color:** `std.color.alpha(color, 0.5)`, `std.color.mix(c1, c2, t)`

## Stdlib Cheat Sheet

- `std.score(phases?)` — primary timing object. Returns `{ motion, tween, value, active, within }`.
- `std.cue.transcript(words, time)` — word-level sync for voiceovers.
- `std.cue.markers(def, time)` — progress between named timestamps.
- `std.cue.script(events, time)` — ID-based trigger system for scripts.
- `std.createResponsive(ctx)` — factory for `r({ portrait: X, default: Y })`
- `std.interpolate(progress, inputRange, outputRange, easing?)` — multi-keyframe eased interpolation
- `std.interpolateColor(progress, inputRange, colors, easing?)` — multi-keyframe color interpolation
- `std.math.clamp01`, `std.math.map` — value clamping and mapping
- `std.color.alpha`, `std.color.mix` — color manipulation
- `std.css(obj)` — object → inline style string
- `std.spring(from, to, progress, config?)` — spring curve with overshoot/bounce
- `std.stagger(items, progress, opts?)` — distribute progress across items

## Do / Don't

**DO:** Use `std.score` for complex layouts. Put shared CSS in `config.inlineCss`. Use `config.fonts` for Google Fonts. Set root element to `width: ${width}px; height: ${height}px`. Use `std.css()` for inline styles. Import from `"superimg"` in templates.

**DON'T:** Return JSX — return template literal strings. Mutate state in render — keep it pure. Use `globalProgress` for scene animation. Call `std.tween()` — it is not a public `ctx.std` API; use `std.score().tween()` or `std.interpolate()`. Use `std.phases` (use `std.score` instead).

## Config

`defineScene` config: `width`, `height`, `fps`, `duration`, `fonts`, `inlineCss`, `stylesheets`, `outputs`. Precedence: CLI flags > template config > `_config.ts` (cascading) > built-in defaults. Use `defineConfig` in `_config.ts` for project-wide settings.

## CLI

> **Note for AI Agents:** Do **not** use the `-o` or `--output` flag when rendering unless the user explicitly requests a custom path. Rely on the framework to determine the output location automatically.

```bash
superimg init my-project
superimg init .                    # Add to existing project
superimg dev intro
superimg render intro              # Outputs natively to output/intro.mp4
superimg render intro -o custom.mp4
superimg list
superimg info intro
superimg setup
superimg skill install
```

## Server API

```typescript
import { renderVideo, loadTemplate } from "superimg/server";
const t = await loadTemplate("videos/intro.video.ts");
await renderVideo("videos/intro.video.ts", { outputPath: "out.mp4", width: 1920, height: 1080 });
```

## Additional Resources

For detailed API documentation and working examples, consult:

### Reference Files
- **[references/api.md](references/api.md)** — Complete RenderContext interface, all stdlib primitives, config options

### Example Files
- **[examples/hello-world.ts](examples/hello-world.ts)** — Minimal template demonstrating core concepts
- **[examples/stats-card.ts](examples/stats-card.ts)** — Advanced template with phase timing, animated counters, responsive sizing

### Project Examples
See `examples/<category>/<template>/` in the SuperImg repo for full templates, indexed in `examples/_templates.json`: `lower-thirds`, `stats-card`, `phase-demo`, `countdown`, `spring-stagger-demo`.
<!-- END superimg-skill -->
