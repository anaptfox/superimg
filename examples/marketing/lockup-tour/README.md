# Lockup tour

One lockup, many materials. Taught as a draw-on, then cut like comics.

- `lockup-reveal.media.ts` — 6s draw → mark → hold. Not driven (frame 0 is empty).
- `lockup-tour.media.ts` — frame 0 is cream. Match-cut paints. Spring home. This is the driven film.

```bash
just example apps/lockup-scroll    # drive="scroll"
just example apps/lockup-pointer   # drive="pointer"
just cli check examples/marketing/lockup-tour/lockup-tour.media.ts --pretty
just cli export examples/marketing/lockup-tour/lockup-reveal.media.ts --for 1080x1080.mp4
```

Do not move the mark. Do not morph the path. Do not start on the flicker.
