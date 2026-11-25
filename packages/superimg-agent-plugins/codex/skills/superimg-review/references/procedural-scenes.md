# Reviewing procedural scenes

Use this branch for seeded particles, camera journeys, simulated processes,
and material transformations. Start with the held composition and the action
the audience must understand. The sand-city showcase is a complete fixture:
`examples/showcase/sand-city/sand-city.media.ts` and `sand-city.review.ts`.

## Author a repeatable world

1. Generate stable samples with durable seeds. Compute each frame from authored
   time so out-of-order seeks reproduce the same state.
2. Share the world sample between paint and observation. The city's
   `renderCity()` and `inspectCity()` use the same `sampleCity()` implementation.
3. Batch grains into stable depth/color paths; preserve nonzero placeholder
   geometry at opacity zero for empty batches when retaining their identities.
4. For a perspective camera, normalize the view basis, clip before dividing by
   depth, and keep its eye in open space. One route should drive camera, map,
   turn instructions, and distance. Test joins and the final look-ahead.
5. Decide what must remain legible during travel and pullback before polishing
   sparkle or secondary motion.

## Declare observable intentions

Create a co-located `<name>.review.ts` beside `<name>.media.ts`:

```ts
import type { ReviewPlan } from "@foxworth/superimg";

export default {
  schemaVersion: 1,
  beats: [
    { id: "rise", label: "Rooftops stay in view", at: "17.7s", range: ["17s", "19s"] },
  ],
  observe(ctx) {
    // In a single-scene work, the root authored clock is render(ctx).timeline.seconds.
    return { visibleArchitecture: sampleWorld(ctx.timelineSeconds).visibleArchitecture };
  },
  checks: [
    { id: "architecture", label: "Architecture projects during rise", beat: "rise", metric: "visibleArchitecture", min: 100 },
  ],
} satisfies ReviewPlan;
```

`observe` is trusted, opt-in first-party code run by the CLI. Its geometry
counts are author-reported facts, not measured pixel coverage. Checks use
those facts; visual acceptance still comes from captured images/clips. Choose
thresholds from the brief and include a known failing fixture so a check earns
its claim. The city fixture rejects the original empty-sky pullback.

The observation context uses the root media clock. For retained multi-scene
works, map that clock to the authored child occurrence before inspecting a
child's world; root time does not establish a child's local pose.

The plan and media have separate compiled bundle identities. A packet records
them with the captured frames and evidence hashes. Use the packet's limits for
beat counts, ranges, and total clip duration; split larger reviews by scene.

## Capture and review

```bash
just cli check examples/showcase/sand-city/sand-city.media.ts --craft --json
just cli inspect examples/showcase/sand-city/sand-city.media.ts --review --review-clips --json
```

The default packet contains labeled frames and a contact sheet. Crops and
short clips are included when requested by the plan/flags. Inspect the
overview, before/after turns, pullback, transition, and settled ending. Compare
affected beats after a correction; then verify the encoded film.

Keep three conclusions explicit:

| Result | What establishes it |
|--------|---------------------|
| Technical validity | structural/runtime checks and repeatable frame tests |
| Authored acceptance | observed metric against the declared assertion |
| Visual craft | captured evidence reviewed against focal subject and purpose |

The city review asks whether the silhouette reads as a city, the cyan route
leads the eye, turns agree with the map, rooftops remain understandable during
the rise, and deconstruction settles into related material. Continuous GPS
travel is intentional; evaluate orientation, speed joins, and readability
through that beat rather than shortening it to a UI transition.
