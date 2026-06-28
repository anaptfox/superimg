# SuperImg

Programmatic media generation. TypeScript templates → MP4, GIF, images, and SVG.

<p align="center">
  <img src="docs/assets/hero.gif" alt="SuperImg: write a TypeScript template, get back media" width="960" />
</p>

## Quick Start

Install with your package manager of choice:

| | Install | Run CLI |
|---|---|---|
| npm | `npm install superimg` | `npx superimg` |
| pnpm | `pnpm add superimg` | `pnpm dlx superimg` |
| yarn | `yarn add superimg` | `yarn dlx superimg` |
| bun | `bun add superimg` | `bunx superimg` |
| deno | `deno add npm:superimg` | `deno run -A npm:superimg` |

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
npx superimg render hello.media.ts
```

Output lands in `output/hello.mp4` next to your template. Or use the programmatic API directly — SuperImg is lib-first:

```typescript
import { renderVideo } from 'superimg/server'

await renderVideo('./hello.media.ts', { output: './hello.mp4' })
```

That's it. A function that returns HTML → an MP4 file.

## Template Kinds

All templates use `*.media.ts`. Output kind is determined by `define()` config — not the filename.

| Output | Config signal | Stdlib |
|--------|---------------|--------|
| **MP4/WebM** | `fps` + `duration` | Full (`score`, `layers`, `reveal`, `cue`, …) |
| **GIF** | `fps` + `duration` + `--format gif` | Full (temporal APIs) |
| **Image** | no `fps`/`duration` | Static — no `score`/`layers`/`reveal`/`cue` |
| **SVG** | `medium: "svg"` | Static + `std.svg` / `std.viz` |

```bash
npx superimg render spinner.media.ts --format gif   # animated GIF
npx superimg render og-card.media.ts                # PNG still (no fps/duration)
npx superimg render chart.media.ts                  # SVG vector output
npx superimg render intro.media.ts --frame 45 --format png  # single-frame still
```

## What You Can Build

200 product videos for an e-commerce catalog. Personalized onboarding walkthroughs. Automated social clips from a data feed. OG cards and share images from the same template system. Anything where media needs to scale beyond one-at-a-time.

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

`ctx.director()` handles phase timing. For nested clips use `d.clip()`, for accumulating lists use `std.stack()`, for one-at-a-time slides use `std.carousel()`, for layered scenes use `std.layers()`, for embedded video use `std.video.sync()`. For custom-progress math reach for `std.interpolate(progress, inputRange, outputRange, easing?)`. [See the full API →](./docs/api.md)

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
npx superimg render template.media.ts --preset youtube
```

## Where It Runs

**CLI** — Render locally or in CI. This is the primary workflow:

```bash
npx superimg render hello.media.ts

# Render every template in the project. Multi-output templates (those declaring
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

- [API Reference](./docs/api.md) — RenderContext, ctx.director(), std.interpolate, and the full standard library
- [Project Configuration](./docs/project-config.md) — Cascading config and template discovery
- [Templates & Data](./docs/templates-and-data.md) — Creating templates with data
- [Examples](./examples/) — Working templates to copy from

## License

MIT