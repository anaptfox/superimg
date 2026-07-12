# Scene Framing — composition, pacing, and transitions

Deep reference for `skills/animator/SKILL.md`. Sources: broadcast title-safe
standards, social platform safe zones, School of Motion transitions, pacing
practice from explainer/editing craft, subtitle reading-speed standards.

## Composition

### Safe areas (as numbers)

For a `width × height` frame:

| Zone | Bounds |
|---|---|
| Action safe (all meaningful graphics) | central 90% — inset `5%` per side |
| Title safe (all text) | central 80% — inset `10%` per side |

For 9:16 social (TikTok / Reels / Shorts), additionally dead zones:

| Platform UI | Avoid |
|---|---|
| Username / top chrome | top ~12% |
| Captions / sound / progress | bottom ~18% |
| Engagement buttons | right ~14% |

Net effect: design 9:16 content as a centered vertical column roughly
`x ∈ [8%, 84%]`, `y ∈ [14%, 80%]`. With `std.layers`, pass
`safe: "broadcast"` on content layers; for flat HTML compute insets from
`width`/`height` (`ctx.isPortrait` tells you which regime you're in).

### Focal hierarchy

- **One primary element per moment** — largest, highest contrast, or moving.
  Everything else visually quieter (smaller, desaturated, static).
- Motion outranks size and color in the attention hierarchy. A 20px moving
  dot beats a full-bleed static image. Assign motion only to what you're
  currently "saying".
- **Negative space is load-bearing**: 40–60% of a good motion-graphics frame
  is empty. It's where the eye rests and where the next element enters from.
- Rule of thirds: put focal elements on third-lines/intersections for
  multi-element scenes. Dead-center is correct for single-subject hero
  moments and most 9:16 content.
- Depth in 2D: overlap, scale contrast, blur/atmospheric fade, and parallax
  (background drifts at 20–40% of foreground speed) — pick one or two, not
  all four.

## Scene structure: establish → develop → resolve

Every scene, regardless of length:

```typescript
const t = ctx.director({ enter: "20%", hold: "62%", exit: "18%" });
```

1. **Establish (15–25%)** — staged, staggered entrances teach the layout.
   Background/frame first, then focal element, then supports. The viewer
   should know where to look before the content starts working.
2. **Develop (50–70%)** — the scene does its job. Held composition; text is
   read; the diagram animates its point; values count up. Ambient motion only
   (2–5px oscillation, slow drift). This is where amateurs over-animate —
   resist.
3. **Resolve (15–20%)** — designed exits, ~25% faster than entrances, usually
   reversing entrance direction or exiting *toward* the next scene's entrance
   direction.

For absolute-time control use seconds phases (`{ enter: "0.8s", ... }`);
percentages keep the shape stable when duration changes.

### Nested beats

A scene with multiple internal beats uses `director.clip`:

```typescript
const t = ctx.director({ setup: "2s", payoff: "3s", outro: "1s" });
const setup = t.clip({ during: "setup" });
if (setup.active) {
  const local = setup.director({ enter: "25%", hold: "60%", exit: "15%" });
  // each beat gets its own establish/develop/resolve
}
```

## Pacing heuristics

- **The 3-second rule:** something visually meaningful changes every 3–5s —
  a new element, a state change, a cut. Not necessarily a new scene.
- Typical explainer scene: **3–8s**. Social/short-form beat: **1.5–4s**.
- A static frame with nothing changing loses attention after ~4s.
- **Vary scene lengths.** Alternate quick punchy beats with slower
  informative ones. Uniform pacing is monotonous; fast sections make slow
  sections feel deliberate, and vice versa.
- **Text sets the floor:** a scene can't be shorter than its text's reading
  time — `max(0.8s, words ÷ 3 s)` *settled*, entrance/exit excluded, plus
  ≥ 0.5s after the last text settles before it exits.
- Motion budget: moving pixels ≤ ⅓ of scene runtime. Holds make hits land.

## Transitions between scenes

The six motion-graphics staples, mapped to SuperImg:

| Transition | When | SuperImg |
|---|---|---|
| **Hard cut** | topic change; the default — underrated | adjacent scenes in `compose()`, no transition |
| **Wipe / push** | continuation; content sweeps frame | `std.reveal.wipe` / `curtain` / `split` on `L.fx()`, or `compose()` `slide-*` enters |
| **Zoom-through** | diving into detail | scale the outgoing scene's focal element past frame; next scene starts wide |
| **Morph** | strongest connective tissue; A's shape becomes B's element | `std.svg.morph` across a handoff, or matched shapes + `L.handoff()` |
| **Match cut** | rhyme between scenes | outgoing and incoming elements share position/size/motion across the cut |
| **Element hand-off** | one element persists, world swaps | `std.reveal.handoffLocal` / `L.handoff()` |

Rules:

- Transition duration **300–600ms**. Longer reads as indulgent.
- **Carry momentum through the cut**: scene A's exit velocity and direction ≈
  scene B's entry velocity and direction. An exit sliding left should be met
  by an entrance arriving from the right, at similar speed.
- Pick **1–2 transition styles per video** and keep direction consistent
  (all pushes leftward, say). Variety here reads as chaos, not creativity.
- The transition should express the *relationship*: continuation → push/morph;
  new topic → hard cut or wipe; cause/effect → zoom-through.
- In `compose()`, per-scene `enter`/`exit` accept
  `{ type: "fade" | "slide-left" | "slide-right" | "slide-up" | "slide-down" | "none", duration, easing }`.

## Aspect-ratio strategy

One template can serve multiple formats — branch on context:

```typescript
const r = std.createResponsive(ctx);
const fontSize = r({ portrait: 72, default: 56 });
if (ctx.isPortrait) { /* stacked column layout, tighter safe area */ }
```

- 16:9 — horizontal arrangements, thirds-based composition, room for
  side-by-side comparisons.
- 9:16 — vertical stacking, centered column, bigger type (viewers are
  closer to phone screens), respect platform dead zones.
- 1:1 — centered radial compositions work best.
- Declare `config.outputs` presets rather than duplicating templates.

## Color & contrast in motion

- Moving elements need **more** contrast than static ones to stay legible —
  check text contrast at every point of its travel, not just its endpoint.
- Avoid saturated complementary pairs sliding past each other (vibration).
- No full-frame flashes; keep any flicker under 3 flashes/second
  (photosensitivity).
- Dark backgrounds flatter easing subtleties; on white, motion needs slightly
  longer durations to read.
