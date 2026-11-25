# SuperImg / Works 001

A 36-second silent technical film. `works.media.ts` is the film;
`specimen.media.ts` is the complete small program shown on screen. Both use
`tile.ts`, so the authoring and time-sampling scenes render the actual specimen.

The authored default is 1920 × 1080 at 30 fps. An exact square edition and a
responsive portrait composition keep the same story at other delivery sizes.
The film uses local system fonts and native tree primitives, with no fetched
assets, browser timers, or wall-clock CSS animation.

| Beat | Seconds | Suggested hold |
| --- | --- | --- |
| Media as a function | 0–5 | 3.5 |
| Actual source and rendered tree | 5–14 | 9 |
| Explicit time samples | 14–22 | 19.5 |
| Delivery dimensions | 22–30 | 26 |
| SuperImg end card | 30–36 | 33 |

The time beat selects `tile(0.5)`, then `tile(1.0)`, then returns to `tile(0.5)`.
This illustrates deterministic authored state, not cross-machine pixel parity.
The rendition cards illustrate art direction; final exported files are the
evidence that the delivery path succeeded.

```sh
pnpm exec tsc --project examples/showcase/works/tsconfig.json
just cli check examples/showcase/works/works.media.ts --pretty
just cli inspect examples/showcase/works/works.media.ts --pretty
just cli inspect examples/showcase/works/works.media.ts --at 25% --png
just cli export examples/showcase/works/works.media.ts --for youtube --for instagram-square
```

Inspect's `--at` uses normalized progress; export's `--at` uses seconds.

`works.end.title` is a literal-position Frame (`x: 120`, `y: 420`) available for
an Edit interactions transform demonstration. It holds the end-card wordmark. Its compact
layout transform remains separate from those source coordinates.

For the desktop integration proof, load this folder as the source project, bind
the desktop's interactions, inspect current edit bindings, and submit the transform
with the returned source and intent hashes. Seek to 33 seconds to see the title.
Run check and export through that same desktop-owned mount; record its actual
receipt instead of treating the command examples above as proof of execution.
