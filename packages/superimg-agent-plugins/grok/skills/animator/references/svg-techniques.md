# SVG Techniques — draw-on, morphing, reveals, and hand-drawn craft

Deep reference for `skills/animator/SKILL.md`. Sources: Sarah Drasner's SVG
animation work, Codrops filter tutorials, squigglevision practice. In the
SuperImg frame model every technique is "compute attribute values from
progress" — no CSS keyframes, which sidesteps most browser-compat pitfalls.

## Draw-on (stroke line drawing)

The signature hand-drawn-diagram move. `std.svg.draw` does the dash math:

```typescript
const draw = std.svg.draw(d, progress, { easing: "easeOutCubic" });
return Vector(
  { width, height, viewBox: { x: 0, y: 0, width, height } },
  vector.path({
    d,
    fill: "none",
    stroke: "#2b2b2b",
    strokeWidth: 3,
    strokeLinecap: "round",
    strokeLinejoin: "round",
    strokeDasharray: draw.strokeDasharray,
    strokeDashoffset: draw.strokeDashoffset,
  }),
);
```

- **Easing choice sets the character**: `easeOutCubic`/`easeInOutCubic` =
  a hand drawing; `linear` = a plotter/machine (right for technical
  diagrams, wrong for whimsy).
- Multi-path illustrations: drive each path with `std.stagger` so strokes
  draw in a deliberate order — structure first (frame, ground), then
  subject, then details. Drawing order is narrative.
- Stroke style for hand-drawn feel: `strokeLinecap: "round"`,
  `strokeLinejoin: "round"`, 2–4px weight variety across paths (heavier =
  structural, lighter = detail).
- Fills come *after* strokes: fade `fill-opacity` in during the last 25% of
  each path's draw progress, or in a separate detail phase. Ink first, then
  wash.
- Draw speed should feel constant per unit length: give long paths
  proportionally more of the stagger window, or split them.

## Path morphing

```typescript
const d = std.svg.morph(pathA, pathB, progress);
const shape = vector.path({ id: "morphing-shape", d, fill: ink });
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

- `std.reveal.clip.{circle, wipe, inset, iris}` return `clip-path` strings for
  layout nodes.
- Semantic vector clips use an explicit stable id: put path geometry inside
  `vector.clip({ id: "line-reveal" }, ...)`, then set
  `clip: "line-reveal"` on the target `vector.group()`.
- **Masks beat clips for polish**: masks are grayscale and can be
  feathered (soft edge); clips are always hard-edged. Use
  `vector.mask({ id: "soft-reveal", mode: "luminance" }, ...)` and refer to
  the id from a group.
- Text line reveal ("rising from behind a shelf"): clip each line with a
  rect; translate the text up from below the clip edge with `easeOutCubic`.
  Stagger lines 80–150ms.

## Transform-origin (the #1 SVG gotcha)

Vector transforms rotate/scale about the **canvas origin (0,0)**, not the
element's center. Give `vector.group()` an explicit transform with a centre:

```
transform="translate(cx, cy) rotate(angle) translate(-cx, -cy)"
   — or —
transform="rotate(angle, cx, cy)"     <!-- rotate's 3-arg form -->
```

- Compute `cx, cy` from authored geometry; inspect reports the transformed bounds.
- Nested groups compound: give each `vector.group()` one transform responsibility
  (outer translates, inner rotates). Debugging compound transforms in one
  attribute is misery.
- CSS `transform-origin` on SVG needs `transform-box: fill-box` and is less
  portable across rasterizers — prefer the explicit translate sandwich.

## Filters

The semantic vector tree does not yet model arbitrary SVG filter graphs. Keep
core art inspectable and prefer compositional substitutes: duplicate a path at
low opacity for a glow, layer offset copies for a shadow, or use deterministic
geometry jitter for an organic line. If a third-party filter is essential,
isolate that whole region in one explicitly sized `Html()` node so inspection
reports the opaque boundary.

- **Boiling lines** (squigglevision): change the geometry seed every **2–4 frames, not
  every frame** — `const seed = Math.floor(timeline.frame / 3);`. Per-frame
  jitter reads as electrical noise; a held 2–3-frame cycle (~8–12 changes/s)
  reads as hand-drawn boil.
- **Fake motion blur** for fast moves (offline rendering has none): use 2–3
  trailing `vector.group()` copies at 20–40% opacity.

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

- **Word/char stagger** (the workhorse): split one `vector.text()` into
  `vector.run()` children, each
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
- [ ] Opaque filter regions are boxed and justified; semantic geometry stays outside them
- [ ] Draw-on order tells a story (structure → subject → detail)
- [ ] Fills arrive after strokes, not with them
- [ ] Morph midpoint frame inspected and clean
- [ ] Boil/jitter cycles held 2–4 frames, not per-frame
- [ ] `viewBox` proportional to output aspect; no non-uniform scaling of
      stroke widths (use `vector-effect="non-scaling-stroke"` if scaling a group)
- [ ] Text measured with `std.svg.measureText`/`fitText`, not eyeballed —
      overflow past a sign/panel edge is the most common SVG text bug
