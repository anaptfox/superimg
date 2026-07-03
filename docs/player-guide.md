# Player Guide

Guide to using the SuperImg browser player in vanilla JavaScript and React.

## Overview

The player previews templates in the browser using **real HTML/CSS in a sandboxed iframe** (`runtime-web` + morphdom). It does not rasterize every frame to a canvas during playback.

| Layer | Package | Role |
|-------|---------|------|
| **Player** | `@superimg/player` | High-level API, Zustand store, timeline helpers |
| **Display** | `@superimg/runtime-web` | `WebRuntime` + `IframePresenter` |
| **Export** | `@superimg/runtime` | `CanvasRenderer` + `exportToVideo` (separate path) |

Two integration styles:

1. **Vanilla JS** — `Player` + optional `createTimelineController`
2. **React** — `<Player>` with built-in controls

---

## Vanilla JavaScript

### Installation

```bash
npm install superimg
```

### Basic Usage

```typescript
import { Player } from "superimg/browser";

const player = new Player({
  container: "#player",
  format: "horizontal",
  playbackMode: "loop",
});

const result = await player.load(template);
if (result.status === "success") {
  player.play();
}
```

### Store + Timeline

Vanilla apps use `player.store` (Zustand) for reactive UI:

```typescript
import { Player, createTimelineController } from "superimg/browser";

const player = new Player({ container: "#player", playbackMode: "loop" });
await player.load(template);

const store = player.store;
store.subscribe(() => {
  const { isPlaying, currentFrame } = store.getState();
  console.log(isPlaying, currentFrame);
});

createTimelineController(
  { progress: progressEl, playhead: playheadEl, currentTime: timeEl, totalTime: totalEl },
  store
).attach(timelineEl);
```

### API Reference

#### Constructor Options

```typescript
interface PlayerOptions {
  container: string | HTMLElement;
  format?: FormatOption;           // 'horizontal' | 'vertical' | preset path | { width, height }
  playbackMode?: PlaybackMode;    // 'once' | 'loop' (default: 'once')
  loadMode?: LoadMode;            // 'eager' | 'lazy' (lazy: React Player only today)
  hoverBehavior?: HoverBehavior;  // 'none' | 'play' | 'preview-scrub'
  hoverDelayMs?: number;
}
```

#### Methods

```typescript
await player.load(template, { data, markers, assets, assetResolver });
player.update({ data, format, width, height, fps, duration });
player.play();
player.pause();
player.seekFrame(45);
player.seekProgress(0.5);
player.seekTimeSeconds(2.5);
player.render(frame?);   // force re-render
player.dispose();

player.store;            // Zustand store (vanilla controls)
player.getRuntimeStore(); // RuntimeStore adapter (React controls)
```

#### Properties

```typescript
player.playbackMode;      // getter/setter: 'once' | 'loop'
player.isReady;
player.isPlaying;
player.currentFrame;
player.totalFrames;
player.fps;
player.currentProgress;
player.currentTimeSeconds;
player.totalDurationSeconds;
```

#### Events

```typescript
player.on("ready", () => {});
player.on("play", () => {});
player.on("pause", () => {});
player.on("ended", () => {});
player.on("frame", (frame, totalFrames) => {});
player.on("rendered", (payload) => {});  // { frame, html, compositeHtml }
player.on("scenechange", (scene) => {});
player.on("checkpoint", (checkpoint) => {});
player.on("error", (err) => {});
```

### Browser Export (MP4)

Preview uses `runtime-web`. Export uses `runtime`:

```typescript
import { CanvasRenderer, exportToVideo, downloadBlob } from "superimg/browser";
```

See the playground export hook or CLI dev-ui export panel for a full example.

---

## React

### Basic Usage

```tsx
import { Player } from "superimg/react/player";

<Player
  template={template}
  format="horizontal"
  playbackMode="loop"
  controls="full"
  style={{ width: "100%", maxWidth: 640, aspectRatio: "16/9" }}
/>
```

### Ref API

```tsx
import { useRef } from "react";
import { Player, type PlayerRef } from "superimg/react/player";

const playerRef = useRef<PlayerRef>(null);

<Player ref={playerRef} template={template} controls onStore={(store) => {}} />

// Imperative
playerRef.current?.play();
playerRef.current?.seekFrame(0);
playerRef.current?.update({ data: { title: "Updated" } });
```

`PlayerRef.store` is a `RuntimeStore` adapter over the internal Zustand store.

---

## Performance Tips

- Preview re-renders DOM each frame via morphdom — simplify HTML/CSS for smooth playback
- Use `loadMode="lazy"` on React `<Player>` for below-the-fold embeds
- Use `hoverDelayMs` to debounce hover previews
- For downloads, use the export path (`exportToVideo`) rather than frame capture on `Player`

---

## Examples

- `examples/apps/hover-preview/` — YouTube-style grid
- `examples/apps/player-vite/` — Basic player
- `examples/apps/react-player/` — React with controls

---

## Next Steps

- [Rendering Architecture](./rendering-architecture.md) — preview vs capture vs CLI
- [Templates & Data](./templates-and-data.md) — writing templates