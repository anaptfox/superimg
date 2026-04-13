# SuperImg

Programmatic video generation. TypeScript in, MP4 out.

<p align="center">
  <img src="docs/assets/hero.gif" alt="SuperImg: write a TypeScript template, get back an MP4" width="960" />
</p>

## Quick Start

```bash
npm install superimg
```

> **Note:** Rendering requires Playwright. If not already installed, run `npx playwright install chromium`.

Create a template:

```typescript
// hello.video.ts
import { defineScene } from 'superimg'

export default defineScene({
  config: { width: 1920, height: 1080, fps: 30, duration: 3 },
  render(ctx) {
    return `
      <div style="
        width: ${ctx.width}px; height: ${ctx.height}px;
        background: linear-gradient(135deg, #667eea, #764ba2);
        display: flex; align-items: center; justify-content: center;
      ">
        <h1 style="font-size: 80px; color: white;">Hello, SuperImg</h1>
      </div>
    `
  },
})
```

Render it:

```bash
npx superimg render hello.video.ts -o hello.mp4
```

That's it. A function that returns HTML → an MP4 file.

## What You Can Build

200 product videos for an e-commerce catalog. Personalized onboarding walkthroughs. Automated social clips from a data feed. Anything where video needs to scale beyond one-at-a-time.

- **Deterministic** — Same input, same output. Every frame is testable.
- **Composable** — Import functions, reuse components, version control everything.
- **Scalable** — One template, any amount of data. Render 1 or 10,000.

## Add Animation

Every frame receives a context with `sceneProgress` (0 → 1 over the duration) and a standard library for animation:

```typescript
import { defineScene } from 'superimg'

export default defineScene({
  config: { width: 1920, height: 1080, fps: 30, duration: 5 },
  render(ctx) {
    const { std, sceneProgress, width, height } = ctx

    // Animate scale from 0.8 → 1 with easing
    const scale = std.tween(0.8, 1, sceneProgress, 'easeOutCubic')

    // Fade in over the first 30% of the scene
    const opacity = std.tween(0, 1, std.math.clamp(sceneProgress / 0.3, 0, 1))

    return `
      <div style="
        width: ${width}px; height: ${height}px;
        background: linear-gradient(135deg, #667eea, #764ba2);
        display: flex; align-items: center; justify-content: center;
      ">
        <h1 style="
          font-size: 80px; color: white;
          transform: scale(${scale}); opacity: ${opacity};
        ">Hello, SuperImg</h1>
      </div>
    `
  },
})
```

`std.tween` is the core animation primitive. Pair it with `std.math`, `std.color`, and `std.css` for layout, color mixing, and easing — [see the full API →](./docs/api.md)

## Data-Driven Templates

Pass data at render time. Same template, different content:

```typescript
export default defineScene({
  data: {
    productName: 'Widget',
    price: '$99',
  },
  render(ctx) {
    const { data } = ctx
    return `<div>${data.productName} — ${data.price}</div>`
  },
})
```

```bash
# Single video with inline data
npx superimg render template.ts --data '{"productName": "Gadget", "price": "$149"}'

# Batch render from a JSON file — one video per entry
npx superimg render template.ts --data products.json -o ./output/
```

## Multi-Format Output

One template, every platform:

```typescript
await render(template, { format: 'youtube.video' })        // 1920×1080
await render(template, { format: 'youtube.video.short' })  // 1080×1920
await render(template, { format: 'instagram.post' })       // 1080×1080
await render(template, { format: 'tiktok.video' })         // 1080×1920
```

## Where It Runs

**CLI** — Render locally or in CI. This is the primary workflow:

```bash
npx superimg render template.ts -o video.mp4
```

**Browser** — Live preview at 60fps while you edit. Run `npx superimg dev template.ts` to start the dev server.

**React** — Embed videos anywhere with the `<Player />` component:

```tsx
import { Player } from 'superimg-react'
import template from './template'

<Player template={template} width={1280} height={720} />
```

## Packages

| Package | Description |
|---------|-------------|
| `superimg` | Core library + CLI |
| `superimg-react` | React `<Player/>` component |

```bash
npm install superimg           # Core + CLI
npm install superimg-react     # React player
```

## Documentation

- [API Reference](./docs/api.md) — RenderContext, std.tween, and the full standard library
- [Project Configuration](./docs/project-config.md) — Cascading config and video discovery
- [Templates & Data](./docs/templates-and-data.md) — Creating templates with data
- [Examples](./examples/) — Working templates to copy from

## License

MIT
