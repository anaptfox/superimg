# Point with context

```text
PATTERN
Point with context

HUMAN QUESTION
Where is the object we are talking about, in its source?

REQUIRED INFORMATION
Context view, focal detail, correspondence between them, provenance when observed

PERCEPTUAL ARRANGEMENT
A contextual view, a focal detail, and a stable reference from one to the other

INVARIANTS
The reader can inspect the detail and locate its origin
Inset and highlight require a region in context (0–1 fractions)
Context and focus have distinct stable ids
Observations name capture conditions

ADAPTATIONS
inset | highlight | panels

FAILURE CONDITIONS
The crop hides surrounding conditions the claim needs
The annotation covers the evidence
Highlight/inset with no locatable region
```

A full-page screenshot preserves everything and leaves the reader searching.
A tight crop reveals the defect and loses where it happened.

This pattern is not "annotate." Annotation is one implementation.

```ts
arrange.pointWithContext({
  question: "Where is the broken Pay button?",
  workRemoved: "Finding the exact object being discussed",
  evidence: "observation",
  context: { id: "checkout", label: "Checkout", view: { src: "full.png" }, provenance: "1440×900" },
  focus: {
    id: "pay",
    label: "Pay",
    view: { src: "pay.png" },
    provenance: "1440×900 crop",
    region: { x: 0.72, y: 0.81, width: 0.18, height: 0.1 },
  },
  correspondence: "inset",
  source: "checkout.png",
});
```
