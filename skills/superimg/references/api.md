# SuperImg API Reference

Complete API documentation for SuperImg templates.

## RenderContext

The `ctx` object passed to your `render` function:

```typescript
interface RenderContext<TData> {
  // Stdlib utilities
  std: Stdlib;

  // Scene timing (use these for animation)
  sceneProgress: number;          // 0-1 progress through current scene
  sceneTimeSeconds: number;       // Elapsed seconds in current scene
  sceneDurationSeconds: number;   // Total scene duration

  // Canvas dimensions
  width: number;                  // Canvas width in pixels
  height: number;                 // Canvas height in pixels
  isPortrait: boolean;            // height > width
  isLandscape: boolean;           // width > height

  // Template data (merged with data defaults)
  data: TData;

  // Global timing (rarely needed)
  globalProgress: number;         // 0-1 progress through entire video
  globalTimeSeconds: number;      // Elapsed seconds total
  totalDurationSeconds: number;   // Total video duration
  fps: number;                    // Frames per second
  frameNumber: number;            // Current frame index
}
```

## ctx.asset(filename)

Get URL for a file in the template's co-located `assets/` folder. Zero config needed.

```typescript
// Place logo.png in assets/ next to your .video.ts file:
// my-template/
//   my-template.video.ts
//   assets/
//     logo.png

render(ctx) {
  return `<img src="${ctx.asset('logo.png')}" />`;
}
```

For named assets with preloaded metadata (dimensions, duration), use `config.assets` + `ctx.assets`:

```typescript
export default defineScene({
  config: {
    assets: { hero: './assets/hero.mp4' }
  },
  render(ctx) {
    const hero = ctx.assets.hero; // { url, type, width, height, duration, mimeType, size }
    return `<video src="${hero.url}" width="${hero.width}" />`;
  }
});
```

## std.tween

The canonical animation primitive. Interpolates between values with easing.

```typescript
std.tween(from: number, to: number, progress: number, easing: EasingName): number
```

**Parameters:**
- `from` - Start value
- `to` - End value
- `progress` - Progress 0-1 (not clamped, can overshoot)
- `easing` - Easing function name

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
const opacity = std.tween(0, 1, progress, "easeOutCubic");

// Slide up with overshoot
const y = std.tween(50, 0, progress, "easeOutBack");

// Scale with bounce
const scale = std.tween(0, 1, progress, "easeOutElastic");

// Linear for progress bars
const width = std.tween(0, 100, progress, "linear");
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

// Flexbox column stack
std.css.stack(): string
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

## std.motion

High-level animation primitives that combine opacity, transform, and CSS generation.

```typescript
// Fade in + slide from offset
std.motion.enter(progress: number, options?: MotionOptions): MotionResult

// Fade out + slide to offset
std.motion.exit(progress: number, options?: MotionOptions): MotionResult

// Three-phase: enter (0→enterEnd), hold, exit (exitStart→1)
std.motion.enterExit(progress: number, options?: EnterExitOptions): MotionResult

interface MotionOptions {
  y?: number;          // Y offset in pixels (default: 20)
  x?: number;          // X offset in pixels (default: 0)
  scale?: number;      // Scale offset from 1 (default: 0)
  easing?: EasingName; // Easing function (default: "easeOutCubic")
}

interface EnterExitOptions extends MotionOptions {
  enterEnd?: number;   // Progress where enter ends (default: 0.33)
  exitStart?: number;  // Progress where exit starts (default: 0.66)
}

interface MotionResult {
  opacity: number;     // Computed opacity (0-1)
  x: number;           // Computed X translation
  y: number;           // Computed Y translation
  scale: number;       // Computed scale factor
  transform: string;   // CSS transform string
  style: string;       // Complete inline style (opacity + transform)
}
```

**Examples:**
```typescript
// Simple fade + slide up
const { style } = std.motion.enter(sceneProgress, { y: 30 });
return `<div style="${style}">Content</div>`;

// Enter-hold-exit for cards
const { style } = std.motion.enterExit(progress, {
  y: 40,
  enterEnd: 0.2,
  exitStart: 0.8
});

// Access individual values for custom combinations
const { opacity, transform } = std.motion.enter(progress, { y: 20, scale: 0.1 });
```

## std.phases

Split progress into named sub-phases.

```typescript
std.phases<K extends string>(
  progress: number,
  config: Record<K, number>  // weights, auto-normalized
): Record<K, Phase>

interface Phase {
  progress: number;  // 0-1 within this phase
  active: boolean;   // True when currently in this phase
  done: boolean;     // True when phase has completed
  start: number;     // Normalized start position (0-1)
  end: number;       // Normalized end position (0-1)
}
```

**Examples:**
```typescript
// Equal phases
const { enter, hold, exit } = std.phases(sceneProgress, { enter: 1, hold: 1, exit: 1 });

// Custom weights (30% enter, 50% hold, 20% exit)
const { intro, main, outro } = std.phases(progress, { intro: 3, main: 5, outro: 2 });

// Combine with motion
const { enter, exit } = std.phases(sceneProgress, { enter: 1, hold: 2, exit: 1 });
const enterAnim = std.motion.enter(enter.progress, { y: 30 });
const exitAnim = std.motion.exit(exit.progress, { y: -30 });
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
  progress: sceneProgress,
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

## std.timeline

Declarative timeline for animation phases.

```typescript
// Create a timeline
const tl = std.timeline(time, duration);

// Define events at absolute positions
const enter = tl.at("enter", 0, 0.8);      // start=0, duration=0.8
const hold = tl.at("hold", 0.8, 2.0);      // start=0.8, duration=2.0
const exit = tl.at("exit", 2.8, 0.8);      // start=2.8, duration=0.8

// TimelineEvent properties
enter.progress   // 0-1 (clamped)
enter.active     // true when 0 < progress < 1
enter.start      // 0
enter.end        // 0.8
enter.duration   // 0.8

// Stagger multiple elements
const items = tl.stagger(["a", "b", "c"], { each: 0.2, duration: 0.5 });
items.get(0).progress  // First item's progress
items.get("b").progress  // Get by ID

// Relative positioning
const fadeIn = tl.follow("enter", { id: "fadeIn", gap: 0.1, duration: 0.5 });

// Scoped timeline (re-zeroed)
const scoped = tl.scope(2, 5);  // time re-zeroed to 0-3
scoped.at("title", 0, 1);  // 0-1 within scope

// Get currently active event
const current = tl.current();  // TimelineEvent | null
```

**Example:**
```typescript
const tl = std.timeline(time, duration);
const enter = tl.at("enter", 0, 0.8);
const hold = tl.at("hold", 0.8, 2.0);
const exit = tl.at("exit", 2.8, 0.8);

const scale = enter.active ? std.tween(0.8, 1, enter.progress, "easeOutBack") : 1;
const opacity = exit.active ? std.tween(1, 0, exit.progress, "easeInCubic") : 1;
return renderCard({ scale, opacity });
```

## std.spring / std.springTween / std.createSpring

Spring physics for organic motion with overshoot and bounce.

```typescript
// Spring curve: 0→1 with overshoot based on physics config
const val = std.spring(progress);                    // default config
const val = std.spring(progress, { stiffness: 200, damping: 8 });

// Interpolate between values with spring physics
const scale = std.springTween(0.8, 1, progress);     // 0.8→overshoot→1
const x = std.springTween(0, 500, progress, { stiffness: 200, damping: 8 });

// Create reusable easing function for std.tween()
const bounce = std.createSpring({ stiffness: 200, damping: 8 });
const y = std.tween(0, 100, progress, bounce);
```

**SpringConfig:**
| Param | Default | Description |
|---|---|---|
| `stiffness` | `100` | Spring constant — higher = faster oscillation |
| `damping` | `10` | Friction — lower = more bouncy |
| `mass` | `1` | Mass — higher = slower, more momentum |

**Example:**
```typescript
// Bouncy card entrance
const bounce = std.createSpring({ stiffness: 150, damping: 12 });
const scale = std.tween(0.8, 1, enterProgress, bounce);
const y = std.tween(40, 0, enterProgress, bounce);
```

## std.stagger

Distribute progress across items for cascading animations.

```typescript
// Count-based: returns array of per-item progress values (each 0-1)
const progresses = std.stagger(5, sceneProgress, { duration: 0.3 });
// progresses[0] leads, progresses[4] trails

// Items-based: returns enriched objects with per-item progress
const items = std.stagger(["A", "B", "C"], sceneProgress, { duration: 0.4 });
items.map(({ item, progress }) =>
  `<div style="opacity: ${progress}">${item}</div>`
).join("");
```

**StaggerOptions:**
| Param | Default | Description |
|---|---|---|
| `each` | auto | Delay between item starts (0-1 fraction) |
| `duration` | auto | Each item's animation window (0-1 fraction) |
| `from` | `"start"` | Direction: `"start"`, `"end"`, `"center"`, `"edges"` |
| `easing` | linear | Per-item easing name or function |

**StaggerItem (items-based overload):**
`{ item, progress, index, active, done }`

**Example:**
```typescript
const { enter, exit } = std.phases(sceneProgress, { enter: 2, hold: 4, exit: 2 });
const enterItems = std.stagger(items, enter.progress, {
  duration: 0.4, from: "center", easing: "easeOutCubic"
});
enterItems.map(({ item, progress }) => {
  const { style } = std.motion.enter(progress, { y: 20 });
  return `<div style="${style}">${item}</div>`;
});
```

## std.interpolate / std.interpolateColor

Multi-keyframe interpolation with arbitrary input ranges.

```typescript
// Fade in, hold, fade out
const opacity = std.interpolate(sceneProgress, [0, 0.2, 0.8, 1], [0, 1, 1, 0]);

// Multi-stop position with easing
const x = std.interpolate(sceneProgress, [0, 0.5, 1], [0, 500, 300], {
  easing: "easeInOutCubic"
});

// Color gradient over time
const bg = std.interpolateColor(sceneProgress, [0, 0.5, 1], ["#f00", "#0f0", "#00f"]);
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
const ringProgress = std.interpolate(sceneProgress, [0, 0.1, 0.9, 1], [0, 0, 360, 360]);

// Background transition through multiple colors
const bg = std.interpolateColor(sceneProgress,
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

// Terminal commands with timeline
const tl = std.timeline(time, duration);
const cmd = tl.at("cmd", 0, 1.0);
const { visible } = std.text.type("npm run dev", cmd.progress);
```

**Other text utilities:** `truncate`, `pluralize`, `formatNumber`, `formatCurrency`, `escapeHtml`, `slugify`, `pad`, `wrap`

## Config Options

Options for `defineScene({ config: { ... } })`:

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `width` | number | 1920 | Canvas width in pixels |
| `height` | number | 1080 | Canvas height in pixels |
| `fps` | number | 30 | Frames per second |
| `durationSeconds` | number | 5 | Scene duration |
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

## defineScene

Template definition function:

```typescript
import { defineScene } from "superimg";

export default defineScene({
  // Default data values (merged with per-render data)
  data: {
    title: "Hello",
    accentColor: "#667eea",
  },

  // Configuration
  config: {
    width: 1920,
    height: 1080,
    fps: 30,
    durationSeconds: 4,
    fonts: ["Inter:wght@400;700"],
    inlineCss: [`
      * { margin: 0; box-sizing: border-box; }
      body { background: #0f0f23; }
    `],
  },

  // Render function (called once per frame)
  render(ctx) {
    // Return HTML string
    return `<div>...</div>`;
  },
});
```
