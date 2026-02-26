---
name: superimg
description: >
  SuperImg programmatic video generation framework. Create HTML/CSS video
  templates with defineTemplate(), animate with ctx.std (easing, math, color),
  and render to MP4. Use when working with superimg templates or video rendering.
---

# SuperImg Skill

## How It Works

SuperImg generates videos from HTML/CSS templates. A template is a function that receives a `RenderContext` and returns an HTML string. The renderer calls this function once per frame, advancing timing values each time.

- `sceneProgress` (0 to 1) drives animation within a scene
- `sceneTimeSeconds` gives elapsed time for phase-based timing
- `ctx.std` provides easing, math, and color utilities
- `ctx.data` carries template data (merged with defaults)

Templates render to MP4 via the CLI (`superimg render`) or the server API (`renderVideo`, `loadTemplate`).

## Template Authoring

### defineTemplate

```typescript
import { defineTemplate } from "superimg";

export default defineTemplate({
  defaults: {
    title: "Hello, SuperImg!",
    subtitle: "Create stunning videos from code",
    accentColor: "#667eea",
  },

  config: {
    width: 1920,
    height: 1080,
    fps: 30,
    durationSeconds: 4,
    fonts: ["Space+Grotesk:wght@400;700"],
  },

  render(ctx) {
    const { std, sceneTimeSeconds: time, width, height, isPortrait, data } = ctx;
    const { title, subtitle, accentColor } = data;

    // Responsive sizing
    const titleSize = isPortrait ? 64 : 88;
    const subtitleSize = isPortrait ? 22 : 28;

    // Phase timing: Enter 0-1.5s | Hold 1.5-3s | Exit 3-4s
    const enterProgress = std.math.clamp(time / 1.5, 0, 1);
    const exitProgress = std.math.clamp((time - 3.0) / 1.0, 0, 1);
    const easedEnter = std.easing.easeOutCubic(enterProgress);

    // Animate title
    const titleOpacity = std.math.lerp(0, 1, easedEnter) * (1 - exitProgress);
    const titleY = std.math.lerp(40, 0, easedEnter);

    // Staggered subtitle (+0.3s delay)
    const subtitleEnter = std.math.clamp((time - 0.3) / 1.5, 0, 1);
    const easedSubtitle = std.easing.easeOutCubic(subtitleEnter);
    const subtitleOpacity = std.math.lerp(0, 0.8, easedSubtitle) * (1 - exitProgress);
    const subtitleY = std.math.lerp(30, 0, easedSubtitle);

    // Accent line
    const lineEnter = std.math.clamp((time - 0.5) / 1.0, 0, 1);
    const lineWidth = std.easing.easeOutCubic(lineEnter) * 100 * (1 - exitProgress);
    const lineColor = std.color.alpha(accentColor, 0.8 * (1 - exitProgress));

    return `
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
          width: ${width}px;
          height: ${height}px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: #0f0f23;
          font-family: system-ui, sans-serif;
          overflow: hidden;
        }
        .title {
          font-size: ${titleSize}px;
          font-weight: 700;
          color: ${accentColor};
          opacity: ${titleOpacity};
          transform: translateY(${titleY}px);
          margin: 24px 0 12px;
        }
        .subtitle {
          font-size: ${subtitleSize}px;
          color: white;
          opacity: ${subtitleOpacity};
          transform: translateY(${subtitleY}px);
          margin-bottom: 24px;
        }
        .accent-line {
          width: ${lineWidth}%;
          max-width: 500px;
          height: 2px;
          background: ${lineColor};
          margin: 0 auto;
        }
      </style>
      <div style="text-align: center">
        <div class="accent-line"></div>
        <h1 class="title">${title}</h1>
        <p class="subtitle">${subtitle}</p>
        <div class="accent-line"></div>
      </div>
    `;
  },
});
```

### RenderContext Key Fields

```typescript
interface RenderContext<TData> {
  std: Stdlib;                    // Easing, math, color utilities

  // Scene timing (use these for animation)
  sceneProgress: number;          // 0-1 progress through current scene
  sceneTimeSeconds: number;       // Elapsed seconds in current scene
  sceneDurationSeconds: number;   // Total scene duration

  // Canvas
  width: number;                  // Canvas width in pixels
  height: number;                 // Canvas height in pixels
  isPortrait: boolean;            // height > width
  isLandscape: boolean;           // width > height

  // Data
  data: TData;                    // Scene-specific data (merged with defaults)
  // Global timing (rarely needed in templates)
  globalProgress: number;         // 0-1 progress through entire video
  globalTimeSeconds: number;
  fps: number;
}
```

### Core Stdlib

**Easing** — all take `t` in [0,1], return eased value:
```
std.easing.easeOutCubic(t)     // Smooth deceleration (most common)
std.easing.easeInOutCubic(t)   // Smooth start and end
std.easing.easeOutBack(t)      // Overshoot then settle
std.easing.easeOutElastic(t)   // Bouncy spring
std.easing.easeOutBounce(t)    // Bounce effect
std.easing.linear(t)           // No easing
```

**Math:**
```
std.math.lerp(start, end, t)         // Linear interpolation
std.math.clamp(value, min, max)      // Restrict to range
std.math.map(val, inMin, inMax, outMin, outMax)  // Remap range
```

**Color:**
```
std.color.alpha(color, opacity)      // Add transparency: alpha('#F00', 0.5)
std.color.mix(color1, color2, t)     // Blend two colors
std.color.lighten(color, amount)     // Lighten by percentage
std.color.darken(color, amount)      // Darken by percentage
std.color.hsl(h, s, l)              // Create HSL string
```

### Phase Timing Pattern

For multi-phase animations, use `sceneTimeSeconds` with `clamp`:

```typescript
render(ctx) {
  const { std, sceneTimeSeconds: time } = ctx;

  // Enter: 0-1s | Hold: 1-3s | Exit: 3-4s
  const enterProgress = std.math.clamp(time / 1.0, 0, 1);
  const exitProgress = std.math.clamp((time - 3.0) / 1.0, 0, 1);
  const eased = std.easing.easeOutCubic(enterProgress);

  const opacity = eased * (1 - exitProgress);
  const y = std.math.lerp(50, 0, eased);
  // ...
}
```

### Responsive Sizing

Use `isPortrait` / `isLandscape` to adapt layout:

```typescript
const fontSize = ctx.isPortrait ? 48 : 72;
const layout = ctx.isPortrait ? "column" : "row";
```

## Rendering

### CLI Rendering

```bash
# Scaffold a new project (detects package manager automatically)
superimg init my-project
superimg init my-project --pm pnpm   # override package manager
superimg init --add                   # Add videos/ to existing project

# Dev server with live preview (bare name resolves to videos/intro.ts)
superimg dev intro

# Render to video
superimg render videos/intro.ts -o output.mp4

# With options
superimg render videos/intro.ts -o output.mp4 --width 1080 --height 1920 --fps 60
```

### Programmatic Rendering (Server)

```typescript
import { renderVideo, loadTemplate } from "superimg/server";

// Load template from file
const template = await loadTemplate("videos/intro.ts");

// Render to MP4
await renderVideo("videos/intro.ts", {
  outputPath: "output.mp4",
  width: 1920,
  height: 1080,
});
```

For low-level control, use `createRenderPlan`, `executeRenderPlan`, and `PlaywrightEngine` from `superimg/server`.

## Gotchas

1. **HTML strings, not JSX.** Templates return template literal strings, not React/JSX. Use `${}` interpolation for dynamic values.

2. **Pure render function.** The `render` function must be pure — no side effects, no DOM manipulation, no global state. It receives context and returns an HTML string.

3. **Use `sceneProgress`, not `globalProgress`.** For animation within a scene, always use `sceneProgress` (0-1 within the current scene). `globalProgress` spans the entire video and is rarely useful in templates.

4. **Set root dimensions to canvas size.** Style the root element (typically `body` or an outer `div`) to `width: ${width}px; height: ${height}px` so content fills the frame.

5. **Import from the right path.** Templates import from `"superimg"` (for `defineTemplate`, types). Server/rendering imports from `"superimg/server"`.

6. **Data merges with defaults.** When a template has `defaults`, scene `data` is merged: `{ ...defaults, ...data }`. You only need to pass overrides.

7. **Use `config.fonts` for Google Fonts.** Declare fonts in `config.fonts` (e.g., `["Space+Grotesk:wght@400;700"]`) instead of adding `@import url(...)` in your render HTML. The library automatically injects the `<link>` tags and waits for fonts to load before capturing each frame.
