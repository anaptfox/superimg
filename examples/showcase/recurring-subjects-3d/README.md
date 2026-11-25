# Second Cup

A 12-second coffee micro-film designed with Opus: shared honey-glazed ceramic,
oak and linen, a motivated lift/return across a time cut, and a perspective
camera that moves from tabletop intimacy to a view of both coffee surfaces.
The original flat `recurring-subjects` example is retained.

`subjectSet` samples one accepted design for two persistent entities. Breakfast
returns at 55% fill; counter remains full. Geometry and materials are shared by
both Three.js mug groups. Frame state is pure authored time. The native surface
retains the world and passes each sample as typed data without accumulating state.

From the repository root, install the workspace dependencies and run the checks
or export.

```sh
pnpm install --frozen-lockfile
just cli check examples/showcase/recurring-subjects-3d/recurring-subjects-3d.media.ts
just cli inspect examples/showcase/recurring-subjects-3d/recurring-subjects-3d.media.ts --review --review-clips
just cli export examples/showcase/recurring-subjects-3d/recurring-subjects-3d.media.ts --for 1280x720.mp4 --for instagram-square
```

The WebGL interior is opaque to native layout/geometry inspection. Semantic
metadata preserves explicit subject bindings, state and camera samples; it does
not claim resolved 3D bounds, hit regions or measured pixels. Review metrics are
author-reported continuity assertions. Actual lighting, framing and readable
state require rendered evidence. The executable Three.js island uses the trusted
export path; render-only players strip scripts.

Square source checks can report `FOCAL_COVERAGE_UNVERIFIED`: the canvas interior
has not been measured as ink. This warning requires rendered review; it does
not establish a successful visual composition. Tiny, hidden or offstage opaque
boxes still cannot satisfy the sparse-focal bounds threshold.
