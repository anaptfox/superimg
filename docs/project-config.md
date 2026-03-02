# Project Configuration

This guide covers how SuperImg discovers videos, loads configuration, and resolves settings across your project. No central manifest is required—configuration cascades from folder to folder.

## Table of Contents

- [Video Discovery](#video-discovery)
- [Cascading Config (_config.ts)](#cascading-config-_configts)
- [Configuration Precedence](#configuration-precedence)
- [Output Presets](#output-presets)
- [Example Layout](#example-layout)

---

## Video Discovery

SuperImg automatically discovers all video templates in your project. No registration or manifest file is needed.

- **Pattern:** Any file ending in `.video.ts` or `.video.js` is a video template
- **Excluded directories:** `node_modules`, `.next`, `.vercel`, `dist`, `out`, `.git`, `build`, `.turbo`
- **Video name:** The relative path without the extension. For example, `src/social/promo.video.ts` becomes the video named `src/social/promo`

Use `superimg list` to see all discovered videos and their resolved dimensions.

---

## Cascading Config (_config.ts)

Instead of one global config file, SuperImg uses **cascading configuration**. Place a `_config.ts` file in any directory. When you render a video, SuperImg walks **up** the directory tree from the video file to the project root, collecting and merging every `_config.ts` it finds.

### Merge Strategy

| Field type | Behavior |
|------------|----------|
| **Scalars** (width, height, fps, durationSeconds) | Nearest to the video wins |
| **Arrays** (fonts, inlineCss, stylesheets) | Concatenated: root first, then child folders |
| **outputs** (named presets) | Nearest wins (overwrites parent) |

### Config Schema

```typescript
import { defineConfig } from "superimg";

export default defineConfig({
  width: 1920,
  height: 1080,
  fps: 30,
  durationSeconds: 5,
  fonts: ["Roboto:wght@400;700"],           // Google Fonts
  inlineCss: ["* { box-sizing: border-box; }"],
  stylesheets: ["https://cdn.example.com/styles.css"],
  outputs: {
    vertical: { width: 1080, height: 1920 },
    draft: { fps: 15 },
  },
});
```

---

## Configuration Precedence

When multiple sources define the same setting, SuperImg resolves them in this order (highest wins):

1. **CLI flags** — `superimg render --width 1280 --fps 60`
2. **Template config** — The `config: { ... }` block inside `defineScene({ config: { ... } })`
3. **Folder _config.ts** — The config file in the same directory as the video
4. **Parent _config.ts** — Config files in ancestor directories up to the project root
5. **Built-in defaults** — 1920×1080, 30 fps, 5 seconds

---

## Output Presets

Define named output presets in `config.outputs` or `_config.ts` to render multiple resolutions from one template:

```typescript
outputs: {
  youtube: { width: 1920, height: 1080 },
  tiktok: { width: 1080, height: 1920 },
  thumbnail: { width: 1280, height: 720 },
}
```

Render a specific preset:

```bash
superimg render intro -o intro.mp4 --preset tiktok
```

Render all presets at once:

```bash
superimg render intro -o intro.mp4 --all
```

Output files are named with the preset suffix: `intro-tiktok.mp4`, `intro-youtube.mp4`, etc.

---

## Example Layout

```
my-project/
├── _config.ts                    # Global: 1920×1080, 30fps, Inter font
├── videos/
│   ├── intro.video.ts            # Inherits global config
│   └── outro.video.ts
├── social/
│   ├── _config.ts                # Override: 1080×1920 (vertical)
│   ├── tiktok.video.ts           # Uses 1080×1920, inherits Inter
│   └── reels.video.ts
└── youtube/
    └── trailer.video.ts          # Uses root 1920×1080
```

---

## Next Steps

- [Templates & Data](./templates-and-data.md) - How to write templates
- [API Reference](./api.md) - RenderContext and stdlib
- [Rendering Architecture](./rendering-architecture.md) - How rendering works
