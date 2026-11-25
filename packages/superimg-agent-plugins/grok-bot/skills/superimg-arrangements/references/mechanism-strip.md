# Mechanism strip

```text
PATTERN
Mechanism strip

HUMAN QUESTION
How do these parts connect, in what order, and on whose evidence?

REQUIRED INFORMATION
Named nodes, directed edges, a declared order or layering, one evidence
kind per edge

PERCEPTUAL ARRANGEMENT
Nodes placed exactly where the declared order says; connectors carry
direction and their own claim

INVARIANTS
Every edge names an evidence kind
Edge endpoints reference declared nodes; node ids are unique
Every node appears exactly once in the layout, and all are covered
Node count stays inside the stage's legible bound
Predict requires revealIds, and cannot hide every edge

ADAPTATIONS
pipeline (one declared row)
layers (declared columns of stacked nodes)
hold / predict / reveal motion over edges, in declared order

FAILURE CONDITIONS
An arrow drawn where only timing is known
A layout the author did not choose
More nodes than the stage can render legibly
A box-and-arrow picture that removes no work the sentence already did
```

## The claim lives on the edge, not the picture

Every edge carries its own `claim`. A mechanism is a chain of separately
supported steps, so one evidence grade for the whole diagram would be a lie
about the weakest link:

```ts
edges: [
  { from: "deploy", to: "restart", claim: "observation" },
  { from: "restart", to: "latency", claim: "interpretation" },
]
```

`proposal` and `interpretation` edges are painted differently from
`observation` and `derived` ones. **A deployment beside an error spike is
timing, not causation.** If all you have is co-occurrence, that is
[aligned-intervals](aligned-intervals.md) — two tracks on one clock — not an
arrow. Reaching for an arrow because it looks explanatory is the failure this
pattern exists to make visible.

## No automatic graph layout

Position comes only from `layout`. There is no force simulation, no ranking
pass, no routing algorithm:

```ts
layout: { kind: "pipeline", order: ["types", "core", "cli"] }
layout: { kind: "layers", layers: [["authoring"], ["core", "stdlib"], ["cli"]] }
```

A picture whose arrangement the author did not choose cannot make a reliable
claim. Only *sizing* responds to the stage. If the mechanism does not have a
declarable order, it is not ready to be drawn.

`too-dense` fires when the declared layout exceeds what the stage renders
legibly. That is a real refusal: split the mechanism or use `layers`. Do not
shrink the type to fit more boxes.

## Motion is for order, not decoration

Same `hold` / `predict` / `reveal` vocabulary as aligned intervals, but
`revealIds` addresses edges as `` `${from}->${to}` ``:

```ts
motion: { phase: "predict", revealIds: ["restart->latency"] }
```

Motion is justified only because edge order and direction *are* the
mechanism. A strip that merely fades boxes in is a slideshow. `predict` that
hides every edge leaves no context and is refused.

## Call

```ts
arrange.mechanismStrip({
  question: "How does a media program become bytes?",
  workRemoved: "Tracing which stage hands what to the next, and on what evidence",
  evidence: "derived",
  nodes: [
    { id: "types", label: "types", note: "define()" },
    { id: "core", label: "core", note: "IR" },
    { id: "cli", label: "cli", note: "export" },
  ],
  edges: [
    { from: "types", to: "core", claim: "derived", label: "media value" },
    { from: "core", to: "cli", claim: "derived", label: "bytes" },
  ],
  layout: { kind: "pipeline", order: ["types", "core", "cli"] },
  source: "packages/*/package.json dependency graph",
});
```

Portable equivalent, for the JSON door:

```bash
superimg check mechanism.json          # admission only, no browser
superimg export mechanism.json --for 1080x1080.png --at 4s
```

Because the pattern declares motion, a still export needs `--at`.
