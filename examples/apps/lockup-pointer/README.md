# Lockup tour — pointer

Same SuperImg lockup, nine paints. `drive: "pointer"` maps X across the player box to the timeline. Press-and-drag is 1:1; release springs.

```bash
just example apps/lockup-pointer
```

The film is `examples/marketing/lockup-tour/lockup-tour.media.ts`. Frame 0 is cream. Author nothing about drive — `ctx.timeline.progress` is the clock.

See `examples/apps/lockup-scroll` for the scroll host.
