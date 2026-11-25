# Value against reference

```text
PATTERN
Value against reference

HUMAN QUESTION
How does each value stand against the baseline I care about?

REQUIRED INFORMATION
Named items with values, and the reference each is judged against

PERCEPTUAL ARRANGEMENT
Values placed against their baseline, so the comparison is seen, not recalled

INVARIANTS
Every item has a stable id and label
A reference is a finite number
A shared scale needs one unit, declared
Mixed units require scale: "per-item"

ADAPTATIONS
scale: "shared"   — one axis, values directly comparable
scale: "per-item" — each item against its own baseline

FAILURE CONDITIONS
A baseline the reader has to hold in their head
Different units on one shared scale
A single value, where a sentence already answers the question
A grid of tiles that restates numbers without positioning them
```

## The reference is the point

Without a baseline this is a list of numbers, and a list of numbers is text.
The work removed is *remembering what counts as normal* while scanning:

```ts
items: [
  { id: "p95", label: "p95 latency", value: 412, unit: "ms", reference: 300 },
  { id: "p99", label: "p99 latency", value: 980, unit: "ms", reference: 800 },
]
```

If every item shares one baseline and one unit, `scale: "shared"` lets the
reader compare items to each other as well as to the reference. The moment
units differ, a shared scale is a lie about magnitude — use `per-item`, which
is also the default.

## When not to use it

"What was the exact p95?" is answered by a labeled number. Do not chart a
scalar. This pattern earns its place when the reader must scan several values
and judge each against something — that judgement is the work being moved out
of their head.

A large tile reading **BUILD PASSED** removes nothing the sentence "Build
passed" already did. That is a status genre, not this pattern.

## Call

```ts
arrange.valueAgainstReference({
  question: "Which endpoints are over budget?",
  workRemoved: "Remembering each latency budget while scanning current values",
  evidence: "derived",
  items: [
    { id: "search", label: "/search", value: 412, unit: "ms", reference: 300 },
    { id: "cart", label: "/cart", value: 180, unit: "ms", reference: 300 },
  ],
  frame: { units: "ms", scale: "shared" },
  source: "p95 over 24h, prod",
});
```

Portable equivalent, for the JSON door:

```bash
superimg check budget.json
superimg export budget.json --for 1080x1080.png
```
