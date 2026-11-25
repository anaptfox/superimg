# Story Kit

`story-kit.ts` defines one reusable story from named children. The chapter is a
sequence in its own right, then appears as one child of the complete story.
`story-kit.media.ts` projects that same program onto a 25 fps clock.

The schedule is deliberately small and exact:

| Part | Frames |
| --- | ---: |
| opener | 0–24 |
| chapter/demo | 25–31 |
| chapter/result | 32–56 |

The complete film is 57 frames. A host can present the same `story` with
`present(player, story, { mode: "manual", size, fps })` from
`@foxworth/superimg/player/program`. Selecting the chapter plays its nested
sequence on its own clock.

## Review and revise without flattening the story

Keep these named children and imported modules as the reusable source. The
[Revision review companion](../../apps/revision-review/README.md) demonstrates
exact source edits and two-sided comparison on a deliberately literal title
frame. It does not imply arbitrary imported or computed children support the
same edit command. Do not inline this story just to make a binding editable.

An inspection identifies the selected occurrence and its clock. A proposed
revision should retain both executable inputs and report whether comparison
uses the same global frame or a corresponding part-local moment. A shortened
part may have no frame on one side; report absence instead of clamping it into
a misleading match. Schedule differences identify timing changes, not pixel
equivalence or permission to reuse rendered frames.

A small `.review.ts` companion can reuse the geometry that renders a child.
`observeBounds` and `observePresence` from `@foxworth/superimg/review` provide structural
observations for the existing `ReviewPlan` evaluator. An unavailable metric
remains unverified. The revision example shows this explicitly for pixel
readability; a passing box check cannot establish readability or occlusion.
