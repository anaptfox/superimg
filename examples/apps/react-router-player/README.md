# SuperImg × React Router

Live SuperImg `<Player>` previews in a [React Router](https://reactrouter.com/) framework-mode app (the meta-framework formerly known as Remix — SSR + loaders via the React Router Vite plugin).

- **`/`** — player gallery (`PlayerGallery`) rendered from an SSR route

## The SSR-safe mount

React Router runs in **SSR mode** by default. The SuperImg `<Player>` depends on the rolldown-WASM browser bundler and DOM APIs, so it must never execute on the server. The gallery wraps each player in a tiny [`ClientOnly`](./app/components/ClientOnly.tsx) guard (mounted-state `useEffect`) that renders a fallback during SSR and mounts the real `<Player>` only after hydration. No extra Vite config or worker setup is required — the player's assets bundle through the React Router Vite plugin.

```tsx
import { Player } from "superimg/react";
import { ClientOnly } from "./components/ClientOnly";

<ClientOnly fallback={<Skeleton />}>
  {() => <Player template={helloTemplate} format="horizontal" playbackMode="loop" />}
</ClientOnly>;
```

## Run

```bash
pnpm install      # from the monorepo root: just install
pnpm dev          # http://localhost:3008
pnpm build && pnpm start
```

## Files

| Path | Purpose |
|---|---|
| `app/root.tsx` | HTML document + `<Outlet>` |
| `app/routes.ts` | Route config (single index route) |
| `app/routes/home.tsx` | Home route → `PlayerGallery` |
| `app/components/PlayerGallery.tsx` | Grid of `<Player>` previews |
| `app/components/ClientOnly.tsx` | SSR-safe client-only mount |
| `app/lib/templates.ts` | `define()` template modules |
