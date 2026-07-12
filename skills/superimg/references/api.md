# SuperImg API Reference

Complete API documentation for SuperImg templates.

## Templates (`*.media.ts`)

All templates use `define()`. Output kind is config-driven:

| Output | Factory | Config signal | Context | Stdlib | Time? | Returns |
|--------|---------|---------------|---------|--------|-------|---------|
| **MP4/WebM** | `define()` | `fps` + `duration` | `RenderContext` | Full | `timeline`, `ctx.director()`, `ctx.track()`; `compose()` for multi-scene | HTML → MP4 |
| **GIF** | `define()` | `fps` + `duration` + `--format gif` | `RenderContext` | Full | Same as video | HTML → GIF |
| **image** | `define()` | no `fps`/`duration` | `ImageRenderContext` | `ImageStdlib` | None | HTML → PNG/WebP/JPEG |
| **svg** | `define({ medium: "svg" })` | `medium: "svg"` | `SvgRenderContext` | `SvgStdlib` | Optional `config.duration` for CSS anim | **SVG markup** |

`ImageStdlib` / `SvgStdlib` omit: `director`, `track`, `layers`, `reveal`, `carousel`, `stack`, `mergeMotion`, `backgrounds`, `montage`, `oscillate`, `loop`, `pingpong`, `wiggle`.

## Composition model (video + gif only)

| Tier | API | Role |
|------|-----|------|
| **Video** | `compose([scenes])` | Multi-scene chain |
| **Template** | `define()` | Scene contract |
| **Layers** (optional) | `std.layers()` | Shot stack — bg, tint, content, overlay, fx |
| **Director** | `ctx.director()` | Phases + motion (`motion().style`, `tween`, `in`) |

**Satellites:** `ctx.track()`, `std.carousel()` / `std.stack()`, `css`/`layout`, `interpolate`/`spring`/`stagger`, `mergeMotion`, `std.reveal.*` (transition overlays — utility, not a tier).

Wire director into layers: `L.overlay(html, { motion: t.motion({ y: 20 }) })` or inline `style="${card.style}"` in content HTML.

## RenderContext (video + gif)

The `ctx` object passed to your `render` function:

```typescript
interface Timeline {
  frame: number;
  fps: number;
  progress: number;        // 0→1 normalized scene progress
  seconds: number;         // progress × durationSeconds
  durationSeconds: number;
  totalFrames: number;
}

interface RenderContext<TData> {
  std: Stdlib;
  timeline: Timeline;
  director: (phases?: PhaseConfig) => Director;
  track: (opts: TrackSource) => Track;

  // Global timing (entire video — useful inside compose())
  globalFrame: number;
  globalTimeSeconds: number;
  totalFrames: number;
  totalDurationSeconds: number;

  // Scene metadata (multi-scene compositions)
  sceneIndex: number;
  sceneId: string;

  fps: number;
  isFinite: boolean;

  width: number;
  height: number;
  aspectRatio: number;
  isPortrait: boolean;
  isLandscape: boolean;
  isSquare: boolean;

  data: TData;
  assets: Record<string, AssetMeta>;
  asset: (filename: string) => string;
  output: OutputInfo;
  cssViewport?: CssViewport;
}
```

## ctx.asset(filename)

Get URL for a file in the template's co-located `assets/` folder. Zero config needed.

```typescript
// Place logo.png in assets/ next to your .media.ts file:
// my-template/
//   my-template.media.ts
//   assets/
//     logo.png

render(ctx) {
  return `<img src="${ctx.asset('logo.png')}" />`;
}
```

For named assets with preloaded metadata (dimensions, duration), use `config.assets` + `ctx.assets`:

```typescript
export default define({
  config: {
    assets: { hero: './assets/hero.mp4' }
  },
  render(ctx) {
    const hero = ctx.assets.hero; // { url, type, width, height, duration, mimeType, size }
    return `<video src="${hero.url}" width="${hero.width}" />`;
  }
});
```

## ImageRenderContext (image)

```typescript
interface ImageRenderContext<TData> {
  std: ImageStdlib;
  width: number;
  height: number;
  aspectRatio: number;
  isPortrait: boolean;
  isLandscape: boolean;
  isSquare: boolean;
  data: TData;
  assets: Record<string, AssetMeta>;
  asset: (filename: string) => string;
  output: OutputInfo;
}
```

## SvgRenderContext (svg)

Same as image, plus optional `duration?: number` for CSS `animation-duration`. `render()` must return `<svg xmlns="http://www.w3.org/2000/svg" ...>`.

## Naming disambiguation

| Name | Scope | Purpose |
|------|-------|---------|
| `ctx.director()` | video/gif scene | Phase choreography — `motion()`, `tween()`, `in()` |
| `ctx.track()` | video/gif scene | Transcript/marker sync via `timeline.seconds` |
| `std.carousel()` | video/gif scene | One active item; prior items exit their slot |
| `std.stack()` | video/gif scene | Accumulate items; `enter` + `slot` for sub-beats |
| `std.layers()` | video/gif scene | Z-ordered shot stack |
| `std.reveal.*()` | video/gif utility | Full-frame transition overlays |
| `std.reveal.clip.*()` | any element | Clip-path reveal strings (`circle`, `wipe`, `inset`, `iris`) |
| `compose([scenes])` | Multi-scene video | Chain scenes |
| `mergeMotion()` | video/gif | Merge motion values (not `compose()`) |
| `createTimelineController()` | Player UI | Playback scrubber |
| `examples/data/timeline/` | Template name | Chart template only |

## ctx.director()

The primary primitive for layout orchestration and phased animation. Breaks a scene into enter/hold/exit phases and exposes motions scoped to those phases with automatic fade-in + fade-out.

```typescript
const t = ctx.director(phases?: PhaseConfig);  // default: { enter: "15%", hold: "70%", exit: "15%" }
```

**Returns** a director with `motion()`, `tween()`, `value()`, `active`, `in()`, `at()`, `clip()`.

### t.motion(opts?)

The 80% case for animating elements. Returns a `.style` string combining opacity + transform.

```typescript
const card = t.motion({ y: 30, scale: 0.8, easing: "easeOutBack" });
// <div style="${card.style}">...</div>
```

**Options:** `y`, `x`, `scale`, `rotate`, `blur` (number — start offsets), `at` (`"0.5s"` or `"20%"` stagger within phase), `for` (`"0.5s"` or `"30%"` span of phase), `during`, `easing` (enter easing name), `exit` (boolean or override object).

**Result fields:** `.style`, `.opacity`, `.transform`, `.enter` (0-1 entry progress), `.exit` (0-1 exit progress), `.visible`, `.phase`.

### t.tween(from, to, opts?)

Phase-scoped scalar interpolation. Use for counters or progress bars tied to a specific phase.

```typescript
const count = Math.floor(t.tween(0, 100, { during: "enter", easing: "easeOutCubic" }));
```

### t.in(phase, opts?)

Returns 0-1 progress inside a specific phase, with optional stagger (`at`) and `duration`.

```typescript
const p = t.in("hold", { at: "50%", duration: "50%" });
```

### t.span(from, to)

Scene-absolute progress window in seconds (e.g. intro wipe from scene start):

```typescript
const introP = t.span("0s", "1s");
const wipe = std.reveal.wipe({ progress: introP, direction: "diagonal", color: accent });
```

### t.transition(from, to, easing?)

Eased scene-absolute handoff progress. Use with `t.inSpan()` for cross-phase transitions:

```typescript
if (t.inSpan("3s", "4s")) {
  const p = t.transition("3s", "4s", "easeInOutCubic");
  const toLocal = std.reveal.handoffLocal(p);
  // split/crossfade content panels only — keep shared bg outside
}
```

**Phases vs spans:** `t.active` / `t.in("hook")` for steady shots; `t.inSpan()` + `t.transition()` for windows that cross phase boundaries.

### t.at(phase, dataSeconds)

Maps scene-local data time (seconds) to progress within a named phase. Use for data-driven viz (bar race, force graphs).

```typescript
const bars = std.viz.charts.barRace(keyframes, t.at("race", timeline.seconds));
```

## ctx.track()

Transcript and marker sync using `timeline.seconds`.

```typescript
const vo = ctx.track({ words: data.words });
const word = vo.current();
const charP = vo.charProgress();
```

## std.carousel()

One active item at a time; previous items exit their slot. Use for thread slides, wizard steps, single-card transitions.

```typescript
const t = ctx.director({ tweets: "84%", hold: "16%" });
const car = std.carousel(tweets, { during: t.in("tweets"), exit: 0.15, last: "hold" });
const item = car.state(0); // { enter, exit, visible, active, state: hidden|entering|hold|exiting|gone }
```

## std.stack()

Ordered reveal; items stay visible once shown. Use for chat, FAQ, ranked lists.

```typescript
const t = ctx.director({ messages: "90%", hold: "10%" });
const stk = std.stack(messages, { during: t.in("messages"), lead: 0.05, trail: 0.05 });
const item = stk.state(0); // { enter, slot, visible, active, state: hidden|entering|revealed }
```

---

## std.interpolate

Low-level multi-keyframe interpolation. Maps a `progress` value through paired input/output ranges with optional easing.

```typescript
std.interpolate(progress: number, inputRange: number[], outputRange: number[], easing?: EasingName | EasingFn): number
```

**Parameters:**
- `progress` - Input value (clamped to inputRange endpoints)
- `inputRange` - Input breakpoints (e.g. `[0, 1]` or `[0, 0.5, 1]`)
- `outputRange` - Output values at each breakpoint (same length as inputRange)
- `easing` - Optional easing name or function applied per segment

**Available Easings:**

| Easing | Description | Use Case |
|--------|-------------|----------|
| `"linear"` | No easing | Constant motion, progress bars |
| `"easeOutCubic"` | Fast start, smooth stop | Most animations (default choice) |
| `"easeInCubic"` | Slow start, fast end | Exit animations |
| `"easeInOutCubic"` | Smooth start and end | Looping, back-and-forth |
| `"easeOutBack"` | Overshoot then settle | Bouncy entrances, pop-in |
| `"easeOutElastic"` | Spring oscillation | Playful, attention-grabbing |
| `"easeOutBounce"` | Bounce at end | Ball drop, landing |

**Examples:**
```typescript
// Fade in
const opacity = std.interpolate(progress, [0, 1], [0, 1], "easeOutCubic");

// Slide up with overshoot
const y = std.interpolate(progress, [0, 1], [50, 0], "easeOutBack");

// Scale with bounce
const scale = std.interpolate(progress, [0, 1], [0, 1], "easeOutElastic");

// Linear for progress bars
const width = std.interpolate(progress, [0, 1], [0, 100], "linear");
```

## std.math

Mathematical utilities for animation calculations.

```typescript
// Clamp value to range
std.math.clamp(value: number, min: number, max: number): number

// Remap value from one range to another
std.math.map(value: number, inMin: number, inMax: number, outMin: number, outMax: number): number

// Remap with output clamping
std.math.mapClamp(value: number, inMin: number, inMax: number, outMin: number, outMax: number): number

// Hermite interpolation (smooth 0→1)
std.math.smoothstep(edge0: number, edge1: number, x: number): number

// Step function (0 if x < edge, 1 otherwise)
std.math.step(edge: number, x: number): number

// Fractional part (x - floor(x))
std.math.fract(x: number): number

// Wrap to range [0, length)
std.math.repeat(t: number, length: number): number

// Oscillate 0→length→0
std.math.pingPong(t: number, length: number): number

// 1D/2D/3D noise (-1 to 1)
std.math.noise(x: number): number
std.math.noise2D(x: number, y: number): number
std.math.noise3D(x: number, y: number, z: number): number

// Set noise seed for reproducibility
std.math.setNoiseSeed(seed: number): void

// Degree/radian conversion
std.math.degToRad(deg: number): number
std.math.radToDeg(rad: number): number

// Random (non-deterministic)
std.math.random(min: number, max: number): number
std.math.randomInt(min: number, max: number): number
std.math.shuffle<T>(array: T[]): T[]
```

**Common Patterns:**
```typescript
// Create 0→1 progress over 1.5 seconds
const progress = std.math.clamp(time / 1.5, 0, 1);

// Delayed start (after 0.5s)
const delayedProgress = std.math.clamp((time - 0.5) / 1.0, 0, 1);

// Looping animation (0→1 every 2 seconds)
const loop = std.math.fract(time / 2);

// Ping-pong (0→1→0 every 2 seconds)
const pingPong = std.math.pingPong(time, 1);
```

## std.color

Color manipulation utilities.

```typescript
// Add transparency
std.color.alpha(color: string, opacity: number): string

// Blend two colors (t: 0=color1, 1=color2)
std.color.mix(color1: string, color2: string, t: number): string

// Lighten by percentage (0-1)
std.color.lighten(color: string, amount: number): string

// Darken by percentage (0-1)
std.color.darken(color: string, amount: number): string

// Create HSL color string
std.color.hsl(h: number, s: number, l: number): string

// Parse color to RGB object
std.color.parse(color: string): { r: number, g: number, b: number }

// Convert RGB to hex
std.color.toHex(r: number, g: number, b: number): string
```

**Examples:**
```typescript
// Semi-transparent accent
const glow = std.color.alpha("#667eea", 0.5);

// Gradient between colors
const gradient = std.color.mix("#ff0000", "#0000ff", progress);

// Hover state
const hoverColor = std.color.lighten("#333", 0.2);

// Dynamic hue
const rainbow = std.color.hsl(time * 60, 70, 50);
```

## std.css

Convert objects to inline CSS strings.

```typescript
// Object to inline style
std.css(...args: (Record<string, string | number> | string)[]): string

// Flexbox centering
std.css.center(): string

// Absolute fill parent
std.css.fill(): string

// Flexbox row layout
std.css.row(): string

// Flexbox column layout
std.css.column(): string
```

## std.layers

Within-scene layer stack. Declaration order = z-order (bottom to top).

```typescript
const L = std.layers({ width, height, mode: "opaque" | "transparent" | "split" });

return L.render(
  L.bg(kenBurns.html),                              // full-bleed background
  L.tint("rgba(0,0,0,0.5)"),                        // color wash
  L.content(`<h1>...</h1>`, { safe: "broadcast" }), // main message
  L.overlay(html, { anchor: "bottom-left", offset: { y: 80 }, safe: true }),
  L.fx(wipe.html, { visible: () => wipe.active }),  // transient FX
);

// Content-only handoff (shared bg + transition panels + pinned hero)
return L.handoff({
  shared: [L.bg(kenBurns.html), L.tint("rgba(0,0,0,0.5)")],
  transition: std.reveal.split({ from: hookPanel, to: featuresPanel, progress: p }),
  pinned: [L.overlay(phone, { anchor: { x: "73%", y: "50%", origin: "center" } })],
});
```

**Ken Burns rule:** Keep `kenBurns` in `shared` / single `L.bg()` — never inside both split panels (zoom seams).

**Overlay anchors:** `{ x, y, origin: "center" }` applies `translate(-50%, -50%)` and merges with `motion` transforms.

## Transition FX utilities (`std.reveal`)

Progress-driven full-frame overlays. Not a compositional tier — mount via `L.fx()`. Returns `{ html, active, progress }`.

```typescript
std.reveal.wipe({ progress, direction: "diagonal", color });
std.reveal.split({ from, to, progress, style: "wipe" | "slide" | "flip" | "split" });
std.reveal.curtain({ progress, direction: "up" });
std.reveal.crossfade({ progress, from, to });
std.reveal.iris({ progress, color });
std.reveal.handoffLocal(progress, { peek: 0.1 });  // frozen "to" panel during handoff

// Clip-path strings for any element (including SVG containers)
std.reveal.clip.circle(progress, { cx: 0.5, cy: 0.5 });
std.reveal.clip.wipe(progress, "right");
std.reveal.clip.inset(progress);
std.reveal.clip.iris(progress, 6);
```

## std.mergeMotion

Merge motion values (not video `compose()`):

```typescript
std.mergeMotion(card, { scale: 1.05 });
```

**Property Conversion:**
- `fontSize: 48` → `font-size: 48px`
- `opacity: 0.5` → `opacity: 0.5`
- `transform: "translateY(10px)"` → `transform: translateY(10px)`
- camelCase → kebab-case automatically

**Examples:**
```typescript
// Root container
const containerStyle = std.css({ width, height }, std.css.center());

// Animated element
const elementStyle = std.css({
  opacity,
  fontSize: 64,
  color: accentColor,
  transform: `translateY(${y}px) scale(${scale})`,
});

// Usage in template
return `<div style="${containerStyle}">
  <h1 style="${elementStyle}">${title}</h1>
</div>`;
```

## std.createResponsive

Factory for aspect-ratio-based value selection.

```typescript
std.createResponsive(ctx: RenderContext): <T>(options: ResponsiveOptions<T>) => T

interface ResponsiveOptions<T> {
  portrait?: T;   // When height > width
  landscape?: T;  // When width > height
  square?: T;     // When width ≈ height
  default?: T;    // Fallback value
}
```

**Examples:**
```typescript
const r = std.createResponsive(ctx);

// Responsive font sizes
const hookSize = r({ portrait: 68, square: 32, default: 48 });
const titleSize = r({ portrait: 44, square: 22, default: 32 });

// Responsive padding
const padding = r({ portrait: [64, 48], square: [28, 28], default: [44, 44] });

// Responsive layout direction
const direction = r({ portrait: "column", default: "row" });
```

## std.backgrounds

Background effect utilities.

```typescript
std.backgrounds.kenBurns(options: KenBurnsOptions): KenBurnsResult

interface KenBurnsOptions {
  src: string;         // Image URL
  progress: number;    // 0-1 for zoom animation
  zoomFrom?: number;   // Starting zoom (default: 1.0)
  zoomTo?: number;     // Ending zoom (default: 1.1)
  overlay?: string;    // Overlay color (default: "rgba(0,0,0,0.5)")
  position?: string;   // Background position (default: "center")
  overflow?: number;   // Buffer pixels for zoom (default: 50)
}

interface KenBurnsResult {
  zoom: number;           // Current zoom value
  backgroundStyle: string; // Style for background div
  overlayStyle: string;    // Style for overlay div
  html: string;           // Complete HTML for bg + overlay
}
```

**Example:**
```typescript
const bg = std.backgrounds.kenBurns({
  src: data.backgroundImage,
  progress: timeline.progress,
  overlay: "rgba(0, 0, 0, 0.6)"
});

return `
  <div style="${std.css({ width, height, position: 'relative', overflow: 'hidden' })}">
    ${bg.html}
    <div style="position: relative; z-index: 1;">
      <!-- Content here -->
    </div>
  </div>
`;
```

## ctx.track()

Transcript and marker sync using `timeline.seconds`.

```typescript
const vo = ctx.track({ words: data.words });
const t = vo.transcript();
const current = t.current();
const phrase = t.between(0, 3);
const chars = t.charProgress();

const mk = ctx.track({ markers: { intro: 0, main: 2.5, outro: 8 } });
const fadeIn = mk.markers().progress("intro", "main");
```

**Example:**
```typescript
const vo = ctx.track({ words: data.words });
const t = vo.transcript();
const active = t.current();
const opacity = active ? std.interpolate(active.progress, [0, 1], [0.4, 1], "easeOutCubic") : 0.4;
return renderCaption({ text: active?.text ?? "", opacity });
```

Use `ctx.director()` for scene-local phase choreography. Use `ctx.track()` when timing comes from absolute timestamps or external narration data.

## std.spring

Spring physics for organic motion. Prefer **named** presets (omakase).

```typescript
// Named springs (recommended)
const scale = std.spring(0.8, 1, progress, "gentle");   // default if omitted
const pop   = std.spring(0.85, 1, progress, "playful");
// names: gentle | snappy | fluid | playful | wobbly

// Also valid as director easing
t.motion({ scale: 0.92, easing: "playful" });

// Raw SpringConfig when needed
std.spring(0, 100, progress, { stiffness: 170, damping: 26, mass: 1 });
```

**Named springs (defaults when config omitted → `gentle`):**

| Name | Feel |
|---|---|
| `gentle` | Critically damped settle (default) |
| `snappy` | Fast UI settle |
| `fluid` | Between gentle and snappy |
| `playful` | Soft overshoot — entrances |
| `wobbly` | Expressive bounce — rare |

**SpringConfig:** `stiffness`, `damping`, `mass` (optional overrides).

## std.stagger

Distribute progress across items for cascading animations.

```typescript
// Preferred: ms gaps + hard 500ms cascade cap
const items = std.stagger.ms(["A", "B", "C"], t.in("enter"), {
  windowSeconds: 1.5,
  eachMs: 50,
  capMs: 500,
  from: "start",
});

// Fraction API (default easing: easeOutCubic)
const progresses = std.stagger(5, timeline.progress, { duration: 0.3 });
```

**StaggerOptions (fraction):**
| Param | Default | Description |
|---|---|---|
| `each` | auto | Delay between item starts (0-1 fraction) |
| `duration` | auto | Each item's animation window (0-1 fraction) |
| `from` | `"start"` | Direction: `"start"`, `"end"`, `"center"`, `"edges"` |
| `easing` | `easeOutCubic` | Per-item easing name or function |

**stagger.ms options:** `windowSeconds` (required), `eachMs` (default 50), `capMs` (default 500), plus `from` / `easing`.

**StaggerItem:** `{ item, progress, index, active, done, startMs?, eachMs?, totalStaggerMs? }`

**Lead index:** `std.stagger.lead(items, progress, opts?)` — highest progress above threshold.

**Also:** `std.phases.recipe("card"|"establish"|"punchy"|…)` and `std.timing.readTime(text)`.

## std.interpolate / std.interpolateColor

Multi-keyframe interpolation with arbitrary input ranges.

```typescript
// Fade in, hold, fade out
const opacity = std.interpolate(timeline.progress, [0, 0.2, 0.8, 1], [0, 1, 1, 0]);

// Multi-stop position with easing
const x = std.interpolate(timeline.progress, [0, 0.5, 1], [0, 500, 300], {
  easing: "easeInOutCubic"
});

// Color gradient over time
const bg = std.interpolateColor(timeline.progress, [0, 0.5, 1], ["#f00", "#0f0", "#00f"]);
```

**InterpolateOptions:**
| Param | Default | Description |
|---|---|---|
| `easing` | linear | Applied per segment |
| `extrapolate` | `"clamp"` | Behavior outside range: `"clamp"` or `"extend"` |
| `extrapolateLeft` | — | Override for below-range values |
| `extrapolateRight` | — | Override for above-range values |

**Example:**
```typescript
// Ring animation: delay start, hold at end
const ringProgress = std.interpolate(timeline.progress, [0, 0.1, 0.9, 1], [0, 0, 360, 360]);

// Background transition through multiple colors
const bg = std.interpolateColor(timeline.progress,
  [0, 0.3, 0.7, 1],
  ["#0f172a", "#1e1b4b", "#1e1b4b", "#0f172a"]
);
```

## std.text

Text manipulation and typing animation primitives.

```typescript
// Progress-driven text reveal (char, word, or line granularity)
std.text.type(text: string, progress: number, options?: { by?: 'char' | 'word' | 'line' }): TypeResult

interface TypeResult {
  visible: string;   // The revealed portion
  typing: boolean;   // True while 0 < progress < 1
  done: boolean;     // True when progress >= 1
  index: number;     // Visible unit count
  total: number;     // Total unit count
}

// Calculate typing duration from speed
std.text.typeDuration(text: string, options?: { by?: 'char' | 'word' | 'line', speed?: number }): number

// Blinking cursor helper
std.text.cursor(time: number, rate?: number): boolean
```

**Default speeds for `typeDuration`:** char: 30/sec, word: 5/sec, line: 2/sec

**Examples:**
```typescript
// Basic typewriter
const dur = std.text.typeDuration("Hello, World!", { speed: 40 });
const progress = std.math.clamp(time / dur, 0, 1);
const { visible, typing } = std.text.type("Hello, World!", progress);
const show = std.text.cursor(time);
return `<div>${visible}${typing && show ? '▋' : ''}</div>`;

// Code typing with Shiki highlighting
const { visible } = std.text.type(CODE, progress, { by: 'line' });
const highlighted = std.code.highlight(visible, { lang: 'typescript' });

// Terminal commands with director()
const t = ctx.director({ enter: "25%", hold: "50%", exit: "25%" });
const cmdProgress = t.in("enter");
const { visible: cmdVisible } = std.text.type("npm run dev", cmdProgress);
```

**Other text utilities:** `truncate`, `pluralize`, `formatNumber`, `formatCurrency`, `escapeHtml`, `slugify`, `pad`, `wrap`

## Config Options

Options for `define({ config: { ... } })`:

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `width` | number | 1920 | Canvas width in pixels |
| `height` | number | 1080 | Canvas height in pixels |
| `fps` | number | 30 | Frames per second |
| `duration` | `Duration` | — | Scene duration. Accepts `number` (seconds), `"5s"`, `"500ms"`, or `"30f"` (frames). |
| `fonts` | string[] | [] | Google Fonts to load |
| `inlineCss` | string[] | [] | CSS injected into page |
| `stylesheets` | string[] | [] | External CSS URLs |
| `outputs` | Record | - | Named output variants |

**Font Format:**
```typescript
fonts: [
  "Inter:wght@400;600;700",
  "JetBrains+Mono:wght@400;600",
  "Space+Grotesk:wght@400;700"
]
```

**Multiple Outputs:**
```typescript
outputs: {
  youtube: { width: 1920, height: 1080 },
  square: { width: 1080, height: 1080 },
  stories: { width: 1080, height: 1920 },
}
```

## define()

Unified template factory — all templates live in `*.media.ts`:

```typescript
import { define } from "superimg";

// Animated (MP4/GIF) — fps + duration
export default define({
  sample: { title: "Hello", accentColor: "#667eea" },
  config: {
    width: 1920,
    height: 1080,
    fps: 30,
    duration: 4,
    fonts: ["Inter:wght@400;700"],
    inlineCss: [`* { margin: 0; box-sizing: border-box; } body { background: #0f0f23; }`],
  },
  render(ctx) {
    return `<div>...</div>`;
  },
});

// Still image — omit fps/duration
export default define({
  sample: { title: "OG Card" },
  config: { width: 1200, height: 630, outputs: { og: { format: "png" } } },
  render(ctx) { return `<div>...</div>`; },
});

// SVG — medium: "svg", return <svg xmlns="http://www.w3.org/2000/svg">...</svg>
export default define({
  medium: "svg",
  config: { width: 800, height: 400 },
  render(ctx) { return `<svg xmlns="http://www.w3.org/2000/svg">...</svg>`; },
});
```
