# SuperImg

Programmatic video generation. TypeScript in, MP4 out.

<p align="center">
  <img src="https://raw.githubusercontent.com/anaptfox/superimg/main/docs/assets/hero.gif" alt="SuperImg: write a TypeScript template, get back an MP4" width="960" />
</p>

## Quick Start

```bash
npm install superimg
```

> **Note:** Rendering requires Chromium. Run `npx superimg setup` once to download it.

Create a template:

```typescript
// hello.media.ts
import { define } from 'superimg'

export default define({
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
npx superimg render hello.media.ts -o hello.mp4
```

That's it. A function that returns HTML → an MP4 file.

## What You Can Build

200 product videos for an e-commerce catalog. Personalized onboarding walkthroughs. Automated social clips from a data feed. Anything where video needs to scale beyond one-at-a-time.

- **Deterministic** — Same input, same output. Every frame is testable.
- **Composable** — Import functions, reuse components, version control everything.
- **Scalable** — One template, any amount of data. Render 1 or 10,000.

## Add Animation

Every frame receives a context with a standard library for animation. `ctx.director()` breaks the scene into enter/hold/exit phases and `d.motion()` gives each element a fade-in, transform, and fade-out automatically:

```typescript
import { define } from 'superimg'

export default define({
  config: { width: 1920, height: 1080, fps: 30, duration: 5 },
  render(ctx) {
    const { std, width, height } = ctx

    // Phases default to enter 15% / hold 70% / exit 15%
    const d = ctx.director()

    // scale 0.8 → 1 on enter, hold, then auto fade + scale back on exit
    const card = d.motion({ scale: 0.8, easing: 'easeOutCubic' })

    return `
      <div style="
        width: ${width}px; height: ${height}px;
        background: linear-gradient(135deg, #667eea, #764ba2);
        display: flex; align-items: center; justify-content: center;
      ">
        <h1 style="font-size: 80px; color: white; ${card.style}">Hello, SuperImg</h1>
      </div>
    `
  },
})
```

`ctx.director()` handles phase timing. For custom-progress math (loops, non-phase curves) reach for `std.interpolate(progress, inputRange, outputRange, easing?)`. [See the full API →](https://github.com/anaptfox/superimg/blob/main/docs/api.md)

## Data-Driven Templates

Pass data at render time. Same template, different content:

```typescript
export default define({
  sample: {
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
npx superimg render template.media.ts --data '{"productName": "Gadget", "price": "$149"}'

# Batch render from a JSON file — one video per entry. Filenames pick a slug
# from each entry's `slug` / `name` / `title` / `id` field (else array index).
npx superimg render template.media.ts --data products.json -y

# Composes with --presets: 10 entries × 2 presets = 20 MP4s in one Playwright session.
npx superimg render template.media.ts --data products.json --presets -y
```

## Multi-Format Output

One template, every platform. Declare named output presets in `config.outputs`:

```typescript
export default define({
  config: {
    duration: 5,
    outputs: {
      youtube: { width: 1920, height: 1080 },   // landscape
      reel:    { width: 1080, height: 1920 },   // 9:16 vertical
      square:  { width: 1080, height: 1080 },   // 1:1
    },
  },
  render(ctx) { /* ... */ },
})
```

Then render every preset in one pass (one MP4 per output, single Playwright session):

```bash
# All declared presets
npx superimg render template.media.ts --presets

# Or pick specific ones
npx superimg render template.media.ts --presets youtube,reel
```

## Where It Runs

**CLI** — Render locally or in CI. This is the primary workflow:

```bash
npx superimg render hello.media.ts -o video.mp4

# Render every video in the project. Multi-output templates (those declaring
# config.outputs) automatically render all presets; single-output templates
# render once at their default config.
npx superimg render --all -y
```

**Browser** — Live preview at 60fps while you edit. Run `npx superimg dev hello` to start the dev server.

**React** — Embed videos anywhere with the `<Player />` component:

```tsx
import { Player } from 'superimg/react'
import template from './template'

<Player template={template} width={1280} height={720} />
```

## Packages

| Package | Description |
|---------|-------------|
| `superimg` | Core library, CLI, browser player, and React APIs |

```bash
npm install superimg           # Core + CLI
```

## With AI Coding Agents

SuperImg ships a skill that teaches your AI coding agent the framework. One command installs it across hosts (Claude Code, Cursor, Codex, Gemini, OpenCode, Pi, Aider, Continue, Windsurf, Copilot):

```bash
npx superimg skill install
```

Codex users can also install the official plugin (skill only, versioned, no AGENTS.md edits):

```bash
codex marketplace add github.com/anaptfox/superimg
codex plugin install superimg@anaptfox
```

## Documentation

- [API Reference](https://github.com/anaptfox/superimg/blob/main/docs/api.md) — RenderContext, ctx.director(), std.interpolate, and the full standard library
- [Project Configuration](https://github.com/anaptfox/superimg/blob/main/docs/project-config.md) — Cascading config and video discovery
- [Templates & Data](https://github.com/anaptfox/superimg/blob/main/docs/templates-and-data.md) — Creating templates with data
- [Examples](https://github.com/anaptfox/superimg/tree/main/examples/) — Working templates to copy from

## License

MIT
