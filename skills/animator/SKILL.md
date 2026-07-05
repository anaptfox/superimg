---
name: animator
description: >
  Animation design craft for SuperImg video templates — timing, easing,
  staggering, scene framing, pacing, and SVG motion techniques. Use when
  designing or critiquing motion in *.media.ts templates, choosing durations
  or easing curves, choreographing scenes, or when an animation "feels off",
  stiff, robotic, or cluttered. Complements the superimg skill (API mechanics)
  with motion design judgment.
---

# Animator Skill

How to make SuperImg animations feel professional. The `superimg` skill teaches
the API; this skill teaches the judgment. All rules assume the frame model:
`render(ctx)` is a pure function of time, rendered offline to MP4/GIF.

## Mental Model

**Motion is hierarchy.** Whatever moves is what you're telling the viewer to
look at — a small moving thing beats a large static one. So:

- **One focal element per beat.** If two things demand attention at once, the
  scene fails. Offset everything secondary by 50–150ms and make its motion
  smaller and quieter.
- **Every scene is establish → develop → resolve**, which maps directly onto
  `ctx.director({ enter, hold, exit })`:
  - *Establish* (~15–25%): staged, staggered entrances teach the layout.
  - *Develop* (~50–70%): held composition doing its job — text gets read,
    the chart animates its point. Ambient motion only.
  - *Resolve* (~15–20%): designed exits, faster than the entrances.
- **Stillness is a tool.** If everything moves always, nothing feels fast.
  Budget: motion ≤ ⅓ of any scene's runtime; the rest is held composition.

## Timing

| Motion | Duration |
|---|---|
| Micro feedback (opacity flick, small icon) | 100–200ms |
| Standard element enter (card, text block, shape) | 200–400ms |
| Element exit | **~25% shorter than its enter** |
| Large/full-frame move, hero reveal, scene transition | 400–700ms |
| Expressive emphasis (logo reveal, count-up) | 500–1000ms |
| Any single continuous move > 1s | almost always wrong — split or hold |

- Duration is perceived **weight**: big/heavy elements move slower, small/light
  ones snap. Never give every element the same 300ms.
- Duration scales with distance/size **sub-linearly**: 2× the travel ≈ 1.3× the
  time, so perceived speed stays consistent.
- These are UI-derived floors. Passive video can run emphasis moments 1.5–2×
  longer — but keep functional moves (reposition, swap) in the ranges above.
- Pacing: something visually meaningful should change every **3–5s**. Scenes
  run 3–8s (social beats 1.5–4s) and should **vary** — uniform pacing is
  monotonous.

## Easing

| Situation | Curve |
|---|---|
| Enter / appear (~70% of all moves) | `easeOutCubic` (default), `easeOutExpo`/`easeOutQuint` for punch |
| Exit / disappear | `easeInCubic` — **never easeOut an exit** (it lags on its way out) |
| Reposition while fully visible | `easeInOutCubic` / `easeInOutQuart` |
| Continuous loops, rotation, marquees, progress fills | `linear` (only here) |
| Playful entrance pop | `easeOutBack` or `spring` — entrances only, overshoot ≤ 5–10% |

- `director.motion()` already defaults to `easeOutCubic` enter / `easeInCubic`
  exit — trust it unless you have a reason.
- Tone dial: calm/premium → symmetric `easeInOut*`, zero bounce.
  Playful/social → `easeOutBack`, `spring(stiffness, damping)`, snappier curves.
- An element should never hit its final state at max velocity — the last
  10–20% of any move is deceleration tail (or a micro-overshoot that settles).

## Stagger

```typescript
std.stagger(items, d.in("enter"), { each: 0.08, from: "start", easing: "easeOutCubic" });
// each/duration are fractions (0–1) of the driving progress, mutually exclusive
```

- **30–80ms between siblings**; ~100ms between distinct groups.
  <20ms reads as simultaneous; >150ms reads as separate events.
- **Cap total stagger ≤ ~500ms** no matter the item count — shrink `each` or
  stagger by row/cluster instead of by item.
- Each item's own animation must be **longer than the stagger interval**
  (e.g. 400ms items, 50ms gaps) so entrances overlap and flow.
- `from:` direction points the eye: `"start"` follows reading order,
  `"center"` pulls focus to the middle. Aim the cascade at the focal element.
- Text: per-word 80–150ms, per-char 20–40ms (cap totals). Words = readable;
  chars = frenetic/expressive; lines = one entrance per thought.

## Framing

- **Safe areas:** all action inside the central 90%, all text inside the
  central 80%. For 9:16 social, also avoid the top ~12% (username UI),
  bottom ~18% (captions), right ~14% (engagement buttons) — design a centered
  vertical column. `std.layers` content accepts `safe: "broadcast"`.
- **Negative space is load-bearing:** a good frame is 40–60% empty. Empty
  space is where the eye rests and where the next element enters.
- Rule of thirds for multi-element scenes; dead-center is correct for single
  hero moments and most 9:16 content.
- **Text readability floor:** `max(0.8s, wordCount ÷ 3 seconds)` fully
  *settled* on screen — entrance/exit time does not count. ≤ 10 words per
  text beat; more → split into beats. Bold sans-serifs survive motion;
  thin/script faces don't.

## Frame-Rendering Gotchas

Offline frame rendering has **zero motion blur** — fast motion strobes.

- Keep element velocity under ~⅓ frame-width per frame at 30fps. Faster:
  ease harder, slow down, or fake blur (brief motion-axis `feGaussianBlur`,
  ghost trails at reduced opacity).
- Avoid ~1px/frame crawls — sub-pixel snapping shimmers. Move faster or hold.
- SVG transforms rotate about the canvas origin, not the element. Use
  `transform="translate(cx,cy) rotate(a) translate(-cx,-cy)"` or
  `rotate(a, cx, cy)`.
- Expand SVG filter regions (`x="-20%" y="-20%" width="140%" height="140%"`)
  so blurs/displacement don't clip. Filters are expensive-in-browser but free
  offline — use them.
- Idle/continuous motion (`std.oscillate`, `wiggle`, rotation) runs off
  `timeline.seconds`; phased entrance/exit runs off `director`. Don't mix the
  clocks in one property.

## Critique Checklist

Run this before calling any animation done:

- [ ] One focal element per moment; secondary motion smaller, quieter, offset
- [ ] Zero `linear` on positional moves; enters ease out, exits ease in & faster
- [ ] Durations 150–500ms scaled to size/distance; nothing continuous > 1s
- [ ] Group entrances staggered 30–80ms, total ≤ 500ms, aimed at the focal point
- [ ] Every element has a **designed exit** (not a pop-out, not lingering clutter)
- [ ] Holds exist: after a composition settles, ≥ 1s of stillness before the next beat
- [ ] Text: settled ≥ max(0.8s, words÷3 s), ≤ 10 words/beat, inside title-safe
- [ ] Something changes every 3–5s; scene lengths varied
- [ ] Fast moves checked for strobing; slow crawls checked for shimmer
- [ ] SVG rotate/scale use explicit centers
- [ ] Overshoot/anticipation only where tone allows; ≤ 10%, entrances only
- [ ] Beats land on an implicit tempo (e.g. 500ms grid); transitions carry
      momentum through the cut (exit velocity ≈ next scene's entry velocity)

## Workflow

Iterate cheaply before rendering video:

```bash
superimg render <name> --format html --frame 45   # instant HTML snapshot, no browser
superimg render <name> --format png --frame 45    # single-frame still
superimg dev <name>                                # live preview player
superimg render <name>                             # final MP4
```

Check at minimum: first frame, one mid-entrance frame (is the easing visible?),
the settled hold frame (is the composition right?), one mid-exit frame, and
the final frame. For rendered MP4s, extract spot frames with ffmpeg and look
at them.

## References

- **[references/motion-craft.md](references/motion-craft.md)** — Disney
  principles applied, full easing/spring guide, anticipation & overshoot
  recipes, stagger deep-dive
- **[references/scene-framing.md](references/scene-framing.md)** — composition,
  focal hierarchy, phase recipes, scene transitions and momentum
- **[references/svg-techniques.md](references/svg-techniques.md)** — draw-on,
  morphing, mask reveals, hand-drawn aesthetics, text animation patterns
- **`skills/superimg/SKILL.md`** — API mechanics (director, layers, stagger,
  reveal, viz); read it first if you don't know the framework
- Live demonstrations: `examples/vector/` (`svg-draw`, `svg-morph`,
  `pelican-bicycle`, `wow-demo`, `perfect-vs-good-enough`), `examples/basics/`
  (`layer-shots`, `score-clips`), indexed in `examples/_templates.json`
