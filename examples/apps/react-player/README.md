# React Player Example

React example demonstrating the `Player` component from `superimg-react`.

## Features

- **YouTube-style Grid**: Responsive grid layout with hover previews
- **Player Component**: Declarative React component wrapping `SuperImgPlayer`
- **Hover Previews**: Play on hover with configurable delay
- **Lazy Loading**: Players only load when visible
- **Basic Player Demo**: Auto-playing player with manual controls

## Usage

```bash
# Install dependencies
pnpm install

# Start dev server
pnpm dev

# Build for production
pnpm build
```

## Code Examples

### Basic Player

```tsx
import { Player } from "superimg-react";

<Player
  input={templateCode}
  width={640}
  height={360}
  autoPlay
  loop
/>
```

### Hover Preview

```tsx
<Player
  input={templateCode}
  width={320}
  height={180}
  hoverToPlay
  hoverDelay={200}
  lazy
  maxCacheSize={30}
/>
```

### With Ref Controls

```tsx
const playerRef = useRef<PlayerRef>(null);

<Player
  ref={playerRef}
  input={templateCode}
  width={640}
  height={360}
/>

<button onClick={() => playerRef.current?.play()}>Play</button>
```

## Props

- `input`: Template string or module
- `width`: Canvas width in pixels
- `height`: Canvas height in pixels
- `autoPlay`: Auto-play on load (default: false)
- `loop`: Loop playback (default: true)
- `hoverToPlay`: Play on hover (default: false)
- `hoverDelay`: Hover delay in ms (default: 200)
- `lazy`: Lazy load when visible (default: false)
- `maxCacheSize`: Maximum frames to cache (default: 30)
- `onReady`: Callback when player is ready
- `onPlay`: Callback when playback starts
- `onPause`: Callback when playback pauses
- `onFrame`: Callback on each frame
