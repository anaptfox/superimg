# Motion Design & Visual Review Reference

Essential timing, easing, stagger, framing, and review rules for authoring and verifying `*.media.ts` programs.

## Mental Model & Narrative Structure

**Motion is hierarchy.** Whatever moves commands the eye — a small moving subject beats a large static one.

- **One focal element per beat.** Offset secondary elements by `50–150ms` with smaller travel and quieter opacity/scale changes.
- **Establish → Develop → Resolve:**
  - *Establish* (~15–25%): staged, staggered entrances teach the layout.
  - *Develop* (~50–70%): held composition doing its job — text gets read, charts/characters act out their point.
  - *Resolve* (~15–20%): designed exits, ~25% faster than entrances.
- **Stillness is a tool.** For text/card explainers, budget motion around ⅓ of the beat and hold the rest for reading. Camera travel, character performance, and procedural demonstrations may move continuously when motion is the subject.

## Timing Table

| Motion | Duration |
|--------|----------|
| Micro feedback (opacity flick, small icon, blink) | `100–200ms` |
| Standard element enter (card, text block, badge, shape) | `200–400ms` |
| Element exit | **~25% shorter than its enter** |
| Large/full-frame move, hero reveal, scene transition | `400–700ms` |
| Expressive emphasis (logo draw-on, count-up) | `500–1000ms` |
| Camera travel / character act / process demonstration | Follows demonstrated action; preserve readability |

- Duration reflects perceived **weight**: large containers move slower; small badges snap.
- Scale duration **sub-linearly** with distance (`2×` travel ≈ `1.3×` time).
- Something visually meaningful should change every **3–5s**. Vary beat durations (`3–8s` standard, `1.5–4s` social) so pacing never feels mechanical.

## Easing Table

| Situation | Curve |
|-----------|-------|
| Enter / appear (~70% of moves) | `easeOutCubic` (`"outCubic"`, default), `easeOutExpo` / `easeOutQuint` for punch |
| Exit / disappear | `easeInCubic` (`"inCubic"`) — **never easeOut an exit** (lags on the way out) |
| Reposition / morph while visible | `easeInOutCubic` (`"inOutCubic"`) / `easeInOutQuart` |
| Continuous loops, rotation, marquees, progress fills | `linear` (only here) |
| Playful entrance pop | `easeOutBack` (`"outBack"`) or named spring (`"gentle"`, `"snappy"`, `"fluid"`, `"playful"`, `"wobbly"`) — entrances only, overshoot ≤ 5–10% |

## Stagger Rules

```ts
import { stagger } from "@foxworth/superimg/stdlib";

// Millisecond gaps + automatic 500ms cascade cap (preferred)
stagger.ms(items, d.in("enter"), {
  windowSeconds: 1.5,
  eachMs: 50,
  capMs: 500,
  from: "start",
});

// Fractional window API (default easing: easeOutCubic)
stagger(items, d.in("enter"), { each: 0.08, from: "start" });
```

- **30–80ms between siblings**; ~100ms between distinct groups (`<20ms` reads as simultaneous; `>150ms` reads as separate events).
- **Cap total stagger ≤ 500ms** regardless of item count.
- Each item's own animation must be **longer than the stagger gap** (e.g., `400ms` move with `50ms` gaps) so entrances overlap smoothly.

## Safe-Area & Framing Rules

- **Safe areas:** Keep all action inside the central 90% and all text inside the central 80% (`Safe({ preset: "broadcast" })` or `getSafeBox(ctx.width, ctx.height, "broadcast")`).
- **9:16 vertical social (`1080x1920`, `tiktok`):** Avoid the top ~12% (username UI), bottom ~18% (captions), and right ~14% (engagement buttons). Use `Safe({ preset: "social-vertical" })` or `getSafeBox(ctx.width, ctx.height, "social-vertical")` to keep copy and focal subjects in the safe vertical column.
- **Text readability floor:** Hold text **fully settled** for at least `max(0.8s, wordCount / 3)` seconds (excluding entrance/exit). Keep beats ≤ 10 words; split longer copy across beats.
- **Frame-rendering physics (zero motion blur):**
  - Keep element velocity under ~⅓ frame-width per frame at 30fps to prevent strobing.
  - Avoid ~1px/frame slow crawls that cause sub-pixel shimmer.
  - Always pass explicit centers to SVG rotations (`rotate(angle, cx, cy)`).
  - Expand SVG filter regions (`x="-20%" y="-20%" width="140%" height="140%"`) so blurs and displacements never clip.

## Zero-FFmpeg Visual Review & Critique Loop

Never shell out to `ffmpeg` or `magick montage` to extract frames or build contact sheets. SuperImg's CLI generates deterministic contact sheets and frame PNGs directly:

1. **Structural & craft check at target size:**
   ```bash
   superimg check foo.media.ts --for 1080x1920 --craft
   ```
   Resolve all layout/contrast/SVG issues (`ZERO_BOX`, `EMPTY_CONTAINER`, `TEXT_OUTSIDE_PARENT`, `FLOW_TEXT_LINE_OVERLAP`, `RAW_SVG_IN_HTML`, `UNPAINTED_STAGE`, `LOW_CONTRAST_TEXT`, `SPARSE_FOCAL`, `MISSING_EDITION`).
2. **Pre-encode visual review (`contact-sheet.png` + frame PNGs):**
   ```bash
   superimg inspect foo.media.ts --for 1080x1920 --at 0.8s,1.9s,6.2s --review
   ```
   If `--at` is omitted, `--review` automatically samples every director act/phase hold (`superimg inspect foo.media.ts --for 1080x1920 --review`). Inspect the generated `contact-sheet.png` and individual frame PNGs in `.superimg/reviews/...`.
3. **Direct file export + post-encode movie review:**
   ```bash
   superimg export foo.media.ts --for 1080x1920 --review -o foo-9x16.mp4
   ```
   Writes `foo-9x16.mp4` directly and decodes the actual MP4 bytes to produce a post-encode `contact-sheet.png` and frame PNGs.

### Final Critique Checklist

- [ ] One focal element per moment; secondary motion smaller, quieter, and offset
- [ ] Entrances ease out (`easeOutCubic`); exits ease in (`easeInCubic`) and run ~25% faster
- [ ] Group entrances staggered `30–80ms`, total cascade ≤ `500ms`
- [ ] Every transient element has a designed exit (no abrupt pop-out or lingering clutter)
- [ ] Settled holds exist (`≥ 1s` of stillness after key compositions settle)
- [ ] Text settles for `≥ max(0.8s, words / 3)` seconds, ≤ 10 words/beat, inside the target safe area
- [ ] Authored with `Vector(...)` + `vector.*` (no raw `<svg>` inside `Html()`) and `@foxworth/superimg/stdlib` helpers (no hand-rolled math/easing/layout utilities)
- [ ] `contact-sheet.png` from `--review` inspected at target resolution before calling work done
