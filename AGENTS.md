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

**Satellites:** `ctx.track()` (transcript/marker sync), `std.carousel()` / `std.stack()` (ordered item choreography), `std.css` / `std.layout` (spatial layout), `interpolate` / `spring` / `stagger` (escape hatches), `mergeMotion` (combine motions), `std.transition.*` (full-frame transition FX — mount on `L.fx()`, not a compositional tier).

Simple centered card → template + director. Layered broadcast layout → add layers. Voiceover sync → track + director.

### Static path (image + svg)

Single `render(ctx)` call — no `timeline`. Use `std.css`, `std.layout`, `std.color`. SVG templates return real SVG markup; optional `config.duration` for CSS animation.

### Footguns

- **image/svg:** no `ctx.director()` or `std.layers()` — types exclude them
- **`std.transition.*` vs `std.reveal.*`:** full-frame FX overlays vs clip-path strings
- **Broadcast overlays:** `std.layers({ mode: "transparent" })`
- **Flat HTML (no layers):** set root `width` / `height` via `std.css`
- **`compose()` vs `mergeMotion()`:** scenes vs motion values
- **Clock:** `timeline.seconds` is always `progress × durationSeconds` — use `timeline` for scene-local time, not `ctx.global`
- **Phases on stills:** prefer **percent** phases summing to 100% — second-based phases can blow up when single-frame paths use short totalSeconds. Prefer `layoutTimeline({…seconds})` which always emits percents.
- **Config const refs:** `const DURATION = 12; duration: DURATION` is folded by metadata AST; dynamic `resolve()` duration still needs runtime/`inspect`
- **Fixed duration + stack:** equal slots compress when item count grows — use `resolve` + `layoutTimeline` (+ optional `stack` `weights`) for programmable lists/sessions

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
    const t = ctx.director();
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

**Video/gif:** `timeline` (`progress`, `seconds`, `frame`, `durationSeconds`), `ctx.director()`, `ctx.track()`, `width`, `height`, `data`, `std`, `asset()`. Use `timeline.progress` / `timeline.seconds` for scene-local animation.

**Image/svg:** `width`, `height`, `data`, `std`, `asset()` — no temporal fields.

**Co-located assets:** `ctx.asset('logo.png')` for files in `assets/` next to your template.

## Core Patterns

**Director API (video/gif):**
```typescript
const t = ctx.director({ enter: "15%", hold: "70%", exit: "15%" });
const card = t.motion({ scale: 0.8, easing: "easeOutBack" });
const count = Math.floor(t.tween(0, 100, { during: "enter", easing: "easeOutCubic" }));
```

**Nested clips (sequence-like timing):**
```typescript
const t = ctx.director({ hook: "2s", demo: "5s" });
const hook = t.clip({ during: "hook" });
if (hook.active) {
  const local = hook.director({ enter: "20%", hold: "60%", exit: "20%" });
  return `<div style="${local.motion({ y: 24 }).style}">Hook</div>`;
}
```

**Stack (accumulate — chat, FAQ, lists):**
```typescript
const t = ctx.director({ messages: "90%", hold: "10%" });
const stk = std.stack(messages, {
  during: t.in("messages"),
  lead: 0.05,
  trail: 0.05,
  weights: messages.map((m) => Math.max(1, m.text.length / 40)), // optional
});
for (let i = 0; i < messages.length; i++) {
  const item = stk.state(i);
  if (item.state === "hidden") continue;
  // item.enter: 0→1 during reveal; item.slot: 0→1 across slot (typing, q→a)
}
```

**Variable-length sessions (resolve + layoutTimeline):**
```typescript
import { define, layoutTimeline } from "superimg";

function estimate(data: { items: unknown[] }) {
  return layoutTimeline({
    intro: 1,
    main: Math.max(2, data.items.length * 1.2),
    hold: 0.8,
  });
}

export default define({
  sample: { items: [1, 2, 3] },
  config: { width: 1920, height: 1080, fps: 30, duration: "8s" }, // AST fallback
  resolve({ data }) {
    const { totalSeconds, phases } = estimate(data);
    return { duration: `${totalSeconds}s`, phases };
  },
  render(ctx) {
    const { phases } = estimate(ctx.data);
    const t = ctx.director(phases);
    // …
  },
});
```

**Carousel (replace — threads, wizards):**
```typescript
const t = ctx.director({ tweets: "84%", hold: "16%" });
const car = std.carousel(tweets, { during: t.in("tweets"), exit: 0.15, last: "hold" });
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
const t = ctx.director({ intro: "10%", race: "80%", outro: "10%" });
const bars = std.viz.charts.barRace(keyframes, t.at("race", timeline.seconds));
```

**Embedded video (frame-accurate):**
```typescript
const clip = std.video.sync({ src: ctx.asset("clip.mp4"), at: timeline.seconds }, ctx.fps);
return clip.html; // not <video autoplay>
```

**Layer stack (video/gif, layered scenes):**
```typescript
const L = std.layers({ width, height, mode: "opaque" });
const wipe = std.transition.wipe({ progress: t.in("intro"), direction: "diagonal", color: "#000" });
return L.render(
  L.bg(kenBurns.html),
  L.tint("rgba(0,0,0,0.5)"),
  L.content(`<h1 style="${card.style}">...</h1>`, { safe: "broadcast" }),
  L.overlay(lowerThirdHtml, { anchor: "bottom-left", offset: { y: 80 }, safe: true, motion: badgeAnim }),
  L.fx(wipe.html, { visible: () => t.in("intro") < 1 }),
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
- `std.stack(items, opts)` — accumulate items; `enter` + `slot`; optional `weights` for unequal slots
- `std.layoutTimeline(segments)` / `layoutTimeline` — pure seconds → percent phases + `totalSeconds` (use in resolve + render)
- `std.video.sync(opts, fps)` — frame-accurate embedded `<video>` for headless render
- `std.layers(opts)` — video/gif only. `.bg()`, `.tint()`, `.content()`, `.overlay()`, `.fx()`, `.handoff()`, `.render()`
- `std.transition.wipe/split/curtain/crossfade/iris/handoffLocal()` — transition overlays (utility)
- `std.stagger.lead(items, progress)` — leading stagger index (sync phone mockups)
- `std.mergeMotion(...)` — merge motion values (not `compose()`)
- `std.interpolate`, `std.spring`, `std.stagger`
- `std.css`, `std.color`, `std.createResponsive`
- `std.viz`, `std.svg.*` — svg templates

## Do / Don't

**DO:** Use `*.media.ts` for all templates. Use `ctx.director()` for phased video/gif animation. Use explicit time units in motion (`at: "0.2s"`, `for: "30%"`). Put shared CSS in `config.inlineCss`. Use `std.css()` for inline styles.

**DON'T:** Use `director`/`layers` in image/svg templates. Return JSX. Mutate state in render. Do not use `ctx.global` for scene-local animation (use `timeline`). Use unitless numeric `at`/`for` in motion calls.

## Config

`define()` config: `width`, `height`, `fps`, `duration`, `fonts`, `inlineCss`, `outputs`. Static templates omit `fps`/`duration`. SVG templates use `medium: "svg"` and may set `duration` for CSS anim.

## CLI

> **Note for AI Agents:** Do **not** use `-o` / `--output` unless the user requests a custom path.

```bash
superimg dev intro
superimg render intro
superimg render intro --format png --frame 45   # single-frame still
superimg render intro --format html --frame 45  # HTML snapshot (no browser)
superimg inspect intro --pretty                 # multi-progress + phases (JSON)
superimg inspect intro --summary --pretty       # config + phases only (fast)
superimg inspect intro --diff 0.35,0.85         # what changed between beats?
superimg list
superimg list --shallow                         # paths only (no template parse)
superimg setup
```

## Debug (agent loop)

**Start with inspect** — do not shell five single-frame renders to learn timing.

```bash
# 1. Runtime config + director phases + samples at 0/25/50/75/100%
superimg inspect path/to/foo.media.ts --pretty

# 1b. Config + phases only (no HTML samples)
superimg inspect path/to/foo.media.ts --summary --pretty

# 2. Did beat B introduce content vs beat A?
superimg inspect path/to/foo.media.ts --diff 0.35,0.85

# 3. Only if HTML semantics are ambiguous
superimg inspect path/to/foo.media.ts --at 0.5,0.9 --png

# 4. Final motion polish
superimg render path/to/foo.media.ts -y
```

| Tool | Use for |
|------|---------|
| **`inspect`** | Phases, multi-progress text/colors/`data-eq-key`, semantic `--diff` (default JSON, no browser) |
| **`inspect --summary`** | Config + phases only (fast metadata) |
| **`validate`** | Crashes, NaN, empty output, bad easing names |
| **`doctor` / `setup`** | Env / Chromium only |
| **`render --format html\|png --frame N`** | One exact frame still (export) |
| **`list` / `list --shallow`** | Enumerate templates (deep metadata vs paths only) |

`inspect` stdout is machine JSON (`config`, `phases`, `samples`, optional `diff`). Prefer reading that over opening MP4s when fixing timing/content bugs.

## Additional Resources

- **[references/api.md](references/api.md)** — Full API, template kinds, composition model
- **[examples/hello-world.ts](examples/hello-world.ts)** — Minimal video
- **[examples/stats-card.ts](examples/stats-card.ts)** — Director + counters

### Related (motion & design)

- **animator skill** — timing, easing, stagger, framing, SVG craft, critique checklist (`skills/animator/SKILL.md` in SuperImg monorepos; complements this skill's API mechanics)
- **video-designer agent** — heavy scene/visual design (diagrams, line art, palettes, explainers); loads this skill + animator first

### Project Examples

`feature-launch`, `layer-shots`, `lower-thirds`, `stats-card`, `og-card` (image), `spinner` (gif), `sine-wave` (svg) — indexed in `examples/_templates.json`.
<!-- END superimg-skill -->

<!-- Monorepo agent routing (not managed by skill update) -->

## Related skills & agents (this repo)

The managed block above is the **superimg** skill (API + inspect debug loop). For design and motion judgment, also use:

| Name | Path | Role |
|------|------|------|
| **animator** skill | `skills/animator/SKILL.md` (+ `references/motion-craft.md`, `scene-framing.md`, `svg-techniques.md`) | Timing, easing, stagger, framing, SVG craft, critique checklist. Claude host: `.claude/skills/animator` → symlink to repo skill. |
| **video-designer** skill | `skills/video-designer/SKILL.md` (+ `agent.toml` for Codex; host symlinks under `.claude/agents/` / `.codex/agents/`) | Heavy visual/scene design for SuperImg: diagrams, line art, palettes, motion graphics, explainers. Loads superimg + animator before implementing. |

**When to load which**
1. **superimg** — always for `*.media.ts` API, config, CLI, `inspect`/`render`
2. **animator** — motion feels stiff/cluttered, beat timing, holds, easing, safe areas
3. **video-designer** — new creative scene work, full visual redesigns, pedagogical viz (spawn subagent; do not skip the two skills)

**Monorepo CLI:** `node ./packages/superimg-cli/dist/cli.js` (or built package bin). Prefer `inspect` before multi-frame still loops; see Debug section in the managed block.
