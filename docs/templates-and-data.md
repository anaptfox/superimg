# Templates & Data

This guide covers how to create templates, define default data, pass data to scenes, and share data across scenes.

## Table of Contents

- [Basic Templates](#basic-templates)
- [Duration Resolution](#duration-resolution)
- [Template Defaults](#template-defaults)
- [Template Data](#template-data)

---

## Basic Templates

A template is a function that receives a `RenderContext` and returns HTML. The recommended way to create templates is with `defineTemplate` and a `defaults` object:

### Module Templates (recommended)

```typescript
// templates/intro.ts
import { defineTemplate } from 'superimg';

export default defineTemplate({
  defaults: {
    name: 'World',
  },
  config: {
    width: 1920,
    height: 1080,
    fps: 30,
    durationSeconds: 5,
  },
  render(ctx) {
    const { std, sceneProgress, width, height, data } = ctx;

    const scale = std.tween(0.8, 1, sceneProgress, 'easeOutCubic');
    const bodyStyle = std.css({ width, height, transform: 'scale(' + scale + ')' }) + ';' + std.css.center();

    return `
      <div style="${bodyStyle}">
        Hello, ${data.name}!
      </div>
    `;
  },
});
```

`defineTemplate` gives you full type inference — `ctx.data.name` is typed as `string` automatically.

### Multi-Output Presets

Templates can define named output presets via `config.outputs` to target multiple aspect ratios or resolutions from a single template:

```typescript
export default defineTemplate({
  defaults: { title: 'Untitled' },
  config: {
    width: 1920,
    height: 1080,
    fps: 30,
    durationSeconds: 5,
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
# Dev server with live preview (bare name resolves to videos/intro.ts)
superimg dev intro

# Render to video
superimg render videos/intro.ts -o output.mp4
```

### Duration Resolution

Duration can be set in several places. The highest-priority source wins:

| Priority | Source | Used by |
|----------|--------|---------|
| 1 (highest) | CLI flags (`--duration`) | CLI rendering |
| 2 | `config.durationSeconds` in template | CLI rendering (fallback) |
| 3 (lowest) | Built-in default (5 s) | Everything |

### The `std` Standard Library

The standard library is available via `ctx.std`:

```typescript
import { defineTemplate } from 'superimg';

export default defineTemplate({
  render(ctx) {
    const { std, sceneProgress } = ctx;
    
    // Tween: eased interpolation (0-1 for progress, 0-100 for values)
    const eased = std.tween(0, 1, sceneProgress, 'easeOutCubic');
    const value = std.tween(0, 100, sceneProgress, 'easeOutCubic');
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

Presets for common layouts:

```typescript
std.css.fill()   // position:absolute; top:0; left:0; width:100%; height:100%
std.css.center() // display:flex; align-items:center; justify-content:center
std.css.stack()  // display:flex; flex-direction:column
```

### Template Stylesheets (Tailwind, etc.)

Templates can inject CSS once per render session via `config.inlineCss` and `config.stylesheets`:

```typescript
export default defineTemplate({
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

## Template Defaults

Templates can export a `defaults` object. The runtime merges `{ ...defaults, ...incomingData }` before passing to `ctx.data`. This makes templates self-contained — they render correctly with zero configuration.

### Defining Defaults

```typescript
// templates/product.ts — using defineTemplate (recommended)
import { defineTemplate } from 'superimg';

export default defineTemplate({
  defaults: {
    title: 'Untitled',
    price: 0,
    discount: undefined as number | undefined,
    accentColor: '#4a90d9',
  },
  config: {
    width: 1920,
    height: 1080,
    fps: 30,
    durationSeconds: 5,
  },
  render(ctx) {
    const { std, sceneProgress, data } = ctx;
    const { title, price, accentColor, discount } = data;

    const opacity = std.tween(0, 1, sceneProgress, 'easeOutCubic');
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

### Using Templates with Defaults

When a template has defaults, data is merged at render time. Any fields you provide override the defaults; missing fields use the default values.

---

## Template Data

Pass data to templates via `ctx.data`.

### Accessing Data in Templates

Data is available via `ctx.data`:

```typescript
import { defineTemplate } from 'superimg';

export default defineTemplate({
  defaults: { title: 'Untitled', subtitle: undefined, showLogo: false },
  render(ctx) {
    const { data } = ctx;
    const { title, subtitle, showLogo } = data;

    return `
      <div class="slide">
        <h1>${title}</h1>
        ${subtitle ? `<h2>${subtitle}</h2>` : ''}
        ${showLogo ? '<img src="logo.png" />' : ''}
      </div>
    `;
  },
});
```

---

## RenderContext Reference

The full `RenderContext` interface:

```typescript
interface RenderContext<
  TData = Record<string, unknown>,
> {
  // Standard library
  std: Stdlib;                      // Tween, math, color utilities

  // Global position (entire video)
  globalFrame: number;              // Current frame in video
  globalTimeSeconds: number;        // Current time in video
  globalProgress: number;           // Progress through video (0-1)
  totalFrames: number;              // Total frames in video
  totalDurationSeconds: number;     // Total duration in seconds

  // Scene position (equals global in single-template mode)
  sceneFrame: number;               // Frame within this scene
  sceneTimeSeconds: number;         // Time within this scene
  sceneProgress: number;            // Progress through this scene (0-1)
  sceneTotalFrames: number;         // Total frames in this scene
  sceneDurationSeconds: number;     // Duration of this scene

  // Scene metadata
  sceneIndex: number;               // Index of current scene
  sceneId: string;                  // ID of current scene

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

### 1. Use defineTemplate with Defaults for Reusable Templates

```typescript
import { defineTemplate } from 'superimg';

// Good - self-contained with defaults
export default defineTemplate({
  defaults: {
    title: 'Untitled',
    items: [] as string[],
  },
  render(ctx) {
    const { title, items } = ctx.data;
    // ctx.data is merged from defaults + incoming data
    return `<div>${title}</div>`;
  },
});
```

### 2. Use Defaults for Optional Fields

```typescript
export default defineTemplate({
  defaults: {
    title: 'Hello',
    subtitle: undefined as string | undefined,  // Optional
    color: '#000',                              // Optional with default
  },
  render(ctx) {
    const { title, subtitle, color } = ctx.data;
    return `<div>${title}</div>`;
  },
});
```

### 3. Full Type Inference

`defineTemplate` infers types from your `defaults` — no manual type annotations needed. `ctx.data` is automatically typed.

### 4. Use Explicit Duration in Config

```typescript
config: {
  durationSeconds: 5,
}
```
