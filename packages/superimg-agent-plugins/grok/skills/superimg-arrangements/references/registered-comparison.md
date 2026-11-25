# Registered comparison

```text
PATTERN
Registered comparison

HUMAN QUESTION
What differs between these corresponding states?

REQUIRED INFORMATION
States, correspondence, comparison basis, provenance

PERCEPTUAL ARRANGEMENT
A shared frame with differences available for inspection

INVARIANTS
Comparable units or viewing conditions
Stable identity across states
Explicit labels for any normalization or mismatch
No unexplained change to the reference frame

ADAPTATIONS
Stacked or side-by-side
Whole object or matched detail
Static comparison or controlled transition

FAILURE CONDITIONS
The states cannot be meaningfully aligned
Independent scale unless listed as a mismatch
The relevant difference disappears at delivery size
The presentation suggests an unsupported comparison
```

The question is not "where do the two panels go?"

**What must remain constant for the difference to mean what we say it means?**

Two equally sized panels can still mislead: independent axes, different zoom,
mismatched sampling windows.

`sideBySide(a, b)` is not this pattern.

```ts
arrange.registeredComparison({
  question: "What differs in the checkout header?",
  workRemoved: "Matching corresponding elements and remembering the reference",
  evidence: "observation",
  states: [
    { id: "before", label: "Before", view: { src: "a.png" }, provenance: "1440×900 14:02" },
    { id: "after", label: "After", view: { src: "b.png" }, provenance: "1440×900 14:02" },
  ],
  frame: {
    scale: "shared",
    viewport: { width: 1440, height: 900 },
    crop: "header",
  },
  correspondence: ["logo", "nav", "cta"],
  source: "paired captures 2026-09-01",
});
```

Bars vs lines assert different relationships (discrete comparison vs trend).
The stable frame is part of the meaning.
