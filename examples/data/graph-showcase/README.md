# One Grid

A 16-second graph film with a near-black stage, warm white typography, one
vermilion accent and a fixed zero ruler. Developed with Fable's art direction.
The landscape composition and square edition are authored independently.

The film establishes its grid, reveals a weekly project series, changes to grouped
signed bars, then settles into a composed poster. The observations are fictional
and remain labelled as illustrative throughout. Missing Current/API is `n/a`,
never an invented zero. The terminal 52 is read from the resolved final datum.

Both full-size charts use explicit identical margins and the same `[-20, 60]`
domain. Their zero positions therefore agree exactly. The final bar chart changes
width (and square height) while its origin compensates to keep zero fixed. A
small line in the final composition is a separate named visual occurrence.
The area tint is built from the resolved line points and zero projection;
its fill appears after the line finishes. Category growth uses separate keyed
marks with a 60 ms stagger. Nothing depends on preceding frames.

```sh
just cli check examples/data/graph-showcase/graph-showcase.media.ts
just cli check examples/data/graph-showcase/graph-showcase.media.ts --edition square
just cli inspect examples/data/graph-showcase/graph-showcase.media.ts --at 2s,7s,7.8s,11.5s,15.5s --png
just cli export examples/data/graph-showcase/graph-showcase.media.ts --for youtube --for instagram-square
```

Review intro at 2 seconds, completed line at 7, line exit at 7.8, completed bars
at 11.5, and the final poster at 15.5. The last 2.3 seconds hold still. Tests cover
shared baseline geometry, positive/negative semantics, the absent datum, shuffled
seeking and text bounds in both editions. Technical checks do not approve visual
quality; inspect the captured beats and encoded outputs.
