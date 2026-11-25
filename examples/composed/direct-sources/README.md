# Direct sources inside a retained program

The same owned SVG bytes become a vector child and an image child. `together()`
places them on an explicit 1200 × 600 canvas; a nested `hold` keeps that group
visible for two seconds. The authored caption runs at 30 fps while the complete
program exports at 24 fps.

```bash
superimg check examples/composed/direct-sources/direct-sources.media.ts
superimg inspect examples/composed/direct-sources/direct-sources.media.ts --pretty
superimg export examples/composed/direct-sources/direct-sources.media.ts --for 1280x720.mp4
```

For a file source, replace `{ bytes, mimeType }` with an absolute `file:` URL.
`source.video({ src, size, fps, duration, trim })` can join the same sequence;
it samples video frames, while audio is added explicitly to the definition.
