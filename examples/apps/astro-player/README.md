# SuperImg × Astro

Embed live SuperImg `<Player>` previews in [Astro](https://astro.build/) via React islands.

- **`/`** — player gallery (`PlayerGrid`)
- **`/docs`** — inline explainer pattern (prose in Astro + compact loops)

## Run

```bash
# From monorepo root
just install
just example apps/astro-player
```

Or from this directory:

```bash
pnpm install
pnpm dev
```

Open [http://localhost:3007](http://localhost:3007).

## Integration pattern

Astro pre-renders pages on the server. SuperImg's browser runtime uses iframe preview, workers, and optional WASM — **do not SSR `<Player>`**.

```astro
---
import SuperImgPlayer from "../components/SuperImgPlayer";
---

<SuperImgPlayer client:only="react" variant="pulse" format="horizontal" playbackMode="loop" />
```

`define()` templates include functions and cannot cross the island boundary. Import them inside React (or map a serializable `variant` string, as in `SuperImgPlayer.tsx`).

## SuperImg import tiers

| Need | Import |
|------|--------|
| Docs / site preview | `superimg/react` |
| Client MP4 export | `superimg/react/export` |
| Template compile in browser | `superimg/react/compile` |

This example uses preview only.

## Layout

```
astro.config.mjs       React integration + Vite worker config
src/
  components/
    SuperImgPlayer.tsx  variant → template map
    PlayerGrid.tsx      homepage gallery
    DocExplainer.tsx    inline docs embed
  lib/templates.ts      define() templates
  pages/
    index.astro         gallery
    docs.astro          explainer pattern
```