# npm-stats — registry history as a product film

A 6.8 s film of one package's download history. One line, one travelling
reader, one zero rule. The sample observations are the ones provided in the
template; the film adds no claims beyond them (the period total and
observation count are data fields and `points.length`).

## Visual system

Shares the "one grid" palette with `examples/data/chart-primitives`: stage
`#0C0D10`, ink `#F2F2EF`, graphite `#8A8F9C`, hairline `#26282E`. The
data-driven `accentColor` paints only the line, the head pin and a 56 px rule.
It never paints body text, so any accent keeps text contrast on the dark stage.
Travelling readings are labelled interpolated; the final datum is labelled observed.

JetBrains Mono for the package name, range and captions; Inter for the reading,
labels and period total. Landscape: package 120 px, reading 176 px, ticks 22 px.
Square: package 96 px, reading 224 px, ticks 18 px.

## Beats (30 fps, 204 frames)

| Phase | Time | Focal action |
|---|---|---|
| head | 0.0–0.7 s | Zero rule draws; eyebrow, name, description and chart title settle on 60 ms offsets |
| draw | 0.7–4.1 s | Line reveals; the reading, caption, pin and guide lines follow the head of the path |
| peak | 4.1–5.1 s | Period total and observation count fade in |
| hold | 5.1–6.8 s | Nothing moves |

## Layouts

- Landscape: copy column (left 600 px) and graph column (right 1032 px), bottom
  row for the period total. Any landscape stage centres a 1920×1080 block.
- Square: reading above caption above graph, period total at the foot. Portrait
  stages centre the same 1080 block.
- Empty data renders the package name and "No download observations".

## Frames to capture for critique

- `--at 0.4s` intro: zero rule drawing, copy entering, no line yet.
- `--at 2.5s` mid draw: reading and pin at the head of the line, guides visible.
- `--at 4.2s` line hold: line complete, `20M` reading, caption `observed Jun 2024`.
- `--at 4.6s` transition: period total fading in, nothing else moving.
- `--at 6.7s` final: full composition, 106.2M period total, 6 observations.

```bash
just cli check examples/developer/npm-stats/npm-stats.media.ts --pretty
just cli export examples/developer/npm-stats/npm-stats.media.ts --for youtube --for instagram-square
```
