# @foxworth/superimg

**Media as code. Generate something reusable for once.**

Author video, images, SVG, and interactive media as pure TypeScript functions of time, canvas, and data—then compose them into larger works, play them live in your app, or export them for every platform.

```ts
import {
  video,
  image,
  svg,
  ogImage,
  define,
  collection,
  sequence,
  together,
  choose,
  time,
  Frame,
  Stack,
  Text,
  Vector,
  vector,
  visual,
  Instance,
  Scene,
} from "@foxworth/superimg";
```

Helpers supply sensible medium defaults and lower to `MediaDefinition`. Every `render(ctx)` returns a typed media tree (`Frame`, `Stack`, `Text`, `Vector` / `vector.*`, with boxed `Html()` as the explicit escape hatch for opaque markup).

```bash
npm install @foxworth/superimg
npm install -D @foxworth/superimg-cli
npx superimg check launch.media.ts
npx superimg inspect launch.media.ts --at 1.5s --png
npx superimg export launch.media.ts --for youtube --for instagram-square
```

## Subpath Surface

- `@foxworth/superimg` — authoring helpers, layout/vector primitives, retained compositions (`sequence`, `together`, `choose`, `time`), and shared `visual()` / `Instance` / `Scene`
- `@foxworth/superimg/runtime` — value-first `init`, `check`, `inspect`, `render`, `renderResponse`, `exportMedia`, `shutdown`
- `@foxworth/superimg/runtime/html` — pure synchronous request-time HTML projection (zero providers or host authority)
- `@foxworth/superimg/player` · `/player/dom` · `/player/program` — framework-neutral passive, DOM-only, driven, and manual Program playback
- `@foxworth/superimg/react/player` · `/react/interactive` — React `<Player>` and `<InteractivePlayer>` (`/react/compile` is reserved for SuperImg's own authoring shells)
- `@foxworth/superimg/interactive/define` · `/interactive/player` — singular host-driven interactive definitions and controllers
- `@foxworth/superimg/film` · `/script` · `/takes` — multi-shot story authoring, script cues, and portable takes
- `@foxworth/superimg/inspection` · `/inspection/boundary` — exact preview capture, semantic bounds, Boundary preview mount (`createPreviewInteractionMount`), and atomic hot-reload slots (`createPreviewInteractionSlot`)
- `@foxworth/superimg/browser-export` — mounted DOM/HTML capture to PNG, SVG, and PDF (vector and PDF plugins load on demand)
- `@foxworth/superimg/destinations` · `/charts` · `/transcript` — schema-0 destination registry, typed charts, and transcript helpers

The `superimg` CLI ships in `@foxworth/superimg-cli` (one-off: `npx @foxworth/superimg-cli <cmd>`). Node-only Boundary Media, Edit, Render, and Script Programs—including static workflow `Plan`s and hot-reload `BindingSlot`s—ship in `@foxworth/superimg-interactions`. SuperImg does not publish a general compiler library; downstream hosts compile `*.media.ts` with their own Rolldown/OXC.

## Node Video Rendering Peers

For Node video rendering and media inspection/conversion with this package alone, install compatible codec peers alongside Playwright's Chromium binary (`npx superimg doctor --json`):

```bash
npm install mediabunny@^1.66.2 @mediabunny/server@^1.66.2 @mediabunny/dts@^1.66.2 node-av@^6.2.0 playwright@^1.65.0
```

Authoring, browser, and edge entry points do not require these native peers.

See the [repository README](../../README.md) for the full mental model, runnable examples, and documentation index.
