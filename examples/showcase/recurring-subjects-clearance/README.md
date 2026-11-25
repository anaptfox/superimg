# Coffee: authored clearance review

This revision preserves the original `recurring-subjects-3d` film and stages its
spoon away from the mug. Both mugs and the spoon have persistent subject identities.
The renderer and review share accepted dimensions and sampled transforms.

`spatial-review.ts` is an example-local, pure geometry evaluator. Its rule asks for
0.8 cm between the spoon and each mug. It compares conservative, transformed
part bounding boxes in centimetres and emits portable findings with entity ids,
limiting part ids, required distance, evidence class and distance lower bound.

- `clear`: declared bounds guarantee the requested separation.
- `possible-intersection`: bounds overlap; this does **not** establish mesh collision.
- `clearance-unverified`: positive lower bound is below the requested separation.
- `unverified`: a required subject proxy is missing.

The review companion chooses to fail a check when the requested gap is unproven.
A host can instead warn, require review, or accept intentional contact. This
example never moves objects automatically or grants edit authority. Boundary
continues to guard host interactions and revisions; it does not own geometry.

Run these commands from the repository root.

```sh
pnpm install --frozen-lockfile
just cli inspect examples/showcase/recurring-subjects-clearance/recurring-subjects-clearance.media.ts --review --json
just cli inspect examples/showcase/recurring-subjects-clearance/recurring-subjects-clearance.media.ts --variant touching --review --json
just cli export examples/showcase/recurring-subjects-clearance/recurring-subjects-clearance.media.ts --variant default --for 1280x720.mp4 --for 1080x1080.mp4
```

The `touching` variant retains the original spoon placement for reproducing the
warning. Select `default` explicitly when exporting the repaired film; export
otherwise includes all variants. Ordinary `check` does not execute these authored
review rules. `inspect --review` does.

The tests cover every encoded frame in both editions. The renderer exposes a
local `coffeeGeometryEvidence()` canvas probe for comparing actual Three.js mesh
vertices against declared part bounds at selected rendered frames. This is a
consumer experiment, not a general collision, occlusion, or screen-space gap API.
