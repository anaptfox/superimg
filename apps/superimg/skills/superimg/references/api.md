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

  // Template data (merged with defaults)
  data: TData;

  // Global timing (rarely needed)
  globalProgress: number;         // 0-1 progress through entire video
  globalTimeSeconds: number;      // Elapsed seconds total
  totalDurationSeconds: number;   // Total video duration
  fps: number;                    // Frames per second
  frameNumber: number;            // Current frame index
}
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
std.css(styles: Record<string, string | number>): string

// Flexbox centering
std.css.center(): string

// Absolute fill parent
std.css.fill(): string

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
const containerStyle = std.css({ width, height }) + ";" + std.css.center();

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

## std.timing

Phase and sequence management.

```typescript
// Create phase sequence
std.timing.sequence(phases: Record<string, PhaseConfig>): PhaseSequence

interface PhaseConfig {
  duration: number;
  render: (progress: number) => string;
}

interface PhaseSequence {
  render(time: number): string;
  currentPhase: string;
  phaseProgress: number;
}
```

**Example:**
```typescript
const phases = std.timing.sequence({
  enter: {
    duration: 0.8,
    render: (p) => renderCard(std.tween(0, 1, p, "easeOutCubic"))
  },
  hold: {
    duration: 2,
    render: () => renderCard(1)
  },
  exit: {
    duration: 0.8,
    render: (p) => renderCard(std.tween(1, 0, p, "easeInCubic"))
  },
});

return phases.render(time);
```

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
  defaults: {
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
