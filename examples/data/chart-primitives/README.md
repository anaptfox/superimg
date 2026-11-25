# chart-primitives — "One grid. Two graphs."

A 5 s product film for typed charts. A line and signed grouped bars share one
type system, one zero line and one clock. The data is synthetic and every
frame says so in the eyebrow.

## Visual system

| Role | Value |
|---|---|
| Stage | `#0C0D10` |
| Ink | `#F2F2EF` |
| Graphite (labels, Prior, guides) | `#8A8F9C` / `#5C6170` |
| Hairline grid | `#26282E` |
| Accent (Current, line, pin) | `#FF6A3D` |

Inter throughout. Landscape: headline 84 px, reading 168 px, labels 20 px
tracked, ticks 22 px. Square: headline 84 px, reading 136 px, ticks 18 px.
No axis spines or tick stubs; the horizontal grid plus a drawn zero rule carry
the coordinate system.

## Beats (30 fps, 150 frames)

| Phase | Time | Focal action |
|---|---|---|
| open | 0.0–0.5 s | Both zero rules draw left→right; copy settles (premium tone, 60 ms offsets) |
| line | 0.5–1.8 s | Line reveals (easeInOutCubic); pin, drop line and the `58` reading land at 90 % |
| bars | 1.8–2.7 s | Web, CLI, API groups grow from zero on 0 / 120 / 240 ms offsets; the empty Current/API slot gets a hollow marker |
| hold | 2.7–5.0 s | Nothing moves |

## Honesty rules kept

- Each chart draws its zero baseline from `project("y", 0)`; signed bars grow from that baseline.
- The `58` reading and its pin come from the resolved April point.
- The absent Current/API datum is marked at its slot, not invented; the caption
  says "API reports Prior only".

## Frames to capture for critique

- `--at 0.25s` intro: rules half drawn, headline settling, no graph ink yet.
- `--at 1.85s` line hold: line complete, pin visible, reading `58` at full opacity.
- `--at 2.8s` bars hold: all bars rest on the zero rule, negatives hang below it.
- `--at 2.0s` transition: Web growing, API still empty, line unchanged.
- `--at 4.9s` final: identical to the bars hold.

```bash
just cli check examples/data/chart-primitives/chart-primitives.media.ts --pretty
just cli export examples/data/chart-primitives/chart-primitives.media.ts --for youtube --for instagram-square
```
