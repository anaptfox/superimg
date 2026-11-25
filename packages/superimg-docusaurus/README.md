# @superimg/docusaurus

Docusaurus **plugin** + **theme** components for live SuperImg Player embeds in MDX docs.

## Install

```bash
pnpm add @superimg/docusaurus superimg
```

## Config

```ts
// docusaurus.config.ts
import type { Config } from "@docusaurus/types";

const config: Config = {
  // …
  plugins: [
    [
      "@superimg/docusaurus",
      {
        // asyncWebAssembly: true, // default — client webpack/rspack only
      },
    ],
  ],
};

export default config;
```

## MDX

```mdx
import SuperImgPlayer from "@theme/SuperImgPlayer";
import AnimatedFigure from "@theme/AnimatedFigure";
import { pulseTemplate } from "@site/src/lib/hello-template";

<AnimatedFigure title="Phased entrance" media={pulseTemplate} label="pulse">
  Hover to play a compact loop next to the prose.
</AnimatedFigure>

<SuperImgPlayer
  media={pulseTemplate}
  playbackMode="loop"
  loadMode="lazy"
  hoverBehavior="play"
/>
```

## What this provides

| Surface | Role |
|---------|------|
| Plugin `configureWebpack` | `experiments.asyncWebAssembly` on the **client** build |
| `@theme/SuperImgPlayer` | `BrowserOnly` + **dynamic** `import("@foxworth/superimg/react/player")` |
| `@theme/AnimatedFigure` | Prose + compact hover-to-play layout |

## What it does not provide

- Build-time MP4/PNG pipeline (use SuperImg CLI / CI into `static/`)
- Next-style RSC job routes
- Automatic MDX short tags (import `@theme/*` or swizzle `MDXComponents` yourself)

## Options

| Option | Default | Description |
|--------|---------|-------------|
| `asyncWebAssembly` | `true` | Client async WASM |
| `asyncWebAssemblyOnServer` | `false` | Server SSG WASM (rarely needed) |
| `fallbackText` | `"Loading preview…"` | Reserved for future default fallbacks |
| `id` | `"default"` | Multi-instance plugin id |
