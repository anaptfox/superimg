# SuperImg CLI

Command-line interface for SuperImg video rendering.

## Installation

```bash
pnpm install
pnpm build
```

## Usage

### Development Server

Start a development server with live preview:

```bash
superimg dev template.ts
superimg dev template.ts --port 3000
superimg dev template.ts --no-open  # Don't open browser automatically
```

### Render Video

Render a template to MP4:

```bash
superimg render template.ts -o output.mp4
superimg render template.ts -o output.mp4 --width 1920 --height 1080 --fps 30
```

### Show Info

Display template information:

```bash
superimg info template.ts
```

## Template Format

Templates are JavaScript/TypeScript files that export a `render` function:

```typescript
export function render(ctx) {
  return `
    <div style="width: ${ctx.width}px; height: ${ctx.height}px; background: blue;">
      Frame ${ctx.frame} / ${ctx.time.toFixed(2)}s
    </div>
  `;
}
```

## Context API

The `render` function receives a `RenderContext` object with:

- `frame`: Current frame number (0-indexed)
- `time`: Current time in seconds
- `progress`: Progress from 0 to 1
- `width`: Output width in pixels
- `height`: Output height in pixels
- `fps`: Frames per second
- `totalFrames`: Total number of frames
- `durationSeconds`: Total duration in seconds


