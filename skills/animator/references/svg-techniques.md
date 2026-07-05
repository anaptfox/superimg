# SVG Techniques — draw-on, morphing, reveals, and hand-drawn craft

Deep reference for `skills/animator/SKILL.md`. Sources: Sarah Drasner's SVG
animation work, Codrops filter tutorials, squigglevision practice. In the
SuperImg frame model every technique is "compute attribute values from
progress" — no CSS keyframes, which sidesteps most browser-compat pitfalls.

## Draw-on (stroke line drawing)

The signature hand-drawn-diagram move. `std.svg.draw` does the dash math:

```typescript
const draw = std.svg.draw(d, progress, { easing: "easeOutCubic" });
return `<path d="${d}" fill="none" stroke="#2b2b2b" stroke-width="3"
  stroke-linecap="round" stroke-linejoin="round"
  stroke-dasharray="${draw.strokeDasharray}"
  stroke-dashoffset="${draw.strokeDashoffset}" />`;
```

- **Easing choice sets the character**: `easeOutCubic`/`easeInOutCubic` =
  a hand drawing; `linear` = a plotter/machine (right for technical
  diagrams, wrong for whimsy).
- Multi-path illustrations: drive each path with `std.stagger` so strokes
  draw in a deliberate order — structure first (frame, ground), then
  subject, then details. Drawing order is narrative.
- Stroke style for hand-drawn feel: `stroke-linecap="round"`,
  `stroke-linejoin="round"`, 2–4px weight variety across paths (heavier =
  structural, lighter = detail).
- Fills come *after* strokes: fade `fill-opacity` in during the last 25% of
  each path's draw progress, or in a separate detail phase. Ink first, then
  wash.
- Draw speed should feel constant per unit length: give long paths
  proportionally more of the stagger window, or split them.

## Path morphing

```typescript
const d = std.svg.morph(pathA, pathB, progress); // then feed to <path d>
```

- Native interpolation requires **matched command counts and types** in both
  paths. Design source/target with the same number of points (add redundant
  points to the simpler path).
- Morph only between **visually related** shapes (circle → blob, play →
  pause). Unrelated shapes should crossfade or scale-swap — a garbled
  mid-morph frame is worse than no morph.
- Ease morphs with `easeInOutCubic`; morphs are on-screen repositioning of
  every point simultaneously.
- Check the midpoint frame explicitly (`--format html --frame N`) — that's
  where bad morphs fall apart.

## Mask & clip reveals

- `std.reveal.clip.{circle, wipe, inset, iris}` return `clip-path` strings —
  apply to any HTML/SVG container for wipes and iris reveals.
- Hand-rolled SVG: animate a `<clipPath>` rect's width/x or a circle's `r`.
- **Masks beat clips for polish**: masks are grayscale and can be
  gradient-feathered (soft edge); clips are always hard-edged.
- Text line reveal ("rising from behind a shelf"): clip each line with a
  rect; translate the text up from below the clip edge with `easeOutCubic`.
  Stagger lines 80–150ms.

## Transform-origin (the #1 SVG gotcha)

SVG transforms rotate/scale about the **canvas origin (0,0)**, not the
element's center. The robust fix works in every renderer:

```
transform="translate(cx, cy) rotate(angle) translate(-cx, -cy)"
   — or —
transform="rotate(angle, cx, cy)"     <!-- rotate's 3-arg form -->
```

- You're generating the markup — compute `cx, cy` from your own geometry.
- Nested groups compound: give each `<g>` one transform responsibility
  (outer translates, inner rotates). Debugging compound transforms in one
  attribute is misery.
- CSS `transform-origin` on SVG needs `transform-box: fill-box` and is less
  portable across rasterizers — prefer the explicit translate sandwich.

## Filters

Filters cost GPU time in a live browser but are effectively **free in offline
rendering** — use them deliberately.

- Always expand the filter region so effects don't clip:
  `<filter x="-20%" y="-20%" width="140%" height="140%">`.
- **Glow / soft shadow**: `feDropShadow` (simple) or
  `feGaussianBlur` + `feMerge` (layered glow).
- **Organic wobble / hand-drawn line jitter**:

```xml
<filter id="wobble" x="-20%" y="-20%" width="140%" height="140%">
  <feTurbulence type="fractalNoise" baseFrequency="0.02" numOctaves="2" seed="${seed}"/>
  <feDisplacementMap in="SourceGraphic" scale="4"/>
</filter>
```

- **Boiling lines** (squigglevision): change `seed` every **2–4 frames, not
  every frame** — `const seed = Math.floor(timeline.frame / 3);`. Per-frame
  jitter reads as electrical noise; a held 2–3-frame cycle (~8–12 changes/s)
  reads as hand-drawn boil.
- **Fake motion blur** for fast moves (offline rendering has none): a brief
  `feGaussianBlur` with `stdDeviation` only along the motion axis
  (`stdDeviation="8 0"` for horizontal), or 2–3 ghost copies at 20–40%
  opacity trailing the element.

## Hand-drawn / sketch aesthetic

Three ingredients, in order of impact:

1. **Rough geometry** — draw shapes with slight irregularity: jittered
   points, slightly-off parallels, rotRect helpers with 1–3° tilts,
   double-stroked lines offset by 1–2px. Perfect geometry kills the look
   before any filter can save it.
2. **Boiling lines** — the turbulence filter above with a 2–4 frame seed
   cycle.
3. **Draw-on entrances** with easeOut and visible stroke caps.

Palette conventions that sell it: off-black ink (`#2b2b2b`) on off-white
paper, light gray fills (`#e2e2e4`), one or two accent colors saved for the
payoff element.

## Text animation patterns

- **Word/char stagger** (the workhorse): split into `<tspan>`/spans, each
  translate-up 12–24px + fade, `easeOutCubic`, 80–150ms/word or 20–40ms/char.
- **Stroke-then-fill display text**: render text as outlined paths (or with
  `stroke` + transparent fill), draw on the stroke, then fade `fill-opacity`
  in over the final third.
- **Clip-rect line reveals**: see mask section — one entrance per thought.
- **Counters**: ease the value with `d.tween`, `Math.round` it, and render
  with `font-variant-numeric: tabular-nums` (or monospace digits) so width
  doesn't jitter. Land on the exact final value at phase end.
- **Highlight draw-on**: an underline or marker-highlight rect that draws
  behind a key word (scaleX 0→1, `transform-origin` at the reading-direction
  start) *after* the word settles — 150–250ms.
- Text on a path: `std.svg.textPath`; measure/wrap with
  `std.svg.measureText` / `wrapText` / `fitText` instead of guessing.

## SVG-specific checklist

- [ ] All rotate/scale transforms use explicit centers
- [ ] Filter regions expanded; nothing clips at the frame edge
- [ ] Draw-on order tells a story (structure → subject → detail)
- [ ] Fills arrive after strokes, not with them
- [ ] Morph midpoint frame inspected and clean
- [ ] Boil/jitter cycles held 2–4 frames, not per-frame
- [ ] `viewBox` proportional to output aspect; no non-uniform scaling of
      stroke widths (use `vector-effect="non-scaling-stroke"` if scaling a group)
- [ ] Text measured with `std.svg.measureText`/`fitText`, not eyeballed —
      overflow past a sign/panel edge is the most common SVG text bug
