# Documentary reel

Five chapters share one deterministic film treatment, using `compose()`, chapter-local directors, `ctx.track()` and a composition-wide music bed.

The three clips labelled **placeholder audio** reuse slices of the bundled music asset. They exercise per-scene positioning and voice-role ducking; they are not spoken narration. Caption timestamps are illustrative reading timings, not measured speech alignment. To publish a narrated version, supply actual chapter recordings and their measured word timings in `reel.ts`.

The drawings simplify the history of moving pictures. The twelve displayed exposures are a diagram, and the sixteen-frames threshold is an illustrative transition in this scene rather than a universal perceptual limit.

```sh
just cli check examples/composed/documentary-reel/documentary-reel.media.ts
just cli export examples/composed/documentary-reel/documentary-reel.media.ts --for youtube
```
