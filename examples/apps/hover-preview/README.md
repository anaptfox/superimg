# Hover Preview

Hover or focus a card to play a SuperImg program. Leave it to pause and return
to the first frame. The host delays playback by 200 ms and preloads cards within
100 px of the viewport with `IntersectionObserver`.

From the repository root:

```bash
just build-render
pnpm --filter superimg-example-hover-preview dev
```

The six loops live in `../_shared/preview.media.ts`, also used by `react-player`.
They use typed `Frame`, `Fill`, and `Text` nodes plus `std.oscillate` / `std.loop`.
There are no pre-exported videos or wall-clock CSS animations.

The host waits for `Player.load()` before playing, retains hover/focus intent
while loading, permits retries after load errors, and disposes players, observers,
and pending hover timers during Vite hot reload. Memory usage depends on the
player runtime and browser; this example does not configure an LRU frame cache.
