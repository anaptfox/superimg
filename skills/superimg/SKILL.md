---
name: superimg
description: >
  This skill should be used when the user asks to "create a video template",
  "render HTML to MP4/PNG/GIF/SVG", "use defineScene", "defineImage",
  "defineGif", "defineSvg", "work with ctx.std", or mentions SuperImg,
  video generation, or programmatic media. Provides the SuperImg framework
  for HTML/CSS templates rendered to video, image, GIF, or SVG.
---

# SuperImg Skill

## Mental Model

**Layer the frame, score the motion** — for **video** and **gif** (animated templates).

### Four template kinds

| Kind | Factory | File | Stdlib | Output |
|------|---------|------|--------|--------|
| **video** | `defineScene` | `*.video.ts` | Full (`score`, `layers`, `reveal`, `cue`, …) | MP4 |
| **gif** | `defineGif` | `*.gif.ts` | Full (same temporal APIs as video) | GIF |
| **image** | `defineImage` | `*.image.ts` | Static — no `score`, `layers`, `reveal`, `cue` | PNG/WebP/JPEG |
| **svg** | `defineSvg` | `*.svg.ts` | Static — same as image + `std.viz` / `std.svg` | SVG markup |

**Pick a kind:** OG card / still → `defineImage`. Chart / vector → `defineSvg` (return `<svg xmlns="...">`). Short loop → `defineGif`. Scene / reel / multi-scene → `defineScene`.

### Animated path (video + gif)

`render(ctx)` is a pure function of time; returns HTML each frame.

| Tier | API | Role |
|------|-----|------|
| **Video** | `compose([scenes])` | Multi-scene chain (video only) |
| **Template** | `defineScene` / `defineGif` | Scene contract, config, sample data |
| **Layers** (optional) | `std.layers()` | Shot stack — bg → tint → content → overlay → fx |
| **Score** | `std.score()` | Phase timing + motion (`t.motion().style`, `tween`, `within`) |

**Satellites:** `std.cue.*` (absolute time for voiceover), `std.css` / `std.layout` (spatial layout inside planes), `interpolate` / `spring` / `stagger` (escape hatches), `mergeMotion` (combine motions), `std.reveal.*` (transition overlay utilities — mount on `L.fx()`, not a compositional tier).

Simple centered card → template + score. Layered broadcast layout → add layers. Voiceover sync → cue + score.

### Static path (image + svg)

Single `render(ctx)` call — no `sceneProgress`. Use `std.css`, `std.layout`, `std.color`. SVG templates return real SVG markup; optional `config.duration` for CSS animation.

### Footguns

- **image/svg:** no `std.score()` or `std.layers()` — types exclude them
- **`std.reveal` vs `std.svg.reveal`:** full-frame overlays vs SVG path reveals
- **Broadcast overlays:** `std.layers({ mode: "transparent" })`
- **Flat HTML (no layers):** set root `width` / `height` via `std.css`
- **`compose()` vs `mergeMotion()`:** scenes vs motion values
- **GIF timing:** full `RenderContext`; `sceneProgress` equals global in single-scene GIFs; score or raw `globalTimeSeconds` both work

## Quick Start (video)

```typescript
import { defineScene } from "superimg";

export default defineScene({
  sample: { message: "Hello!", accentColor: "#667eea" },
  config: {
    duration: 3,
    inlineCss: ["* { margin: 0; box-sizing: border-box; } body { background: #0f0f23; font-family: system-ui; }"],
  },
  render(ctx) {
    const { std, width, height, data } = ctx;
    const t = std.score();
    const card = t.motion({ y: 30 });

    return `
      <div style="${std.css({ width, height }, std.css.center())}">
        <div style="${std.css({ color: data.accentColor, fontSize: 64 }, card.style)}">${data.message}</div>
      </div>
    `;
  },
});
```

## Key Context Fields

**Video/gif:** `sceneProgress`, `sceneTimeSeconds`, `width`, `height`, `data`, `std`, `asset()`. Prefer `sceneProgress` / `sceneTimeSeconds` over `global*` for scene-local animation.

**Image/svg:** `width`, `height`, `data`, `std`, `asset()` — no temporal fields.

**Co-located assets:** `ctx.asset('logo.png')` for files in `assets/` next to your template.

## Core Patterns

**Score API (video/gif):**
```typescript
const t = std.score({ enter: 0.15, hold: 0.7, exit: 0.15 });
const card = t.motion({ scale: 0.8, easing: "easeOutBack" });
const count = Math.floor(t.tween(0, 100, { during: "enter", easing: "easeOutCubic" }));
```

**Nested clips (sequence-like timing):**
```typescript
const t = std.score({ hook: "2s", demo: "5s" });
const hook = t.clip({ during: "hook" });
if (hook.active) {
  const local = hook.score({ enter: "20%", hold: "60%", exit: "20%" });
  return `<div style="${local.motion({ y: 24 }).style}">Hook</div>`;
}
const feature = t.clip({ during: "demo" }).clip({ from: "0.5s", duration: "1.5s" });
```

**Embedded video (frame-accurate):**
```typescript
const clip = std.video.sync({ src: ctx.asset("clip.mp4"), at: ctx.sceneTimeSeconds }, ctx.fps);
return clip.html; // not <video autoplay>
```

**Layer stack (video/gif, layered scenes):**
```typescript
const L = std.layers({ width, height, mode: "opaque" });
const wipe = std.reveal.wipe({ progress: t.within("intro"), direction: "diagonal", color: "#000" });
return L.render(
  L.bg(kenBurns.html),
  L.tint("rgba(0,0,0,0.5)"),
  L.content(`<h1 style="${card.style}">...</h1>`, { safe: "broadcast" }),
  L.overlay(lowerThirdHtml, { anchor: "bottom-left", offset: { y: 80 }, safe: true, motion: badgeAnim }),
  L.fx(wipe.html, { visible: () => t.within("intro") < 1 }),
);
```

**Still image:**
```typescript
import { defineImage } from "superimg";
export default defineImage({
  config: { width: 1200, height: 630 },
  render(ctx) {
    const { std, width, height, data } = ctx;
    return `<div style="${std.css({ width, height, background: "#0f172a" }, std.css.center())}">
      <h1 style="color:#fff;font-size:64px">${data.title}</h1>
    </div>`;
  },
});
```

**Responsive sizing:** `const r = std.createResponsive(ctx);` then `r({ portrait: 48, default: 40 })`

**Audio & cue sync:** `std.cue.transcript(words, ctx.sceneTimeSeconds)` — pair with score for scene choreography.

**Layout:** `std.css()`, `std.css.center()`, `std.css.column()`, `std.layout.partitionY()`

## Stdlib Cheat Sheet

- `std.score(phases?)` — video/gif only. `{ motion, tween, value, active, within, clip, span, transition, inSpan }`
- `std.video.sync(opts, fps)` — frame-accurate embedded `<video>` for headless render
- `std.layers(opts)` — video/gif only. `.bg()`, `.tint()`, `.content()`, `.overlay()`, `.fx()`, `.handoff()`, `.render()`
- `std.reveal.wipe/split/curtain/crossfade/iris/handoffLocal()` — transition overlays (utility)
- `std.stagger.lead(items, progress)` — leading stagger index (sync phone mockups)
- `std.mergeMotion(...)` — merge motion values (not `compose()`)
- `std.cue.transcript/markers/script` — absolute-time sync
- `std.interpolate`, `std.spring`, `std.stagger`
- `std.css`, `std.color`, `std.createResponsive`
- `std.viz`, `std.svg.*` — svg templates

## Do / Don't

**DO:** Match factory to file extension. Use `std.score` for phased video/gif animation. Put shared CSS in `config.inlineCss`. Use `std.css()` for inline styles.

**DON'T:** Use `score`/`layers` in image/svg templates. Return JSX. Mutate state in render. Use `globalTimeSeconds` for scene-local video animation (use `sceneProgress`). Call `std.tween()` at top level — use `std.score().tween()`.

## Config

`defineScene` / `defineGif`: `width`, `height`, `fps`, `duration`, `fonts`, `inlineCss`, `outputs`. `defineImage`: no `fps`/`duration`. `defineSvg`: optional `duration` for CSS anim.

## CLI

> **Note for AI Agents:** Do **not** use `-o` / `--output` unless the user requests a custom path.

```bash
superimg dev intro
superimg render intro
superimg render intro --format png --frame 45   # single-frame still
superimg render intro --format html --frame 45  # HTML snapshot (no browser)
superimg list
superimg setup
```

## Additional Resources

- **[references/api.md](references/api.md)** — Full API, template kinds, composition model
- **[examples/hello-world.ts](examples/hello-world.ts)** — Minimal video
- **[examples/stats-card.ts](examples/stats-card.ts)** — Score + counters

### Project Examples

`feature-launch`, `layer-shots`, `lower-thirds`, `stats-card`, `og-card` (image), `spinner` (gif), `sine-wave` (svg) — indexed in `examples/_templates.json`.