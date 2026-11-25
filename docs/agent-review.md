# Agent review of procedural media

SuperImg reviews technical validity, authored acceptance, and visual craft as
separate results. `check` produces compact machine-readable findings.
`inspect --review` produces rendered evidence and optional observations tied
to the compiled media and review sources. Agents inspect that evidence before
making a visual judgment.

## Run the city fixture

```bash
just cli check examples/showcase/sand-city/sand-city.media.ts --craft --json
just cli inspect examples/showcase/sand-city/sand-city.media.ts --review --review-clips --json
```

The co-located `sand-city.review.ts` selects thirteen beats, a detail crop, and
four short ranges totaling seven seconds. It checks camera clearance, material
population, projected route/building grains, arrival, and settled height.
`renderCity()` and `inspectCity()` share the same world sampler. The regression
fixture restores the earlier gaze that loses architecture during the lift;
geometry remains finite and collision-free, while its authored assertion fails.

## Time selectors

Inspect and check accept explicit seconds (`17.7s`), milliseconds (`17700ms`),
frames (`531f` or `f:531`), and explicit progress (`75%`). A selector
resolves after data and authored resolve have established the final frame clock.
Each sample reports the requested selector, resolved frame, encoded `seconds`,
and root `timelineSeconds`. Inclusive authored time can differ from the encoded
frame timestamp. Observations receive the actual frame-derived progress.

The review context owns the root media clock. For retained compositions, map
root time to a child occurrence before inspecting the child's local world.

## Review plans

Create `<name>.review.ts` next to `<name>.media.ts`, or pass
`--review-file <path>`. Import the portable `ReviewPlan` type from `@foxworth/superimg`.

```ts
import type { ReviewPlan } from "@foxworth/superimg";

export default {
  schemaVersion: 1,
  beats: [{ id: "overview", label: "The subject is readable", at: "4.4s" }],
  observe(ctx) {
    return { subjectCount: inspectWorld(ctx.timelineSeconds).subjectCount };
  },
  checks: [{ id: "subject", label: "Subject geometry projects", beat: "overview", metric: "subjectCount", min: 1 }],
} satisfies ReviewPlan;
```

Beats may include an authored pixel crop and an explicit clip range. Plans are
bounded to 24 beats and 128 checks. Observations return finite JSON synchronously;
they are trusted first-party author code, like the media source. A check reads a
dot-separated metric and compares `min`, `max`, or `equals`. Omit `beat` to apply
the assertion at every selected beat.

`--review` captures full frames and a labeled contact sheet. `--review-clips`
also encodes the declared ranges, bounded to three seconds each and eight
seconds total. Clips use bounded frame sampling and retain their source-frame
coordinates. Their clip-local clock is recorded separately.

Without a companion, the packet samples generic inspection frames and reports
authored observations as unverified. Missing captures, unavailable metrics, and
observation errors have explicit status. Machine results leave visual craft
unreviewed until an agent or person examines the linked evidence.

## Identity and coverage

Default output is under the media directory's `output/.superimg/review/`.
The directory and packet identify the compiled media bundle, compiled review
bundle, and capture selection. Selection includes data, variant/edition, frame
clock, beat choices, resources, and clip settings, so different selections keep
separate evidence. Each image, crop, contact sheet, and clip has a SHA-256 hash.

The bundle hashes include imported helper implementations. Runtime
`programDigest` describes the media value and function text; it has a different
scope and remains separately reported. Dev preview also exposes separate
revisions for the served ESM and the IIFE used by IR inspection.

Inspectability means the tree can be examined. Author-reported visible grain
counts describe geometry, not captured pixel coverage or aesthetic quality.
Review a city's silhouette, route readability, orientation through turns,
roof-visible pullback, and material continuity in its frames and clips. For
intentional camera travel and material processes, motion duration follows the
action; short UI transition heuristics apply to functional element transitions.

## Fresh preview

The dev server watches local imported helpers and unresolved relative import
directories, and retains generation checks while recompiling. Manual Reload
invalidates the compiled server cache and preserves the playhead. Inspect the
accepted presentation's source revision, frame, readiness, and generation when
capturing browser evidence.

Check resource parity before treating a live preview as visual acceptance. A
held frame can use fallback fonts when the host has no matching declarations.
Compare the preview's fonts and other resources with the export selection, and
use the rendered packet and exported film as the visual reference while any
resource mismatch remains unresolved.
