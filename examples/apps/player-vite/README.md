# SuperImg Player (Vite)

Basic example of using `SuperImgPlayer` in a Vite app.

## Usage

```bash
pnpm dev
```

## Features

- Template string loading
- Autoplay + loop
- Browser-based playback

## Performance

- Frame caching (default: 30 frames)
- Smooth 30fps playback via `requestAnimationFrame`
- First load: ~300-500ms for template compilation + initial render
- Subsequent frames: <16ms (cached)
