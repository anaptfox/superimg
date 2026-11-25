# Portable stage

One retained Program places a selected video edition and variant inside a nested reflow group, then overlays a differently sized SVG still. The video child declares local CSS and a relative SVG asset. `rebaseCompositionSources()` binds its named occurrence to the child's source URL before `time()` projects the Program to a video.

```bash
just cli check examples/composed/portable-stage/portable-stage.media.ts
just cli inspect examples/composed/portable-stage/portable-stage.media.ts
just cli export examples/composed/portable-stage/portable-stage.media.ts --for youtube
```
