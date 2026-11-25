# Aligned intervals

```text
PATTERN
Aligned intervals

HUMAN QUESTION
Do these records overlap, precede, or run concurrently?

REQUIRED INFORMATION
Tracks of intervals, shared time reference, explicit gaps or timing uncertainty

PERCEPTUAL ARRANGEMENT
One time axis; tracks registered to it

INVARIANTS
Shared unit and origin
Finite start and end; end is not before start
A real duration to align (not a single instant)
Uncertain timing is marked, not guessed

ADAPTATIONS
Stacked tracks (default)
hold / predict / reveal motion (`revealIds` + tick|empty|ghost)

FAILURE CONDITIONS
Each record on its own clock
Gaps look like missing data when they are unknown
A sequence of cards with a timeline that does not share a clock
Predict without revealIds, or predict that inks the full answer extent
```

Motion is on the spec, not a rebuilt track list per beat:

```ts
motion: { phase: "predict", predict: "tick", revealIds: ["west"] }
```

`hold` omits answer tracks. `predict` shows them as a start tick (or empty/?). `ghost` is a faint tick, never a full-extent wash. `reveal` inks the extent. Cortex event-story uses this.

This is not "a sequence." A sequence says A, B, C occurred in some order.
Aligned intervals let the reader stop doing interval bookkeeping.

A mechanism explanation is a different pattern — see
[mechanism-strip.md](mechanism-strip.md). It shows how parts connect and on
whose evidence each step rests. Do not fake that with this pattern: two tracks
on one clock is co-occurrence, never causation.

```ts
arrange.alignedIntervals({
  question: "Do these deploys overlap?",
  workRemoved: "Computing overlap, order, and concurrency across separate records",
  evidence: "derived",
  timeRef: { unit: "s", origin: 0, originLabel: "kickoff" },
  tracks: [
    { id: "east", label: "us-east", intervals: [{ start: 0, end: 40 }] },
    { id: "west", label: "us-west", intervals: [{ start: 20, end: 70, uncertain: true }] },
  ],
  source: "deploy log 2026-09-01",
});
```
