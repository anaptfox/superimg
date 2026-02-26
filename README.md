# SuperImg

Video is a function. Give it a frame number, get back HTML.

```
┌──────────────┐      ┌──────────────┐      ┌──────────────┐      ┌──────────────┐
│   Template   │      │     HTML     │      │    Frames    │      │     MP4      │
│              │ ──▶  │              │ ──▶  │              │ ──▶  │              │
│  render(ctx) │      │  <div>...</   │      │  ░░▓▓██████  │      │  video.mp4   │
└──────────────┘      └──────────────┘      └──────────────┘      └──────────────┘
     f(time)              string             rasterize             encode
```

No timeline editor. No After Effects. Just TypeScript that returns HTML strings.

## Why

Timeline editors are built for one video at a time. Drag keyframes, tweak curves, export, upload, repeat. Try to batch render 200 product videos and you're fighting the tool.

SuperImg treats video like any other code problem:
- **Deterministic** — Same input, same output. Every frame is testable.
- **Composable** — Import functions, reuse components, version control everything.
- **Scalable** — Render one video or ten thousand. Same template, different data.

## Install

```bash
npm install superimg
```

## Quick Start

```typescript
import { defineTemplate } from 'superimg'

export default defineTemplate({
  config: { width: 1920, height: 1080, fps: 30, durationSeconds: 5 },
  render(ctx) {
    const { std, sceneProgress, width, height } = ctx

    // sceneProgress runs from 0 → 1 over the duration
    const scale = std.math.lerp(0.8, 1, std.easing.easeOutCubic(sceneProgress))

    return `
      <div style="
        width: ${width}px;
        height: ${height}px;
        background: linear-gradient(135deg, #667eea, #764ba2);
        display: flex;
        align-items: center;
        justify-content: center;
      ">
        <h1 style="
          font-size: 80px;
          color: white;
          transform: scale(${scale});
        ">Hello, SuperImg</h1>
      </div>
    `
  },
})
```

Render it:

```bash
npx superimg render template.ts -o video.mp4
```

## Where It Runs

```
                    ┌─────────────────┐
                    │    template.ts  │
                    │                 │
                    │  defineTemplate │
                    └────────┬────────┘
                             │
           ┌─────────────────┼─────────────────┐
           │                 │                 │
           ▼                 ▼                 ▼
    ┌─────────────┐   ┌─────────────┐   ┌─────────────┐
    │   Browser   │   │     CLI     │   │    React    │
    │             │   │             │   │             │
    │  Live edit  │   │ npx render  │   │  <Player/>  │
    │  60fps      │   │ Batch jobs  │   │  Embed      │
    └─────────────┘   └─────────────┘   └─────────────┘
```

**CLI** — Render locally or in CI. Batch render from JSON data:

```bash
npx superimg render template.ts --data products.json -o ./output/
```

**Browser** — Live preview at 60fps while you edit.

**React** — Embed anywhere with `<Player/>`:

```tsx
import { Player } from 'superimg-react'
import template from './template'

<Player template={template} width={1280} height={720} />
```

## The Render Context

Every frame receives a context object. No magic globals.

```typescript
render(ctx) {
  const {
    width, height,           // Dimensions
    sceneProgress,           // 0 → 1 over duration
    sceneFrame,              // Current frame number
    sceneTimeSeconds,        // Current time in seconds
    std,                     // Standard library
    data,                    // Your custom data
  } = ctx

  return `<div>...</div>`
}
```

## Standard Library

Everything you need for animation, available on `ctx.std`:

| Module | What it does |
|--------|-------------|
| `std.easing` | 18+ easing functions: `easeOutCubic`, `easeInOutQuad`, `easeOutBounce` |
| `std.math` | `lerp`, `clamp`, `map`, `smoothstep`, `inverseLerp` |
| `std.color` | `hexToRgb`, `rgbToHsl`, `interpolateColor` |
| `std.timing` | Segment helpers for multi-scene sequences |
| `std.presets` | Platform dimensions: YouTube, Instagram, TikTok |

## One Template, Many Formats

```typescript
await render(template, { format: 'youtube.video' })        // 1920×1080
await render(template, { format: 'youtube.video.short' })  // 1080×1920
await render(template, { format: 'instagram.post' })       // 1080×1080
await render(template, { format: 'tiktok.video' })         // 1080×1920
```

## Data-Driven Templates

Pass data at render time for personalization:

```typescript
export default defineTemplate({
  defaults: {
    productName: 'Widget',
    price: '$99',
  },
  render(ctx) {
    const { data } = ctx
    return `<div>${data.productName} - ${data.price}</div>`
  },
})
```

```bash
npx superimg render template.ts --data '{"productName": "Gadget", "price": "$149"}'
```

## Packages

| Package | Description |
|---------|-------------|
| `superimg` | Core library + CLI |
| `superimg-react` | React `<Player/>` component |

```bash
npm install superimg           # Core + CLI
npm install superimg-react     # React components
```

## Documentation

- [API Reference](./docs/api.md) — RenderContext and stdlib
- [Templates & Data](./docs/templates-and-data.md) — Creating templates with defaults
- [Examples](./examples/) — Working examples to copy from

## Security

Templates execute code. Treat them as trusted input, or run rendering in a sandbox.

## License

MIT
