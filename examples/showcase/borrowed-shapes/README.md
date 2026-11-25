# Borrowed Shapes

Porcelain matter acquires a seed, a bare tree, and a citadel, then returns to
the exact first seed. The 18,000 transported grains keep their identities;
1,600 separately identified ground grains remain static. Bone white and
lavender sit against ink plum under a fixed upper-left light and three-quarter
camera. The five primary limbs become five towers, and the trunk becomes the
courtyard gate.

## Brief

The audience should recognize the held forms and be able to follow material
between them. Transformation is the subject: preserve individual trajectories,
semantic correspondence, branch gaps, the open courtyard, and quiet settled
holds. Do not respawn grains, change the camera, or pass through another bed
between forms. There is no anatomy or captured photographic subject.

The master is 3840×2160 at 30 fps for 30 seconds. `teaching` is a shallow data
variant that adds captions without changing geometry, timing, or sound.
The gallery uses a silent 1280×720 `galleryLive` interactive definition on the
same 30-second choreography. Its host supplies logical time with each input;
`live` remains available as the canonical passive Player definition.

| Film seconds | Beat |
|---|---|
| 0–0.5 | Material rests on the bed |
| 0.5–3 | Grains gather into the seed |
| 3–6 | Seed holds |
| 6–11 | Seed becomes tree |
| 11–14 | Tree holds |
| 14–19 | Tree becomes citadel |
| 19–22 | Citadel holds |
| 22–27 | Citadel returns to seed |
| 27–30 | Exact seed holds |

## Model and integration

`sampleForms(input, { seconds, frame })` returns the complete deterministic
population. `renderForms(snapshot, view)` paints it; `observeForms(snapshot)`
reports counts, identity, phase, selected fidelity, and the exact return.
The sampler never accumulates state or draws random values while rendering.

Six semantic parts each contain 3,000 grains. The core seed caps map to trunk
and gate. Five seed ridges map to five primary limb networks and their
corresponding courtyard towers. Surface samples are ordered by ten-bit Morton
codes **within aligned local part frames**, with stable ties. Seed sampling
uses the ellipsoid surface Jacobian; tree tubes and architectural boxes use
their surface areas. Each primary limb has one terminal, so the five-part
correspondence remains countable. The shared radial frame sits eighteen
degrees from the closest camera axis. The five terminal positions have a
measured minimum separation of 149.37 pixels in the native 4K projection.
Unequal courtyard setbacks also keep tower centers at least 193.46 pixels
apart horizontally, so rear towers do not share a front tower's silhouette.
These geometric metrics support visual review; they do not measure pixels.
The first fork directions now separate by 18.00 degrees in the painted view,
and conservative circular envelopes at their first elbows have 56.90 pixels
of clearance at 4K. The shared branch junction intentionally touches. These
centerline/envelope measures support the matched native before/after crop;
they do not establish pixel contours.
A quintic transport curve has zero endpoint velocity. Limbs I–V start 0.2
seconds apart, with the core last; every morph still finishes at its original
five-second endpoint.
Sin-squared arcs are bounded to 24 world units and vanish at both endpoints.

`borrowed-shapes.media.ts` exports `film`, `live`, `galleryLive`, and `INITIAL_FORMS`.
The gallery adapter samples once from host-owned `logicalSeconds`, paints
that snapshot, and registers `forms-observation` metadata including the
accepted input version. The gallery reads those facts instead of sampling
another world.
The gallery controls play/pause, reverse scrubbing, frame stepping, hold buttons
at 4.5/12.5/20.5 seconds, and a twelve-ID diagnostic overlay. Labels use two
deterministic rails with leaders to their exact grain positions; label
rectangles do not overlap in the 900-frame full timeline fixture. Two IDs per part
are selected deterministically from separated front-facing surfaces at the
tree and citadel holds and protected in both fidelity modes. All twelve
remain drawable; six face the camera in the seed hold because the other
parts wrap behind its surface. The observation reports front-facing and
drawable counts separately. Reduced-motion live playback samples
settled forms. The film always retains the authored morphs.

Reduced draws a deterministic half of unprotected decorative grains while
retaining the union of silhouette grains across all three targets and all
twelve followed IDs. It still samples all 19,600 logical grains and reports
its actual drawn population. Do not silently switch fidelity during playback.

`MATERIAL_FONTS` supplies the same portable Inter bytes to film and live.
The soundtrack is integrated by the portfolio's offline synthesis step.
`FORMS_SOUND_CUES` names gather, each transport, and each hold, with porcelain
modes acquiring heavier stone resonances through the citadel. Both film cuts
use the same score. Interactive playback remains silent.

## Measurement and validation

`measurements.json` records the current model source hash and actual movement
measurements for all three morphs. Each reports endpoint distance, a
64-sample path-length integral, per-grain maximum adjacent-frame travel at
4K, and the twenty longest travellers. The comparison baseline uses the same
raw surface samples and motion curve with global Morton correspondence.
Both matchers receive the same per-source-part stagger schedule.
It also reports how many baseline pairings cross semantic parts.
Regenerate it with `node --import tsx examples/showcase/borrowed-shapes/measurements.mjs`.

The movement budgets are p95/p99/max endpoint distances of 338/442/520 world
units and p95/p99/max 4K frame steps of 12/18/24 pixels. Frame-step measurement
uses the actual inclusive authored clock `frame / 899 * 30`; encoded MP4
presentation time is `frame / 30`. Source measurements are not browser FPS or
visual acceptance. Baseline results are reported even where its median is
lower; semantic matching is not asserted to win every distance statistic.

After the first-fork fan-out and stagger revision, actual endpoint p95
distances are 233.55 / 312.21 / 278.03 world units for seed→tree / tree→citadel /
citadel→seed. Their maximum adjacent-frame steps are 14.88 / 14.17 / 12.70
pixels at 4K. The fair global Morton baseline has endpoint p95 distances
245.18 /394.48 /305.01 while crossing semantic parts in 11,394 / 13,404 / 13,848
pairings. Semantic correspondence has zero cross-part pairings.
The baseline still has shorter seed→tree and return maximum distances.

Fourteen model/adapter tests check conservation, exact return, continuity, shuffled seeks,
protected IDs, reduced motion, movement budgets, and known bad part-swap,
duplicate-ID, abrupt-switch, collapsed-tip, and collapsed-fork fixtures.
Immutable hold populations, ground paths, grain hashes, and facet tails are
cached without dropping logical samples or changing native paint precision.
The optimization parity report predates the intentional fork/stagger revision
and records exact poses and all 200 facet paths at 18 Full/Reduced snapshots.
Node-only author timings live in the portfolio acceptance folder; they are
not browser throughput or latency qualification. The co-located review contains
fifteen beats and six seconds of clips. Observe seed/tree/citadel holds at
4K, then inspect the three morph clips and the twelve-ID overlay.

Visible acceptance requires legible seed ridges, connected branching limbs,
five distinct tower masses, and an open courtyard. Grain texture must remain
visible in the native 4K crops. Full export, decoded frames, audio validation,
live hardware benchmarks, and Opus visual review remain in the portfolio's
acceptance manifest rather than being implied by these source tests.
