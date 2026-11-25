# React Player

Embed media with the passive `Player` from `@foxworth/superimg/react/player`. Hover or
focus a card to preview. The six loops share `../_shared/preview.media.ts` with
the framework-free hover demo.

From the repository root:

```bash
just build-render
pnpm --filter superimg-example-react-player dev
pnpm --filter superimg-example-react-player build
```

```tsx
import { Player } from "@foxworth/superimg/react/player";
import program from "./my-program.media";
<Player media={program} size={{ width: 640, height: 360 }} />
```

A `PlayerRef` exposes playback and seeking. See `App.tsx` for focus/blur handlers.
Semantic scenes, actions, and guide navigation belong to `@foxworth/superimg/interactive/define`;
the `queue-explainer` app demonstrates that separate player contract.
