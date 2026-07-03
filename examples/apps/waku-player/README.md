# SuperImg × Waku

Live SuperImg `<Player>` previews in a [Waku](https://waku.gg/) app — React Server Components first, with the player living in a `"use client"` island.

- **`/`** — server component page that renders a client `PlayerGallery`

## The server / client split

Waku renders pages as **React Server Components** by default. `src/pages/index.tsx` is a server component; it can't use browser APIs or hooks. The SuperImg `<Player>` needs both (it runs the rolldown-WASM browser bundler in the DOM), so it lives in [`src/components/PlayerGallery.tsx`](./src/components/PlayerGallery.tsx), marked `"use client"`.

Importing `Player` from `superimg/react` inside a server component would hit the package's `react-server` stub (it intentionally throws). The `"use client"` boundary resolves the real browser build instead.

One more nuance: even a client component is still **server-rendered to HTML** by Waku, so the player is additionally gated behind a mounted-state `ClientOnly` guard — it renders a fallback during SSR and the real `<Player>` only after hydration.

```tsx
"use client";
import { Player } from "superimg/react";
// ...mounted guard, then:
<Player template={helloTemplate} format="horizontal" playbackMode="loop" />;
```

## Run

```bash
pnpm install      # from the monorepo root: just install
pnpm dev          # http://localhost:3009
pnpm build && pnpm start
```

## Files

| Path | Purpose |
|---|---|
| `src/pages/_layout.tsx` | Root layout (header + shell) |
| `src/pages/index.tsx` | Server component → renders the client island |
| `src/components/PlayerGallery.tsx` | `"use client"` grid of `<Player>` previews + SSR guard |
| `src/lib/templates.ts` | `define()` template modules |
| `waku.config.ts` | Vite config (React plugin) |
