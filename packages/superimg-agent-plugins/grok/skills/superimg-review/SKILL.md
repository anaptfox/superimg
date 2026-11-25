---
name: superimg-review
description: >
  Review SuperImg *.media.ts for technical correctness, agreement with the
  brief, and visible motion craft. Uses check, captured review evidence, and
  revision comparisons. Load for review, critique, QA, or readiness questions.
version: 0.1.1-media-library.20261022.1
---

# SuperImg Review

Review three results separately: technical validity, authored acceptance checks,
and visual craft. A green structural check establishes the first result.

## Pipeline

**Never shell out to `ffmpeg` or `magick montage` to extract frames or build contact sheets** — `--review` generates `contact-sheet.png` and frame PNGs automatically.

1. Read the brief's focal subjects and observable acceptance for each beat.
2. Run `just cli check <media> --for <target> --craft --json` (e.g., `--for 1080x1920`). Resolve errors; retain warnings with their scope. Check reports use schemaVersion **0**.
3. Run `just cli inspect <media> --for <target> --at 0.8s,1.9s,6.2s --review` (or omit `--at` to automatically sample every director act/phase hold; add `--review-clips --json` when needed). A co-located `*.review.ts` supplies labeled beats, observation checks, ranges, and crops; otherwise `--review` samples `--at` times or phase-aware director holds and writes `contact-sheet.png` + frame PNGs into `.superimg/reviews/...`. Inspect the generated contact sheet and frame PNGs. For particles, camera travel, and material transformations, read [procedural-scenes.md](references/procedural-scenes.md).
4. Review whether each rendered beat serves its stated purpose. Cite the exact
   frame/range and evidence file for each finding. Record missing observations
   as unreviewed, and keep author-reported geometry distinct from pixels.
5. After an intentional change, recapture the affected beats and compare with
   their prior evidence. `baseline save` / `diff --baseline --expect-only` can
   bound structural changes; the packet's compiled identities identify the
   actual source behind visual evidence.
6. Export with `--review` (and optional `-o out.mp4` direct output) to verify the corresponding beats in the encoded movie before delivering a film. Source review and preview captures have separate scope.

Inspect/check accept `--for` (organic destination ID or `WIDTHxHEIGHT[.format]`) and explicit `17.7s`, `17700ms`, `531f` / `f:531`, or unitless
progress 0–1. Use explicit units when reviewing a named event. Reports expose
the resolved frame and distinguish encoded time from scene-local time.

For an already-mounted live media preview, use the
[browser capture workflow](../superimg/references/live-browser.md). Keep its
accepted-frame verdict and source-identity scope with the visual finding.
Preview evidence remains separate from decoded export acceptance.

## Review the delivered movie

```bash
just cli export film.media.ts --for 1920x1080.mp4 --review -o film.mp4 --json
```

This exports once (writing directly to `-o film.mp4` when specified) and decodes the exact published movie bytes into a post-encode `contact-sheet.png` and frame PNGs. The existing
co-located `*.review.ts` selects frames, crops and bounded ranges; ranges produce
re-encoded review clips from decoded source frames. Without a companion, `--review`
samples director phase/act holds (or bounded generic frames) automatically. `inspect --review` remains the source
preview path.

The first delivery surface accepts one explicit `WIDTHxHEIGHT[.mp4|.webm]` (or single-target `--for`)
target, one animated authored source, and one selection. Select `--variant` and
`--edition` explicitly when alternatives exist. Collections, dynamically resolved
observation data, multiple targets, `--at`, `--poster` and `--dry-run` are not
supported with movie review. Known canvas/clock/evidence limits are checked before
rendering; unsupported codecs or encoded timing can still fail after export.

JSON retains the publication receipt and reports `publication.state` separately
from `review.state`. A nonzero exit can mean publication completed but review
failed, was cancelled, or is incomplete: inspect those fields before taking
action, and do not blindly repeat a completed or uncertain publication. Successful
review adds absolute local `artifacts[].path` entries for movie, frames, crops,
clips and contact sheet, with hashes and decoded-source frame provenance.

The packet's `delivery` identifies the encoded movie SHA-256, byte length,
publication, clock and actual timestamps. Its technical scope is
`encoded-delivery`; source geometry and paint are not re-inspected from those
pixels. Authored observations remain author-reported and visual status remains
`unreviewed` until someone examines the evidence. Reusing a review requires the
expected source/selection identity plus unchanged movie and evidence bytes;
matching hashes do not authenticate a publisher or establish visual quality.

## Technical bar

| Blocker | Evidence |
|---------|----------|
| `check` `ok: false` | errors in `issues` / runtime findings |
| Raw `<svg>` in `Html()` | `RAW_SVG_IN_HTML` (use `Vector(...)` + `vector.*`) |
| Unitless motion `at` / `for` | `UNITLESS_MOTION_TIME` |
| Empty / NaN samples | `ALL_FRAMES_EMPTY`, `ANIMATION_PRODUCES_NAN` |
| Temporal APIs on static media | `TEMPORAL_API_ON_STATIC` |
| Missing required IR identities | Media IR `missing_id` |
| Authored assertion failed or unavailable | packet probe result with observed and expected values |

Coverage can remain unverified even when nodes are inspectable. Raw procedural
math may have no instrumented director motion. Report that limit explicitly.
Read `coverage` alongside findings: retain the checks performed, exact sampled
frames, estimated typography, measured layout, and unsupported paint or opaque
content. A single frame has no sequence coverage. Matching report scopes use
the same portable analysis; authored assertions and visible craft stay separate.

Use `check` or `inspect --rendered-layout` only when browser measurements are
needed. This opts into prepared browser resources; ordinary checks stay
browserless. `--profile` emits invocation counts and inclusive stage durations
to stderr. Add `--trace` with rendered layout for operation-scoped browser
diagnostics and trace attachments. Keep traces off during ordinary checks and
retain failed attempts; overlapping spans cannot be added into a command total.

## Native authored observations

Use `@foxworth/superimg/review` to share the existing `ReviewPlan` evaluation between
CLI and native hosts. `observeBounds(bounds, canvas)` returns structural
containment and dimensions, or an empty observation for unavailable/invalid
geometry. `observePresence(ids, target, "complete")` can establish absence; a
partial inventory cannot. Reuse the geometry that actually renders the scene.

`observeReviewBeat` invokes the plan observer; `evaluateReviewAssertions`
evaluates its checks with the existing semantics. These helpers do not create
a new review schema or establish pixel readability, occlusion, or visual craft.
Keep unavailable metrics unverified and label authored observations separately
from captured evidence. A host may block export on failed checks while retaining
unverified findings; disclose that policy and never call it visual acceptance.
For a small companion and a failed-then-corrected batch workflow, see
`examples/apps/revision-review/README.md`.

## Craft bar

Load `skills/animator/SKILL.md` when judging motion. Apply rules to the beat's
purpose: reading, functional transition, camera travel, process, or material.

- Keep one intended focal subject per beat and enough contrast to follow it.
- Reading beats need settled text; travel/process beats can remain continuous.
- Functional element exits are usually quicker than entrances. Material
  assembly and deconstruction use the action's intended weight.
- Stagger groups when order communicates meaning.
- Check title-safe areas and platform dead zones at actual delivery sizes.
- Derive animated state from authored time; check seeks and repeated frames.

## Report

State technical result, authored-check result, and visual result independently.
For each visible finding give its evidence frame/range, compiled source
identity, observation, consequence, and next edit. Prioritize at most five.
List beats or claims that remain unreviewed. Conclude acceptance only for the
covered brief; a machine packet does not assign a design-quality score.

Product UI hover/gesture review and pixel parity across machines are outside
this skill's scope.
