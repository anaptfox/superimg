# Hover Preview

YouTube-style hover preview using `SuperImgPlayer`.

## Usage

```bash
pnpm dev
```

## Features

- Hover to play, leave to pause
- 200ms hover debounce (prevents accidental triggers)
- Intersection Observer lazy loading (100px preload margin)
- LRU frame cache (30 frames, ~7 MB)

## Performance Optimizations

✅ **Lazy loading** - Template loads when card is near viewport  
✅ **Hover delay** - 200ms debounce prevents rapid triggers  
✅ **Reduced duration** - 2s at 24fps = 48 frames (vs 3s = 72)  
✅ **Cache limit** - Max 30 frames in memory (~7 MB)  
✅ **Canvas reuse** - No GIF encoding overhead

## Memory Profile

- **Single preview**: ~7 MB (30 frames × 320×180×4 bytes)
- **10 previews**: ~70 MB
- **50 previews**: ~350 MB (with lazy loading, only visible ones load)

## Alternatives Considered

- ❌ **Real GIF**: 3-10x slower, worse quality
- ❌ **Video element**: Requires pre-rendered file
- ✅ **Canvas playback**: Best balance (this approach)
