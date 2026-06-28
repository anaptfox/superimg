<!-- BEGIN superimg-skill v0.1.0 — managed by `superimg skill update`; do not edit -->
# SuperImg Skill

## Mental Model

**Layer the frame, direct the motion** — for **video** and **gif** (animated templates).

### Unified templates (`*.media.ts`)

| Output | Factory | Config signal | Stdlib |
|--------|---------|---------------|--------|
| **MP4/WebM** | `define()` | `fps` + `duration` | Full (`director`, `carousel`, `stack`, `track`, `layers`, `reveal`, …) |
| **GIF** | `define()` | `fps` + `duration` + `--format gif` | Full (same temporal APIs as video) |
| **image** | `define()` | no `fps`/`duration` | Static — no director/layers/reveal |
| **svg** | `define({ medium: "svg" })` | `medium: "svg"` | Static + `std.viz` / `std.svg` |

**Pick output:** still → `define()` without fps/duration. Vector → `define({ medium: "svg" })`. Animated scene/reel → `define()` with fps + duration. File extension is always `*.media.ts`.

### Animated path (video + gif)

`render(ctx)` is a pure function of time; returns HTML each frame.

| Tier | API | Role |
|------|-----|------|
| **Video** | `compose([scenes])` | Multi-scene chain (video only) |
| **Template** | `define()` | Scene contract, config, sample data |
| **Layers** (optional) | `std.layers()` | Shot stack — bg → tint → content → overlay → fx |
| **Director** | `ctx.director()` | Phase timing + motion (`t.motion().style`, `tween`, `in`) |

**Satellites:** `ctx.track()` (transcript/marker sync), `std.carousel()` / `std.stack()` (ordered item choreography), `std.css` / `std.layout` (spatial layout), `interpolate` / `spring` / `stagger` (escape hatches), `mergeMotion` (combine motions), `std.reveal.*` (transition overlay utilities — mount on `L.fx()`, not a compositional tier).

Simple centered card → template + director. Layered broadcast layout → add layers. Voiceover sync → track + director.

### Static path (image + svg)

Single `render(ctx)` call — no `timeline`. Use `std.css`, `std.layout`, `std.color`. SVG templates return real SVG markup; optional `config.duration` for CSS animation.

### Footguns

- **image/svg:** no `ctx.director()` or `std.layers()` — types exclude them
- **`std.reveal` overlays vs `std.reveal.clip`:** full-frame transition FX vs clip-path strings
- **Broadcast overlays:** `std.layers({ mode: "transparent" })`
- **Flat HTML (no layers):** set root `width` / `height` via `std.css`
- **`compose()` vs `mergeMotion()`:** scenes vs motion values
- **Clock:** `timeline.seconds` is always `progress × durationSeconds` — use `timeline` for scene-local time, not `globalTimeSeconds`

## Quick Start (video)

```typescript
import { define } from "superimg";

export default define({
  sample: { message: "Hello!", accentColor: "#667eea" },
  config: {
    duration: 3,
    inlineCss: ["* { margin: 0; box-sizing: border-box; } body { background: #0f0f23; font-family: system-ui; }"],
  },
  render(ctx) {
    const { std, width, height, data } = ctx;
    const d = ctx.director();
    const card = d.motion({ y: 30 });

    return `
      <div style="${std.css({ width, height }, std.css.center())}">
        <div style="${std.css({ color: data.accentColor, fontSize: 64 }, card.style)}">${data.message}</div>
      </div>
    `;
  },
});
```

## Key Context Fields

**Video/gif:** `timeline` (`progress`, `seconds`, `frame`, `durationSeconds`), `ctx.director()`, `ctx.track()`, `width`, `height`, `data`, `std`, `asset()`. Use `timeline.progress` / `timeline.seconds` for scene-local animation.

**Image/svg:** `width`, `height`, `data`, `std`, `asset()` — no temporal fields.

**Co-located assets:** `ctx.asset('logo.png')` for files in `assets/` next to your template.

## Core Patterns

**Director API (video/gif):**
```typescript
const d = ctx.director({ enter: "15%", hold: "70%", exit: "15%" });
const card = d.motion({ scale: 0.8, easing: "easeOutBack" });
const count = Math.floor(d.tween(0, 100, { during: "enter", easing: "easeOutCubic" }));
```

**Nested clips (sequence-like timing):**
```typescript
const d = ctx.director({ hook: "2s", demo: "5s" });
const hook = d.clip({ during: "hook" });
if (hook.active) {
  const local = hook.director({ enter: "20%", hold: "60%", exit: "20%" });
  return `<div style="${local.motion({ y: 24 }).style}">Hook</div>`;
}
```

**Stack (accumulate — chat, FAQ, lists):**
```typescript
const d = ctx.director({ messages: "90%", hold: "10%" });
const stk = std.stack(messages, { during: d.in("messages"), lead: 0.05, trail: 0.05 });
for (let i = 0; i < messages.length; i++) {
  const item = stk.state(i);
  if (item.state === "hidden") continue;
  // item.enter: 0→1 during reveal; item.slot: 0→1 across slot (typing, q→a)
}
```

**Carousel (replace — threads, wizards):**
```typescript
const d = ctx.director({ tweets: "84%", hold: "16%" });
const car = std.carousel(tweets, { during: d.in("tweets"), exit: 0.15, last: "hold" });
const item = car.state(0); // states: hidden | entering | hold | exiting | gone
```

**Track (transcript / marker sync):**
```typescript
const vo = ctx.track({ words: data.words });
const word = vo.current();
const charP = vo.charProgress();
```

**Data-driven viz (bar race, force graphs):**
```typescript
const d = ctx.director({ intro: "10%", race: "80%", outro: "10%" });
const bars = std.viz.charts.barRace(keyframes, d.at("race", timeline.seconds));
```

**Embedded video (frame-accurate):**
```typescript
const clip = std.video.sync({ src: ctx.asset("clip.mp4"), at: timeline.seconds }, ctx.fps);
return clip.html; // not <video autoplay>
```

**Layer stack (video/gif, layered scenes):**
```typescript
const L = std.layers({ width, height, mode: "opaque" });
const wipe = std.reveal.wipe({ progress: d.in("intro"), direction: "diagonal", color: "#000" });
return L.render(
  L.bg(kenBurns.html),
  L.tint("rgba(0,0,0,0.5)"),
  L.content(`<h1 style="${card.style}">...</h1>`, { safe: "broadcast" }),
  L.overlay(lowerThirdHtml, { anchor: "bottom-left", offset: { y: 80 }, safe: true, motion: badgeAnim }),
  L.fx(wipe.html, { visible: () => d.in("intro") < 1 }),
);
```

**Still image:**
```typescript
import { define } from "superimg";
export default define({
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

**Layout:** `std.css()`, `std.css.center()`, `std.css.column()`, `std.layout.partitionY()`

## Stdlib Cheat Sheet

- `ctx.director(phases?)` — video/gif only. `{ motion, tween, value, active, in, clip, at, span, transition, inSpan }`
- `ctx.track({ words, markers })` — transcript/marker sync using `timeline.seconds`
- `std.carousel(items, opts)` — one active item; prior items exit (`last: "hold"` keeps final)
- `std.stack(items, opts)` — accumulate items; `enter` + `slot` for sub-beats
- `std.video.sync(opts, fps)` — frame-accurate embedded `<video>` for headless render
- `std.layers(opts)` — video/gif only. `.bg()`, `.tint()`, `.content()`, `.overlay()`, `.fx()`, `.handoff()`, `.render()`
- `std.reveal.wipe/split/curtain/crossfade/iris/handoffLocal()` — transition overlays (utility)
- `std.stagger.lead(items, progress)` — leading stagger index (sync phone mockups)
- `std.mergeMotion(...)` — merge motion values (not `compose()`)
- `std.interpolate`, `std.spring`, `std.stagger`
- `std.css`, `std.color`, `std.createResponsive`
- `std.viz`, `std.svg.*` — svg templates

## Do / Don't

**DO:** Use `*.media.ts` for all templates. Use `ctx.director()` for phased video/gif animation. Use explicit time units in motion (`at: "0.2s"`, `for: "30%"`). Put shared CSS in `config.inlineCss`. Use `std.css()` for inline styles.

**DON'T:** Use `director`/`layers` in image/svg templates. Return JSX. Mutate state in render. Use `globalTimeSeconds` for scene-local video animation (use `timeline`). Use unitless numeric `at`/`for` in motion calls.

## Config

`define()` config: `width`, `height`, `fps`, `duration`, `fonts`, `inlineCss`, `outputs`. Static templates omit `fps`/`duration`. SVG templates use `medium: "svg"` and may set `duration` for CSS anim.

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
- **[examples/stats-card.ts](examples/stats-card.ts)** — Director + counters

### Project Examples

`feature-launch`, `layer-shots`, `lower-thirds`, `stats-card`, `og-card` (image), `spinner` (gif), `sine-wave` (svg) — indexed in `examples/_templates.json`.
<!-- END superimg-skill -->
