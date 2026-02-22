# SuperImg

Programmatic video generation with HTML/CSS templates. Create stunning videos from code.

## Features

- **Template-based rendering** - Write video frames as HTML/CSS, render to MP4
- **TypeScript-first** - Full type safety with branded types and discriminated unions
- **AI-friendly API** - Explicit, self-documenting, no magic globals
- **Browser & Server** - Player for browser, Playwright renderer for server
- **React components** - First-class React support with hooks and components

## Quick Start

### CLI Rendering

```bash
# Create a template
superimg dev template.js    # Live preview
superimg render template.js -o output.mp4  # Render to video
```

### Template Example

```typescript
// template.js
import { defineTemplate } from 'superimg';

export default defineTemplate({
  config: { width: 1920, height: 1080, fps: 30, durationSeconds: 5 },
  render(ctx) {
    const { std, sceneProgress, width, height } = ctx;
    const hue = std.math.lerp(0, 360, sceneProgress);

    return `
      <div style="
        width: ${width}px;
        height: ${height}px;
        background: hsl(${hue}, 80%, 50%);
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 64px;
        color: white;
      ">
        Hello, SuperImg!
      </div>
    `;
  },
});
```

### Browser Player

```typescript
import { Player } from 'superimg/browser';
import myTemplate from './templates/my-template';

const player = new Player({
  container: '#player',
  width: 1280,
  height: 720,
  playbackMode: 'loop',
});

const result = await player.load(myTemplate);
if (result.status === 'success') {
  player.play();
}

// Explicit seeking (no ambiguous units)
player.seekToFrame(45);
player.seekToProgress(0.5);
player.seekToTimeSeconds(2.5);
```

### React

```tsx
import { Player } from 'superimg-react';
import myTemplate from './templates/my-template';

function App() {
  return (
    <Player
      template={myTemplate}
      width={1280}
      height={720}
      playbackMode="loop"
      hoverBehavior="play"
    />
  );
}
```

## API Highlights

### Explicit Context (No Magic Globals)

```typescript
// ctx.std is explicit - no ambient globals
export function render(ctx: RenderContext) {
  const { std, sceneProgress, width, height } = ctx;
  const eased = std.easing.easeOutCubic(sceneProgress);
  return `<div>...</div>`;
}
```

### Descriptive Field Names

| Old | New |
|-----|-----|
| `progress` | `globalProgress` / `sceneProgress` |
| `frame` | `globalFrame` / `sceneFrame` |
| `time` | `globalTimeSeconds` / `sceneTimeSeconds` |

### Mode Enums

```typescript
const player = new Player({
  playbackMode: 'loop',    // 'once' | 'loop' | 'ping-pong'
  loadMode: 'lazy',        // 'eager' | 'lazy'
  hoverBehavior: 'play',   // 'none' | 'play' | 'preview-scrub'
});
```

### Self-Describing Returns

```typescript
const result = await player.load(template);

if (result.status === 'success') {
  console.log(`${result.totalFrames} frames loaded`);
} else {
  console.error(`Error: ${result.message}`);
  console.error(`Suggestion: ${result.suggestion}`);
}
```

## Installation

```bash
# Main package
npm install superimg

# React components
npm install superimg-react

# Server-side rendering requires Playwright
npm install playwright
```

## Documentation

- [API Reference](./docs/api.md) - RenderContext and stdlib
- [Templates & Data](./docs/templates-and-data.md) - Creating templates with defaults
- [Player Guide](./docs/player-guide.md) - Browser playback

## Security

- Rendering executes template code. Treat templates as trusted input unless you run rendering in a sandboxed environment.
- CLI metadata inspection (`superimg info`) statically parses template exports and does not execute template code.

## Examples

See the [examples/](./examples/) directory for working examples:

- `examples/hello-world/` - Simple animated greeting
- `examples/server/` - Server-side rendering
- `examples/react-player/` - React player with hover previews

## Development

```bash
# Install dependencies
pnpm install

# Build all packages
pnpm build

# Run tests
pnpm test

# Run an example
cd examples/server
pnpm render
```

## License

MIT
