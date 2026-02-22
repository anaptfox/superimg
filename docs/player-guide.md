# Player Guide

Guide to using SuperImg player in vanilla JavaScript and React.

## Overview

SuperImg provides two ways to play templates in the browser:

1. **Vanilla JS**: `Player` - Low-level player class with full control
2. **React**: `<Player>` - Declarative component wrapper

Both support:
- Template playback with canvas rendering
- Hover previews (YouTube-style)
- Lazy loading
- Frame caching (LRU)
- Playback controls

---

## Vanilla JavaScript

### Installation

```bash
npm install superimg
```

### Basic Usage

```typescript
import { Player } from "superimg/browser";
import type { RenderContext } from "superimg";

// Template module (function templates only)
const template = {
  config: {
    width: 640,
    height: 360,
    fps: 30,
    durationSeconds: 5,
  },
  render: (ctx: RenderContext) => {
    const { sceneProgress, sceneFrame, sceneTotalFrames } = ctx;
    return `
      <div style="
        width:100%;
        height:100%;
        display:flex;
        align-items:center;
        justify-content:center;
        font-family:system-ui;
        font-size:44px;
        color:white;
        background:linear-gradient(120deg, #667eea, #764ba2);
      ">
        Frame ${sceneFrame} / ${sceneTotalFrames}
      </div>
    `;
  },
};

const player = new Player({
  container: "#player",
  width: 640,
  height: 360,
  playbackMode: "loop",
});

const result = await player.load(template);
if (result.status === "success") {
  player.play();
}
```

### Hover Preview (YouTube-style)

```typescript
import { Player } from "superimg/browser";

const card = document.querySelector("#video-card");
const player = new Player({
  container: "#preview",
  width: 320,
  height: 180,
  playbackMode: "loop",
  loadMode: "lazy",
  maxCacheFrames: 30,
});

// Lazy load when visible
let isLoaded = false;
const observer = new IntersectionObserver(
  (entries) => {
    if (entries[0].isIntersecting && !isLoaded) {
      isLoaded = true;
      player.load(template).then((result) => {
        if (result.status === "success") {
          player.seekToFrame(0);
        }
      });
    }
  },
  { rootMargin: "100px" }
);
observer.observe(card);

// Hover to play with debounce
let hoverTimeout: number | undefined;
card.addEventListener("mouseenter", () => {
  hoverTimeout = window.setTimeout(() => {
    if (player.isReady) player.play();
  }, 200);
});

card.addEventListener("mouseleave", () => {
  if (hoverTimeout) clearTimeout(hoverTimeout);
  if (player.isReady) {
    player.pause();
    player.seekToFrame(0);
  }
});
```

### API Reference

#### Constructor Options

```typescript
interface PlayerOptions {
  container: string | HTMLElement;  // Container selector or element
  width?: number;                   // Canvas width (default: from template)
  height?: number;                  // Canvas height (default: from template)
  playbackMode?: PlaybackMode;      // 'once' | 'loop' | 'ping-pong' (default: 'once')
  loadMode?: LoadMode;              // 'eager' | 'lazy' (default: 'eager')
  hoverBehavior?: HoverBehavior;    // 'none' | 'play' | 'preview-scrub' (default: 'none')
  hoverDelayMs?: number;            // Delay before hover triggers (default: 200)
  maxCacheFrames?: number;          // Max frames to cache (default: 30)
  showControls?: boolean;           // Show built-in controls (default: false)
}
```

#### Methods

```typescript
// Load a template
const result = await player.load(template);
// result: { status: 'success', totalFrames, ... } | { status: 'error', message, suggestion }

// Playback controls
player.play();
player.pause();
player.stop();

// Seeking (explicit units)
player.seekToFrame(45);           // Seek to frame 45
player.seekToProgress(0.5);       // Seek to 50%
player.seekToTimeSeconds(2.5);    // Seek to 2.5 seconds

// Properties
player.isReady;             // boolean - Whether player is loaded
player.isPlaying;           // boolean - Whether currently playing
player.currentFrame;        // number - Current frame index
player.currentProgress;     // number - Progress (0-1)
player.currentTimeSeconds;  // number - Current time in seconds
player.totalFrames;         // number - Total frames
player.totalDurationSeconds;// number - Total duration
player.fps;                 // number - Frames per second
```

#### Events

```typescript
const player = new Player({ container: "#player" });

player.on("ready", () => console.log("Player ready"));
player.on("play", () => console.log("Started playing"));
player.on("pause", () => console.log("Paused"));
player.on("ended", () => console.log("Playback ended"));
player.on("frame", (frame) => console.log("Frame:", frame));
player.on("error", (err) => console.error("Error:", err));
```

### Multiple Players

```typescript
const videos = [
  { id: 1, template: template1 },
  { id: 2, template: template2 },
  { id: 3, template: template3 },
];

const players = videos.map((video) => {
  const player = new Player({
    container: `#player-${video.id}`,
    width: 320,
    height: 180,
    loadMode: "lazy",
    maxCacheFrames: 30,
  });
  
  player.load(video.template);
  return player;
});
```

---

## React

### Installation

```bash
npm install superimg superimg-react react react-dom
```

### Basic Usage

```tsx
import { Player } from "superimg-react";
import type { RenderContext } from "superimg";

const template = {
  config: { width: 640, height: 360, fps: 30, durationSeconds: 5 },
  render: (ctx: RenderContext) => {
    const { sceneProgress, sceneFrame } = ctx;
    return `
      <div style="
        width:100%;height:100%;
        display:flex;align-items:center;justify-content:center;
        font-family:system-ui;font-size:44px;color:white;
        background:linear-gradient(120deg, #667eea, #764ba2);
      ">
        Frame ${sceneFrame}
      </div>
    `;
  },
};

function App() {
  return (
    <Player
      template={template}
      width={640}
      height={360}
      playbackMode="loop"
    />
  );
}
```

### Hover Preview

```tsx
import { Player } from "superimg-react";

function VideoCard({ video }) {
  return (
    <div className="video-card">
      <Player
        template={video.template}
        width={320}
        height={180}
        hoverBehavior="play"
        hoverDelayMs={200}
        loadMode="lazy"
        maxCacheFrames={30}
      />
      <div className="video-info">
        <h3>{video.title}</h3>
        <p>{video.channel}</p>
      </div>
    </div>
  );
}
```

### With Controls (Ref API)

```tsx
import { useRef } from "react";
import { Player, type PlayerRef } from "superimg-react";

function ControlledPlayer() {
  const playerRef = useRef<PlayerRef>(null);

  return (
    <div>
      <Player
        ref={playerRef}
        template={template}
        width={640}
        height={360}
        onLoad={(result) => {
          if (result.status === "success") {
            console.log("Ready:", result.totalFrames, "frames");
          }
        }}
        onPlay={() => console.log("Playing")}
        onPause={() => console.log("Paused")}
      />
      
      <div className="controls">
        <button onClick={() => playerRef.current?.play()}>
          Play
        </button>
        <button onClick={() => playerRef.current?.pause()}>
          Pause
        </button>
        <button onClick={() => playerRef.current?.seekToFrame(0)}>
          Reset
        </button>
        <button onClick={() => playerRef.current?.seekToProgress(0.5)}>
          Go to 50%
        </button>
      </div>
    </div>
  );
}
```

### YouTube-Style Grid

```tsx
import { Player } from "superimg-react";

function VideoGrid({ videos }) {
  return (
    <div style={{
      display: "grid",
      gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))",
      gap: "24px",
    }}>
      {videos.map((video) => (
        <div key={video.id}>
          <Player
            template={video.template}
            width={320}
            height={180}
            playbackMode="loop"
            hoverBehavior="play"
            hoverDelayMs={200}
            loadMode="lazy"
          />
          <h3>{video.title}</h3>
        </div>
      ))}
    </div>
  );
}
```

### API Reference

#### Props

```typescript
interface PlayerProps {
  // Required
  template: TemplateModule;           // Template to render
  width: number;                      // Canvas width
  height: number;                     // Canvas height
  
  // Playback modes
  playbackMode?: PlaybackMode;        // 'once' | 'loop' | 'ping-pong' (default: 'loop')
  loadMode?: LoadMode;                // 'eager' | 'lazy' (default: 'eager')
  hoverBehavior?: HoverBehavior;      // 'none' | 'play' | 'preview-scrub' (default: 'none')
  hoverDelayMs?: number;              // Hover delay in ms (default: 200)
  
  // Performance
  maxCacheFrames?: number;            // Max frames to cache (default: 30)
  
  // Styling
  className?: string;                 // CSS class
  style?: React.CSSProperties;        // Inline styles
  
  // Events
  onLoad?: (result: LoadResult) => void;  // When player loads
  onPlay?: () => void;                    // When playback starts
  onPause?: () => void;                   // When playback pauses
  onEnded?: () => void;                   // When playback ends
  onFrame?: (frame: number) => void;      // On each frame
}
```

#### Ref API

```typescript
interface PlayerRef {
  player: Player | null;          // Underlying player instance
  isReady: boolean;               // Whether player is loaded
  isPlaying: boolean;             // Whether currently playing
  currentFrame: number;           // Current frame
  totalFrames: number;            // Total frames
  play: () => void;               // Start playback
  pause: () => void;              // Pause playback
  stop: () => void;               // Stop and reset
  seekToFrame: (frame: number) => void;     // Seek to frame
  seekToProgress: (progress: number) => void;  // Seek to progress (0-1)
  seekToTimeSeconds: (seconds: number) => void; // Seek to time
}
```

---

## Performance Tips

### Frame Caching

The player uses an LRU (Least Recently Used) cache to store rendered frames:

```typescript
// Vanilla JS
const player = new Player({
  container: "#player",
  maxCacheFrames: 30, // ~7 MB for 320x180 canvas
});

// React
<Player maxCacheFrames={30} />
```

**Memory usage**: `frames × width × height × 4 bytes`
- 30 frames × 320×180 = ~7 MB
- 30 frames × 640×360 = ~28 MB

### Lazy Loading

Load players only when they enter the viewport:

```typescript
// React - Built-in
<Player loadMode="lazy" />
```

### Hover Debouncing

Prevent excessive play/pause cycles on quick hovers:

```typescript
// React - Built-in
<Player hoverBehavior="play" hoverDelayMs={200} />
```

---

## Examples

### Full Examples

- **Vanilla JS**: [`examples/hover-preview/`](../examples/hover-preview/) - YouTube-style grid
- **Vanilla JS**: [`examples/player-vite/`](../examples/player-vite/) - Basic player
- **React**: [`examples/react-player/`](../examples/react-player/) - React grid with hover previews

### Live Demos

```bash
# Vanilla JS - Hover Preview
cd examples/hover-preview
pnpm dev

# Vanilla JS - Basic Player
cd examples/player-vite
pnpm dev

# React - Full Demo
cd examples/react-player
pnpm dev
```

---

## Troubleshooting

### Memory Usage

If players are using too much memory:
1. Reduce `maxCacheFrames` (default: 30)
2. Reduce `durationSeconds` in templates
3. Enable lazy loading with `loadMode: "lazy"`
4. Use lower resolution (`width`/`height`)

### Performance Issues

If playback is choppy:
1. Check browser DevTools Performance tab
2. Reduce canvas size (`width`/`height`)
3. Simplify template HTML/CSS
4. Lower `fps` in template config
5. Ensure `maxCacheFrames` is sufficient

### React: Player Not Rendering

Make sure you have both dependencies:

```json
{
  "dependencies": {
    "superimg": "latest",
    "superimg-react": "latest",
    "react": "^18.0.0 || ^19.0.0"
  }
}
```

---

## Next Steps

- [Templates & Data](./templates-and-data.md) - How to write templates
- [Rendering Architecture](./rendering-architecture.md) - How rendering works
