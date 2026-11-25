---
name: superimg-arrangements
description: >
  Choose and render a SuperImg perceptual arrangement that externalizes named
  human work. Use when a Grok Bot or agent is about to attach an image, make a
  before-and-after, annotate a screenshot, draw how a system works, compare
  corresponding states, show overlapping intervals, or ask whether to
  visualize. Do not use for arbitrary SuperImg video authoring, motion craft,
  or destination export.
version: 0.1.1-media-library.20261022.1
---

# SuperImg arrangements

The plugin's job is **design knowledge that survives reuse**, not a template
gallery and not a list of drawing operations.

`compare`, `overlay`, and `compose` are different kinds of thing. A pattern
fixes what must remain true, not everything that must appear.

## Admission

Do this before drawing:

1. Name the **reader's question**.
2. Name the **work the picture removes** from their head.
3. If you cannot name that work, answer in native text or a table.
4. If a scalar settles the question ("which is largest?"), answer. Do not chart it.
5. Pick a pattern whose **invariants you can actually meet**.
6. Admit the request through `check` or export’s built-in preflight. If it refuses, repair the spec or choose another medium.

Possessing a dataset is not a reason to visualize it.

Read [references/admission.md](references/admission.md) when the medium is in
doubt (text vs table vs image vs motion).

## Patterns in this library

| Pattern | Work it removes | Portable id |
|---|---|---|
| Point with context | Finding the object being discussed | `point-with-context` |
| Registered comparison | Matching corresponding elements and holding the reference | `registered-comparison` |
| Aligned intervals | Computing overlap, order, concurrency | `aligned-intervals` |
| Value against reference | Remembering a baseline while scanning values | `value-against-reference` |
| Mechanism strip | Tracing how parts connect, in what order, on whose evidence | `mechanism-strip` |

Read the matching reference before calling:

- [references/point-with-context.md](references/point-with-context.md)
- [references/registered-comparison.md](references/registered-comparison.md)
- [references/aligned-intervals.md](references/aligned-intervals.md)
- [references/value-against-reference.md](references/value-against-reference.md)
- [references/mechanism-strip.md](references/mechanism-strip.md)

Not shipped: exception field, specimen in context.

Status-board templates (`eng-status-square`, `ship-gates`, …) are **genres**.
They are not patterns. Do not treat them as this library.

## The JSON door — prefer this

Write a portable JSON request and export it directly. An explicitly supplied
JSON file is recognized by its content; `.arrange.json` remains a useful naming
convention. No project scaffold or generated TypeScript is required.

```bash
superimg check spec.json --json                         # optional admission only
superimg export spec.json --for 1920x1080.png --json    # includes admission
superimg export spec.json --for 1080x1920.png --json    # matching edition
superimg export spec.json --for 1920x1080.png --review --json
```

```json
{
  "pattern": "aligned-intervals",
  "editions": {
    "square": { "size": { "width": 1080, "height": 1080 } },
    "portrait": { "size": { "width": 1080, "height": 1920 } }
  },
  "spec": {
    "question": "Did the deploy overlap the error spike?",
    "workRemoved": "Computing overlap across separate records",
    "evidence": "derived",
    "size": { "width": 1920, "height": 1080 },
    "timeRef": { "unit": "min", "origin": 0 },
    "tracks": [
      { "id": "deploy", "label": "Deploy", "intervals": [{ "start": 0, "end": 8 }] },
      { "id": "errors", "label": "Errors", "intervals": [{ "start": 4, "end": 12 }] }
    ],
    "compare": { "kind": "overlap", "tracks": ["deploy", "errors"] }
  }
}
```

`compare` explicitly names the two tracks whose interval intersection is shown
in the answer. Touching endpoints are reported separately from positive overlap;
uncertain timing stays qualified. Without `compare`, no pair or answer is inferred
from the question. Temporal overlap does not establish causation.

Arrangement editions contain only `size`; data and meaning remain in the root.
Every target aspect must match the root or a declared edition. Explicit
`--edition square` / `--edition portrait` selects that rendition. Other shapes
receive an actionable `MISSING_EDITION` refusal instead of silent relayout.

Motion patterns use their completed-answer poster for an omitted still time.
`--at 0s` explicitly selects the first frame; `--duration 6s` sets arrangement
motion duration. An unavailable answer frame requires an explicit selection or
longer duration. Out-of-range explicit time reports `STILL_TIME_CLAMPED` and the
requested/resolved selection. Moving outputs retain their timeline.

JSON failures have one schema-1 envelope with `error`, a single `findings` list,
command `certainty` and separate `publication.state`. Usage errors exit 2;
media refusals exit 1. Unknown publication is not permission to retry.

Successful exports include absolute `artifacts[].path`, `mimeType`, `sha256`
and `bytes`, plus a retained manifest and input identity. Attach the actual path
from the Bot computer. `arrange` remains a compatibility command over the same
preparation/export path, including `superimg check spec.json`.

For one explicit custom PNG target, `--review` retains `review.json` with exact
captured bytes, input/selection/producer/resource identities and scoped technical
findings. Review writing and delivery publication have separate outcomes.
`inspect spec.json --review` can capture evidence without a project. Arrangement
moving/multiple-output review and authored crop/clip/observer plans are different
capabilities; use the disclosed supported surface. A technical pass leaves visual
acceptance unreviewed. Inspect the exact pixels at the intended display size.

The aligned-intervals fixture is qualified across landscape, square and portrait;
that does not qualify arbitrary content density or every pattern at every size.
Keep target-size findings visible and repair the composition before attaching.

### Images in a spec

A specimen view names a source: `{ "src": "shots/before.png" }`, resolved
against the **spec file's directory**. Or supply bytes inline and reference
them:

```json
{ "view": { "src": "asset:before" } }
"assets": [{ "id": "before", "mimeType": "image/png", "bytes": "<base64>" }]
```

The inline Boundary interaction `media.arrange.still` has no source directory:
specimen images must use supplied `asset:<id>` bytes. It shares preparation,
authored-aspect checks and encoded-frame selection with the CLI; it returns
PNG bytes rather than publishing a local bundle. Its `at` is seconds, omitted
time selects the answer poster, and the default target is 1080×1080. Supply a
square edition for a wide root or request explicit matching-aspect dimensions.
The byte envelope does not include the CLI's clamp warnings, review packet or
publication receipt. A plugin supplies instructions, not a Binding or grant.

Absolute paths, URL schemes, `..` traversal, UNC paths and drive letters are
**rejected by the parser**. This is a trust boundary, not a style rule.

### Delivering the image

| Host | How |
|---|---|
| Claude Code | Read the PNG path to see it, then embed it as an absolute Markdown path |
| Grok Bot | Attach the reported `path` from the Bot computer |
| Codex / other | Report the path; the host decides |

Look at what you made before you send it.

## Authoring in TypeScript

Still available when a spec is computed from code:

```ts
import { image, arrange } from "@foxworth/superimg";

export default image({
  size: { width: 1080, height: 1080 },
  render() {
    return arrange.registeredComparison({
      question: "What differs between these corresponding states?",
      workRemoved: "Matching corresponding elements and remembering the reference",
      evidence: "observation",
      states: [before, after],
      frame: { scale: "shared", viewport: { width: 1440, height: 900 }, crop: "header" },
      correspondence: ["logo", "nav", "cta"],
      source: "capture 2026-09-01 14:02",
    });
  },
});
```

Inspect failures without rendering: `arrange.check.registeredComparison(spec)`,
or `arrange.checkRequest(request)` for a portable one. `arrange.patterns` lists
every registered pattern with its schema and failure codes.

Stage: always a `Fill` (paper) plus Text color (ink is the Text default).
Author `size: { width: 1080, height: 1080 }` (or `editions.square`) for chat
stills. Inspect the intended target before promising it. `check` fails `UNPAINTED_STAGE` / `LOW_CONTRAST_TEXT` / `SPARSE_FOCAL`
when the export would look blank or empty. Square destinations without that
edition fail `MISSING_EDITION`. Done is SuperImg export, not a hand SVG.

`ArrangeError.failures` lists why the benefit would not survive.

## Evidence

Paint the distinction. Do not collapse it into one polished voice.

| Kind | Means |
|---|---|
| `observation` | One rendering under named conditions. Provenance required. |
| `derived` | Computed from records. |
| `interpretation` | An annotation or reading of evidence. |
| `proposal` | A mockup or future. Conditional. |

A deployment marker beside an error spike is timing, not causation. Do not
draw a causal arrow the data does not support — in a mechanism strip that
claim lives on each edge.

## Motion

Persistent arrangements for comparing states. Motion only when correspondence,
trajectory, timing, or transformation would disappear between inspectable
states. A slideshow of status cards is not a mechanism.

## Composition

Two good patterns can destroy each other (legibility, missing context). Check
the combined invariants. Do not stack arrangements because it looks complete.

## Related skills

| Need | Skill |
|---|---|
| Arbitrary `*.media.ts`, CLI, inspect | `superimg` |
| Full film from an idea | `superimg-pipeline` |
| Motion craft | `animator` |
| New scene look | `video-designer` |
| Export destinations | `superimg-ship` |
