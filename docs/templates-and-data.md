# Templates & Data

This guide covers how to create templates, define default data, pass data at render time, and share data across scenes.

## Table of Contents

- [Template Kinds](#template-kinds)
- [Basic Templates](#basic-templates)
- [Duration Resolution](#duration-resolution)
- [Template Data](#template-data)

---

## Template Kinds

All templates use `*.media.ts` (or `*.media.js`). Output kind is determined by `define()` config — not the filename.

| Output | Factory | Config signal | Stdlib |
|--------|---------|---------------|--------|
| **MP4/WebM** | `define()` | `fps` + `duration` | Full (`director`, `carousel`, `stack`, `track`, `layers`, `reveal`, `cue`, …) |
| **GIF** | `define()` | `fps` + `duration` + `--format gif` | Full (temporal APIs) |
| **Image** | `define()` | no `fps`/`duration` | Static — no `director`/`layers`/`reveal`/`cue` |
| **SVG** | `define({ medium: "svg" })` | `medium: "svg"` | Static + `std.viz` / `std.svg` |

Video and GIF use full temporal stdlib (`ctx.director()`, `std.layers`, …). Image and SVG use a static subset. **Layer the frame, direct the motion** applies to video and GIF.

## Basic Templates

A template's `render(ctx)` returns markup for the current frame (video/gif) or a single frame (image/svg). Use `sample` for default data:

### Video template (recommended starting point)

```typescript
// templates/intro.media.ts
import { define } from 'superimg';

export default define({
  sample: {
    name: 'World',
  },
  config: {
    width: 1920,
    height: 1080,
    fps: 30,
    duration: 5,
  },
  render(ctx) {
    const { std, timeline, width, height, data } = ctx;

    const scale = std.interpolate(timeline.progress, [0, 1], [0.8, 1], 'easeOutCubic');
    const bodyStyle = std.css({ width, height, transform: 'scale(' + scale + ')' }, std.css.center());

    return `
      <div style="${bodyStyle}">
        Hello, ${data.name}!
      </div>
    `;
  },
});
```

`define()` gives you full type inference — `ctx.data.name` is typed as `string` automatically.

### Multi-Output Presets

Templates can define named output presets via `config.outputs` to target multiple aspect ratios, resolutions, or formats from a single template:

```typescript
export default define({
  sample: { title: 'Untitled' },
  config: {
    width: 1920,
    height: 1080,
    fps: 30,
    duration: 5,
    outputs: {
      youtube: { width: 1920, height: 1080 },
      reels: { width: 1080, height: 1920 },
      square: { width: 1080, height: 1080 },
    },
  },
  render(ctx) {
    return `<div style="width:${ctx.width}px;height:${ctx.height}px">${ctx.data.title}</div>`;
  },
});
```

The active output preset is available via `ctx.output` (name, width, height, fit) so templates can adapt their layout accordingly.

### Using Templates

```bash
# Dev server with live preview
superimg dev intro

# Render to video (default output: output/intro.mp4)
superimg render intro

# Render a GIF
superimg render spinner --format gif

# Render a still image
superimg render og-card --format png
```

### Duration Resolution

Duration can be set in several places. The highest-priority source wins:

| Priority | Source | Used by |
|----------|--------|---------|
| 1 (highest) | CLI flags (`--duration`) | CLI rendering |
| 2 | `config.duration` in template | CLI rendering (fallback) |
| 3 (lowest) | Built-in default (5 s) | Everything |

### The `std` Standard Library

The standard library is available via `ctx.std`:

```typescript
import { define } from 'superimg';

export default define({
  config: { fps: 30, duration: 5 },
  render(ctx) {
    const { std, timeline } = ctx;
    
    // Interpolate: eased mapping through input/output ranges
    const eased = std.interpolate(timeline.progress, [0, 1], [0, 1], 'easeOutCubic');
    const value = std.interpolate(timeline.progress, [0, 1], [0, 100], 'easeOutCubic');
    const clamped = std.math.clamp(value, 10, 90);
    
    // Color manipulation
    const color = std.color.hsl(eased * 360, 80, 50);
    const withAlpha = std.color.alpha('#ff6b35', 0.8);
    
    // CSS style helper (object syntax, auto-px for numbers)
    const style = std.css({ width: 1920, height: 1080, opacity: eased });
    
    return `<div style="${style}">...</div>`;
  },
});
```

### `std.css` and Layout Presets

Use `std.css()` to build inline styles from an object. Numeric values get `px` automatically (except unitless properties like `opacity`, `zIndex`, `lineHeight`):

```typescript
// Object syntax — no manual px interpolation
std.css({ width, height, display: 'flex', alignItems: 'center', opacity: eased })
// → "width:1920px;height:1080px;display:flex;align-items:center;opacity:0.8"
```

Combine objects and presets in a single call (variadic):

```typescript
std.css({ width, height }, std.css.center())
// → "width:1920px;height:1080px;display:flex;align-items:center;justify-content:center"
```

Presets for common layouts:

```typescript
std.css.fill()   // position:absolute; top:0; left:0; width:100%; height:100%
std.css.center() // display:flex; align-items:center; justify-content:center
std.css.column()  // display:flex; flex-direction:column
std.css.row()    // display:flex; flex-direction:row
```

### Template Stylesheets (Tailwind, etc.)

Templates can inject CSS once per render session via `config.inlineCss` and `config.stylesheets`:

```typescript
export default define({
  config: {
    width: 1920,
    height: 1080,
    // Raw CSS strings (e.g. utility classes, precompiled Tailwind)
    inlineCss: [`.text-xl { font-size: 1.25rem; }`],
    // Stylesheet URLs (CDN, local paths)
    stylesheets: ['https://cdn.example.com/tailwind.min.css'],
  },
  render(ctx) {
    return `<div class="text-xl">Hello</div>`;
  },
});
```

**Tailwind:** Use precompiled CSS. Run `npx tailwindcss -i input.css -o output.css` and pass the output via `inlineCss` (as a string) or `stylesheets` (as a file URL). Tailwind is supported via precompiled output only — no runtime JIT.

---

### Still image

Omit `fps` and `duration` from config. Render with `--format png`, `--format webp`, or `--format jpeg`.

```typescript
import { define } from 'superimg';

export default define({
  sample: { title: 'SuperImg' },
  config: { width: 1200, height: 630 },
  render(ctx) {
    const { std, width, height, data } = ctx;
    return `<div style="${std.css({ width, height, background: '#0f172a' }, std.css.center())}">
      <h1 style="color:#fff;font-size:64px">${data.title}</h1>
    </div>`;
  },
});
```

### GIF

Include `fps` and `duration`, then render with `--format gif`.

```typescript
import { define } from 'superimg';

export default define({
  config: {
    width: 200,
    height: 200,
    fps: 24,
    duration: 1.5,
    gif: { loop: 0, maxColors: 64 },
  },
  render(ctx) {
    const { std, width, height, timeline } = ctx;
    const t = timeline.progress;
    // ... animate per frame
    return `<div style="${std.css({ width, height })}">...</div>`;
  },
});
```

### SVG

Use `define({ medium: "svg" })`. `render()` must return an `<svg xmlns="...">` root element.

```typescript
import { define } from 'superimg';

export default define({ medium: 'svg',
  config: { width: 800, height: 400 },
  render(ctx) {
    const { width, height } = ctx;
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
      <circle cx="400" cy="200" r="80" fill="#667eea"/>
    </svg>`;
  },
});
```

## Template Data

Templates export a `sample` object. At render time the runtime merges incoming data and exposes the result as `ctx.data`. This makes templates self-contained — they render correctly with zero configuration.

### Defining sample data

```typescript
// templates/product.media.ts
import { define } from 'superimg';

export default define({
  sample: {
    title: 'Untitled',
    price: 0,
    discount: undefined as number | undefined,
    accentColor: '#4a90d9',
  },
  config: {
    width: 1920,
    height: 1080,
    fps: 30,
    duration: 5,
  },
  render(ctx) {
    const { std, timeline, data } = ctx;
    const { title, price, accentColor, discount } = data;

    const opacity = std.interpolate(timeline.progress, [0, 1], [0, 1], 'easeOutCubic');
    const finalPrice = discount ? price * (1 - discount / 100) : price;

    return `
      <div style="--accent: ${accentColor}; opacity: ${opacity}">
        <h1>${title}</h1>
        <p class="price">$${finalPrice.toFixed(2)}</p>
      </div>
    `;
  },
});
```

### Using Templates with Data

When a template has data, it is merged at render time. Any fields you provide override the data defaults; missing fields use the default values.

```bash
# Inline JSON
superimg render product --data '{"title": "Gadget", "price": 149}'

# Batch from a JSON file — one render per array entry
superimg render product --data products.json -y
```

## RenderContext Reference

The full `RenderContext` interface:

```typescript
interface RenderContext<
  TData = Record<string, unknown>,
> {
  std: Stdlib;
  timeline: Timeline;               // progress, seconds (= progress × durationSeconds), frame, …
  director: (phases?) => Director;
  track: (opts: TrackSource) => Track;

  // Global position (entire video)
  globalFrame: number;
  globalTimeSeconds: number;
  totalFrames: number;
  totalDurationSeconds: number;

  // Scene metadata (multi-scene compositions)
  sceneIndex: number;
  sceneId: string;

  // Video info
  fps: number;                      // Frames per second
  isFinite: boolean;                // Has finite duration

  // Dimensions
  width: number;
  height: number;
  aspectRatio: number;
  isPortrait: boolean;
  isLandscape: boolean;
  isSquare: boolean;

  // Data
  data: TData;                      // Template data

  // Output info
  output: OutputInfo;               // Output configuration (name, width, height, fit)

  // CSS viewport (for responsive templates)
  cssViewport?: CssViewport;        // CSS viewport dimensions and devicePixelRatio
}
```

---

## Best Practices

### 1. Use sample for reusable templates

```typescript
import { define } from 'superimg';

export default define({
  sample: {
    title: 'Untitled',
    items: [] as string[],
  },
  render(ctx) {
    const { title, items } = ctx.data;
    // ctx.data = sample merged with CLI/API overrides
    return `<div>${title}</div>`;
  },
});
```

### 2. Optional fields in sample

```typescript
export default define({
  sample: {
    title: 'Hello',
    subtitle: undefined as string | undefined,
    color: '#000',
  },
  render(ctx) {
    const { title, subtitle, color } = ctx.data;
    return `<div>${title}</div>`;
  },
});
```

### 3. Full type inference

`define()` infers types from your `sample` — `ctx.data` is automatically typed.

### 4. Use Explicit Duration in Config

```typescript
config: {
  duration: 5,
}
```