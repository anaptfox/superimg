# SuperImg API Reference

This document provides an overview of key concepts and utilities available when working with SuperImg, including the rendering context and the standard library (stdlib).

## RenderContext

The `RenderContext` is the central object passed to your template's `render` function. It contains all information needed to render a single frame, including timing, dimensions, and data.

### Properties

```typescript
interface RenderContext<
  TData = Record<string, unknown>,
> {
  // Standard library (tween, math, color utilities)
  std: Stdlib;

  // Global position (entire video)
  globalFrame: number;              // Current frame in video (0-indexed)
  globalTimeSeconds: number;        // Current time in video
  globalProgress: number;           // Progress through video (0-1)
  totalFrames: number;              // Total frames in video
  totalDurationSeconds: number;     // Total duration in seconds

  // === Scene Position (equals global in single-template mode) ===
  /** Current frame within this scene (0-indexed) */
  sceneFrame: number;
  /** Current time in seconds within this scene */
  sceneTimeSeconds: number;
  /** Progress through this scene (0-1) */
  sceneProgress: number;
  /** Total frames in this scene */
  sceneTotalFrames: number;
  /** Duration of this scene in seconds */
  sceneDurationSeconds: number;

  // Scene metadata
  sceneIndex: number;               // Index of current scene (0-indexed)
  sceneId: string;                  // ID of current scene

  // Video info
  fps: number;                      // Frames per second
  isFinite: boolean;                // Has finite duration

  // Dimensions
  width: number;                    // Canvas width in pixels
  height: number;                   // Canvas height in pixels
  aspectRatio: number;              // width / height
  isPortrait: boolean;              // height > width
  isLandscape: boolean;             // width > height
  isSquare: boolean;                // width === height

  // Data
  data: TData;                      // Template data

  // Output configuration
  output: OutputInfo;

  // CSS viewport (for responsive templates)
  cssViewport?: CssViewport;
}

interface OutputInfo {
  name: string;
  width: number;
  height: number;
  fit: FitMode;
}

type FitMode = 'stretch' | 'contain' | 'cover';

interface CssViewport {
  width: number;
  height: number;
  devicePixelRatio: number;
}
```

### Usage Example

```typescript
import { defineTemplate } from 'superimg';

export default defineTemplate({
  defaults: { title: 'Hello' },
  render(ctx) {
    const { std, sceneProgress, width, height, data } = ctx;

    // Eased interpolation in one call
    const x = std.tween(0, width, sceneProgress, 'easeOutCubic');

    return `
      <div style="
        transform: translateX(${x}px);
        width: ${width}px;
        height: ${height}px;
      ">
        ${data.title}
      </div>
    `;
  },
});
```

---

## Standard Library (Stdlib)

The Standard Library provides utility functions for animations, math, colors, text, dates, timing, responsive layouts, subtitles, and presets. Access it via `ctx.std` in your render function.

### Usage

```typescript
import { defineTemplate } from 'superimg';

export default defineTemplate({
  render(ctx) {
    const { std, sceneProgress } = ctx;

    // Tween: eased interpolation
    const x = std.tween(0, 1920, sceneProgress, 'easeOutCubic');
    const clamped = std.math.clamp(x, 100, 1800);

    // Color
    const bg = std.color.alpha('#FF0000', 0.5);
    const mixed = std.color.mix('#FF0000', '#0000FF', sceneProgress);
    const rgb = std.color.hslToRgb(sceneProgress * 360, 80, 50);

    return `<div style="left: ${x}px; background: ${bg}">Hello</div>`;
  },
});
```

### Core Modules (start here)

These modules cover 90%+ of template needs. Start with these.

#### `std.css`

Convert style objects to inline style strings. Numeric values get `px` automatically (except unitless properties like `opacity`, `zIndex`, `lineHeight` — uses canonical CSS unitless list):

```typescript
std.css({ width: 1920, height: 1080, opacity: 0.8 })
// → "width:1920px;height:1080px;opacity:0.8"

std.css({ display: 'flex', alignItems: 'center', transform: `scale(${scale})` })
// → "display:flex;align-items:center;transform:scale(1.2)"
```

Layout presets:

```typescript
std.css.fill()   // position:absolute; top:0; left:0; width:100%; height:100%
std.css.center() // display:flex; align-items:center; justify-content:center
std.css.stack()  // display:flex; flex-direction:column
```

#### `std.tween`

Eased interpolation in one call (canonical animation primitive):

```typescript
std.tween(0, 100, progress)                    // Linear
std.tween(0, 100, progress, 'easeOutCubic')    // With easing
std.tween(0, 100, sceneProgress, {             // With time window (20%-60%)
  easing: 'easeOutCubic',
  start: 0.2,
  end: 0.6,
})
```

#### `std.math`

Mathematical utilities:

```typescript
// Linear interpolation
std.math.inverseLerp(a, b, value)  // Normalize value to [0,1] within range
std.math.mapClamp(val, inMin, inMax, outMin, outMax)  // Map + clamp output

// Clamping
std.math.clamp(value, min, max)   // Restrict value to range

// Mapping
std.math.map(value, inMin, inMax, outMin, outMax)  // Map value from one range to another (no clamp)

// Random
std.math.random(min, max)         // Random float between min and max
std.math.randomInt(min, max)      // Random integer between min and max (inclusive)
std.math.shuffle(array)           // Fisher-Yates shuffle, returns new array

// Noise
std.math.setNoiseSeed(seed)       // Set seed for reproducible noise
std.math.noise(x)                 // 1D simplex noise (-1 to 1)
std.math.noise2D(x, y)           // 2D simplex noise (-1 to 1)
std.math.noise3D(x, y, z)        // 3D simplex noise (-1 to 1)

// Angle conversion
std.math.degToRad(deg)            // Degrees to radians
std.math.radToDeg(rad)            // Radians to degrees
```

#### `std.color`

Color manipulation:

```typescript
// Conversion
std.color.hexToRgb(hex)           // Hex to { r, g, b }
std.color.rgbToHex(r, g, b)      // RGB to hex string
std.color.hslToRgb(h, s, l)      // HSL to { r, g, b }
std.color.rgbToHsl(r, g, b)      // RGB to { h, s, l }
std.color.hsl(h, s, l)           // Create HSL color string: "hsl(180, 50%, 50%)"

// Parsing
std.color.parseColor(str)         // Parse color string to { r, g, b }
std.color.isLight(color)          // Check if color is light (boolean)

// Alpha/transparency
std.color.alpha(color, opacity)   // Add alpha: alpha('#FF0000', 0.5) → 'rgba(255, 0, 0, 0.5)'

// Mixing
std.color.mix(color1, color2, t)  // Blend two colors

// Adjustments
std.color.lighten(color, amount)  // Lighten by percentage
std.color.darken(color, amount)   // Darken by percentage
std.color.saturate(color, amount) // Increase saturation
std.color.desaturate(color, amount) // Decrease saturation
```

### Extended Modules

These modules provide specialized functionality beyond the core set.

#### `std.text`

Text manipulation utilities:

```typescript
std.text.truncate(str, len, suffix?)       // Truncate string (default suffix: "...")
std.text.pluralize(n, singular, plural?)   // Pluralize word based on count
std.text.formatNumber(num, locale?)        // Locale-specific number formatting
std.text.formatCurrency(num, currency?, locale?)  // Format as currency
std.text.escapeHtml(str)                   // Escape HTML special characters
std.text.slugify(str)                      // Convert to URL-friendly slug
std.text.pad(str, len, char?, side?)       // Pad string (side: 'left' | 'right' | 'both')
std.text.wrap(text, maxCharsPerLine)       // Wrap text into lines, returns string[]
```

#### `std.date`

Date formatting and manipulation:

```typescript
std.date.formatDate(date, formatStr)  // Format date (date-fns tokens; legacy YYYY/DD supported; uses UTC)
std.date.relativeTime(date)           // Relative time string (e.g., "2 hours ago")
std.date.parseISO(str)                // Parse ISO date string to Date
std.date.toISO(date)                  // Convert date to ISO string
std.date.diffDays(d1, d2)             // Difference in days (absolute)
std.date.diffSeconds(d1, d2)          // Difference in seconds (absolute)
```

Date inputs accept `Date`, `string`, or `number` (timestamp).

#### `std.timing`

Timing and phase management for animations:

```typescript
// Sequential phases (durations only — boundaries computed automatically)
const phases = std.timing.sequence({
  intro: 1.0,
  main: 3.0,
  outro: 1.0,
});
// intro: 0-1s, main: 1-4s, outro: 4-5s

// Or explicit boundaries
const phases = std.timing.createPhaseManager({
  intro: { start: 0, end: 1.0 },
  bars: { start: 1.0, end: 5.5 },
  highlight: { start: 5.5, end: 7.0 },
});

const { name, progress } = phases.get(2.0);       // Get current phase at time
const p = phases.getPhaseProgress(2.0, 'bars');  // Get progress within a specific phase

// Convenience functions (no manager needed)
std.timing.getPhase(time, phases)                  // Get phase at time
std.timing.phaseProgress(time, phaseName, phases)  // Get progress within a phase
```

The `PhaseManager` class provides `get(time)` and `getPhaseProgress(time, phaseName)` methods.

#### `std.responsive`

Responsive layout helper based on canvas aspect ratio:

```typescript
const direction = std.responsive.responsive({
  portrait: 'column',
  landscape: 'row',
  square: 'row',
  default: 'row',
}, ctx);
```

```typescript
std.responsive.responsive(options, ctx)  // Choose value based on orientation
```

Options: `{ portrait?, landscape?, square?, default? }`. Falls back to `default`, then first available.

#### `std.subtitle`

Subtitle parsing, generation, and display utilities for SRT/VTT formats:

```typescript
// Parsing
std.subtitle.parseSRT(content, options?)     // Parse SRT content to Cue[]
std.subtitle.parseVTT(content, options?)     // Parse VTT content to Cue[]
std.subtitle.parseTime(timeStr)              // Parse timestamp string to milliseconds

// Generation
std.subtitle.generateSRT(cues)              // Generate SRT content from Cue[]
std.subtitle.generateVTT(cues, header?)     // Generate VTT content from Cue[]
std.subtitle.formatTime(ms, format)         // Format ms to timestamp ('srt' | 'vtt')

// Display
std.subtitle.getCueAtTime(cues, timeMs)     // Get active cue at time (or null)
std.subtitle.getCuesAtTime(cues, timeMs)    // Get all active cues at time
std.subtitle.getCueProgress(cue, timeMs)    // Progress through a cue (0-1)
```

A `Cue` has: `{ index?, start, end, text, settings? }` (times in milliseconds).

#### `std.presets`

Platform presets for common social media dimensions:

```typescript
std.presets.getPreset(path)            // Get preset by dot-path (e.g., "instagram.video.reel")
std.presets.listPresets()              // List all presets with paths
std.presets.listVideoPresets()         // List video presets only
std.presets.formatPresetLabel(path)    // Format path as display label (e.g., "Instagram Reel")
std.presets.platforms                  // Raw platforms data object
```

Supported platforms: `instagram`, `facebook`, `x_twitter`, `linkedin`, `youtube`, `tiktok`, `pinterest`, `snapchat`, `threads`, `reddit`.

A `Preset` has: `{ width, height, aspect_ratio?, fps?, duration_max_seconds?, notes? }`.

---

## Template Module

The recommended way to create a template is with `defineTemplate`:

```typescript
import { defineTemplate } from 'superimg';

export default defineTemplate({
  defaults: {
    title: 'Hello',
    color: '#ffffff',
  },
  config: {
    width: 1920,
    height: 1080,
    fps: 30,
    durationSeconds: 5,
  },
  render(ctx) {
    const { std, sceneProgress, data } = ctx;
    const opacity = std.tween(0, 1, sceneProgress, 'easeOutCubic');

    return `
      <div style="color: ${data.color}; opacity: ${opacity}">
        ${data.title}
      </div>
    `;
  },
});
```

`defineTemplate` is an identity function that provides full type inference from the defaults — no manual type annotations needed.

### TemplateModule Interface

```typescript
interface TemplateModule<TData = Record<string, unknown>> {
  // Required
  render: (ctx: RenderContext<TData>) => string;

  // Optional
  config?: TemplateConfig;
  defaults?: Partial<TData>;
}

interface TemplateConfig {
  width?: number;           // Canvas width (default: 1920)
  height?: number;          // Canvas height (default: 1080)
  fps?: number;             // Frames per second (default: 30)
  durationSeconds?: number; // Duration in seconds (see Duration Precedence)
  fonts?: string[];        // Google Fonts to load
  inlineCss?: string[];    // Raw CSS strings (e.g. utility classes, precompiled Tailwind)
  stylesheets?: string[];  // Stylesheet URLs to load
  outputs?: Record<string, OutputPreset>;
}
```

---

## Result Types

All async operations return discriminated union types for explicit error handling.

### LoadResult

Returned by `Player.load()`:

```typescript
type LoadResult =
  | { status: 'success'; totalFrames: number; durationSeconds: number;
      width: number; height: number; fps: number }
  | { status: 'error'; errorType: 'compilation' | 'validation' | 'network';
      message: string; suggestion: string; details?: Record<string, unknown> };
```

### RenderResult

Returned by render operations:

```typescript
type RenderResult =
  | { status: 'success'; outputPath: string; totalFrames: number;
      durationSeconds: number; fileSizeBytes: number; renderTimeMs: number }
  | { status: 'error'; errorType: 'template' | 'encoding' | 'io' | 'validation';
      failedAtFrame: number; message: string; suggestion: string;
      details?: Record<string, unknown> };
```

### Usage

```typescript
const result = await player.load(template);

if (result.status === 'success') {
  console.log(`Loaded ${result.totalFrames} frames`);
  player.play();
} else {
  console.error(`Load failed: ${result.message}`);
  console.error(`Suggestion: ${result.suggestion}`);
}
```

---

## Error Classes

Structured errors with actionable suggestions:

```typescript
class SuperImgError extends Error {
  code: string;
  details: Record<string, unknown>;
  suggestion: string;
  docsUrl?: string;
}

// Specific error types
class TemplateCompilationError extends SuperImgError { }
class TemplateRuntimeError extends SuperImgError { }
class ValidationError extends SuperImgError { }
class RenderError extends SuperImgError { }
class IOError extends SuperImgError { }
class PlayerNotReadyError extends SuperImgError { }
```

---

## Mode Enums

Explicit modes replace boolean options:

```typescript
// Playback behavior
type PlaybackMode = 'once' | 'loop' | 'ping-pong';

// When to load content
type LoadMode = 'eager' | 'lazy';

// Hover interaction behavior
type HoverBehavior = 'none' | 'play' | 'preview-scrub';
```

---

## See Also

- [Templates & Data](./templates-and-data.md) - Creating templates with defaults
- [Player Guide](./player-guide.md) - Browser playback
