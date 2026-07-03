# SuperImg × Vinxi React

[Vinxi](https://vinxi.vercel.app/) React SPA with live SuperImg `<Player>` previews.

- **Vinxi SPA router** — `createApp()` with a static + client router pair
- **Client entry** — `app/client.tsx` mounts React; templates import from `superimg`
- **Preview-only** — `import { Player } from "superimg/react"` (no export/compile graph)

## Run

```bash
# From monorepo root
just install
just example apps/vinxi-react-player
```

Or from this directory:

```bash
pnpm install
pnpm dev
```

Open [http://localhost:3006](http://localhost:3006).

## Layout

```
app.config.ts     Vinxi routers (static + SPA)
index.ts          SPA HTML shell (eventHandler — matches official Vinxi SPA examples)
app/
  client.tsx      React mount
  App.tsx         Player grid UI
  lib/templates.ts  define() templates
```

## SuperImg import

```tsx
import { Player } from "superimg/react";
import { helloTemplate } from "./lib/templates";

<Player template={helloTemplate} format="horizontal" playbackMode="loop" controls />
```

No Vite aliases or `@rolldown/browser` peer required for preview.

**Note:** This example pins `vite@^6.4` and `@vitejs/plugin-react@^4` so Vinxi’s dev server does not pick up the monorepo’s Vite 8 / Rolldown toolchain (which breaks HMR module transforms).