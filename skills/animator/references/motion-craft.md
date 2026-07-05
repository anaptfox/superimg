# Motion Craft — timing, easing, and the animation principles that matter

Deep reference for `skills/animator/SKILL.md`. Sources: Disney's 12 principles
(as applied to motion graphics), Material Design motion, IBM Carbon Motion,
Microsoft Fluent, Val Head, School of Motion.

## The principles that matter for motion graphics

Character-animation principles collapse to a working set of seven for
vector/typographic work, in priority order:

1. **Slow in / slow out (easing).** The single most-felt principle. Nothing
   physical moves linearly; linear positional motion reads as mechanical.
2. **Staging.** Motion's job is to guide the eye to what matters *now*.
   Minimize motion on everything else.
3. **Timing = weight and emotion.** A ball that falls in 2 frames is a
   ping-pong ball; in 20 frames it's a bowling ball. Duration IS perceived
   mass. Decide what each element "weighs" before picking its duration.
4. **Follow-through & overlapping action.** Elements in a group never all
   arrive together. Container leads, contents follow 50–150ms behind, so the
   viewer tracks each element instead of absorbing one blur.
5. **Anticipation.** A small counter-move prepares the main move — a dip
   before a rise, a scale-down before a pop. Keep it at 10–20% of the main
   move's magnitude and duration. Use sparingly; one anticipation per scene
   is usually plenty.
6. **Secondary action.** Subordinate motion that supports the primary — a
   shadow growing as a card lifts, a subtle parallax layer. It must never
   compete for attention.
7. **Exaggeration & arcs.** Push scale/overshoot slightly past "realistic" so
   it reads at a glance. Long visible trajectories should curve, not run
   straight; add a slight rotation that follows the direction of travel.

Squash-and-stretch is for playful/character-flavored content only.

## Duration in depth

- **Exits ~25% faster than enters.** Material's own tokens: drawer opens
  250ms / closes 200ms; card expands 300ms / collapses 250ms. The viewer has
  already processed the element; leaving slowly reads as reluctance.
- **Sub-linear distance scaling** (Carbon): perceived speed should stay
  constant, so double travel distance gets ~1.3× duration, not 2×.
- **Video vs UI:** UI guidance assumes a user waiting on an interaction. In
  passive video you may run *emphasis* moments 1.5–2× longer (a 900ms logo
  settle is fine); functional moves stay at UI speed.
- **Implicit tempo:** professional motion is cut to a beat even when silent.
  Pick a tempo (120bpm → 500ms beat) and quantize scene changes and major
  hits to beat multiples. If a soundtrack exists, land hits on downbeats and
  let motion accents anticipate the beat by 1–2 frames.

## Easing curve selection — the full map

SuperImg ships 30 named curves (`packages/superimg-stdlib/src/easing.ts`)
plus analytic springs. When each earns its place:

| Family | Use |
|---|---|
| `easeOutSine/Quad` | gentle enters; subtle moves that shouldn't draw attention |
| `easeOutCubic` | **the default enter** — natural deceleration, works everywhere |
| `easeOutQuart/Quint/Expo` | punchy hero enters; the harder the curve, the more confident it feels |
| `easeOutCirc` | fast arrival with a long soft tail — good for large panels |
| `easeInCubic` | **the default exit** |
| `easeInQuart/Quint/Expo` | urgent exits, whip-away transitions |
| `easeInOutCubic/Quart` | on-screen repositioning (both endpoints visible) |
| `easeInOutSine` | breathing/ambient loops when paired with `oscillate` |
| `easeOutBack` | friendly pop-in with built-in ~10% overshoot; entrances only |
| `easeInBack` | anticipation built into an exit (element rears back, then leaves) |
| `easeOutElastic` | cartoon wobble-settle; use once per video, if at all |
| `easeOutBounce` | literal dropping objects; almost never right for UI-like content |
| `linear` | rotation loops, marquees, progress fills, particle drift — nothing else |

`director.motion()` auto-mirrors: give it an enter easing and the exit uses
the matching `easeIn*` unless you override `exitEasing`.

### Springs

```typescript
d.motion({ scale: 0.8, easing: { stiffness: 170, damping: 14 } }); // SpringConfig
std.spring(from, to, progress, { stiffness: 100, damping: 10, mass: 1 });
```

- Higher `stiffness` = faster; higher `damping` = less oscillation.
- Gentle settle: `{ stiffness: 120, damping: 18 }` (no visible bounce).
- Playful pop: `{ stiffness: 170, damping: 12 }` (one visible overshoot).
- Wobbly: `damping < 10` — two+ oscillations; expressive, use rarely.
- A spring's "duration" is emergent — verify the settle finishes inside the
  phase window by checking a mid-phase and end-of-phase frame.

### Overshoot rules

- Entrances only. Never overshoot an exit.
- Magnitude ≤ 5–10% of the move (scale to 1.05–1.08, not 1.3).
- Calm/corporate/premium tone → no overshoot at all, symmetric `easeInOut*`.

## Recipes (director API)

**Standard enter/exit** — the defaults are already right:

```typescript
const d = ctx.director({ enter: "0.6s", hold: "3.2s", exit: "0.5s" });
const card = d.motion({ y: 24 });           // easeOutCubic in, easeInCubic out
return `<div style="${card.style}">…</div>`;
```

**Anticipation dip** (rise that dips first):

```typescript
const p = d.in("enter");
const y = std.interpolate(p, [0, 0.2, 1], [0, 6, -40], "easeOutCubic");
// 20% of the window and ~15% of the magnitude go to the counter-move
```

**Overshoot-settle without easeOutBack** (explicit control):

```typescript
const scale = std.interpolate(d.in("enter"), [0, 0.8, 1], [0.9, 1.06, 1], "easeOutCubic");
```

**Follow-through group** (container leads, contents trail):

```typescript
const panel = d.motion({ y: 32, for: "0.5s" });
const title = d.motion({ y: 16, at: "0.12s", for: "0.4s" });
const body  = d.motion({ y: 12, at: "0.22s", for: "0.4s" });
```

**Secondary action** (shadow grows as card lifts):

```typescript
const lift = d.tween(0, 1, { during: "enter", easing: "easeOutCubic" });
const shadow = `0 ${4 + lift * 12}px ${8 + lift * 24}px rgba(0,0,0,${0.1 + lift * 0.15})`;
```

**Ambient hold motion** (development phase breathes but doesn't distract):

```typescript
const bob = std.oscillate(timeline.seconds, { period: "3s", from: -3, to: 3 });
const drift = std.wiggle(timeline.seconds, i, { freq: 0.4, amp: 2 });
// amplitudes of 2–5px at periods of 2–4s; anything bigger competes for attention
```

**Count-up** (ease the value, land exactly, keep digits stable):

```typescript
const n = Math.round(d.tween(0, 1287, { during: "enter", easing: "easeOutQuart" }));
// render with font-variant-numeric: tabular-nums (or a monospace font)
// so the number's width doesn't jitter while counting
```

**Merging motions** — one element affected by two systems:

```typescript
const combined = std.mergeMotion(entrance, wobble); // last-wins per property
```

## Stagger deep-dive

- The math: `total stagger = (n - 1) × each`. For n items and a 500ms cap,
  `each = min(80ms, 500ms / (n - 1))`.
- `duration` vs `each` in `std.stagger` options are mutually exclusive
  fractions of the driving progress — convert your ms budget into a fraction
  of the phase length.
- Overlap requirement: `item duration ≥ 3–5× stagger interval`. 400ms items
  with 50ms gaps cascade beautifully; 100ms items with 100ms gaps fire like
  a machine gun.
- Direction (`from`): `"start"` = reading order (lists, rows), `"center"` =
  focus pulls to the middle (logos, radial layouts), `"edges"` = converging
  frame, `"end"` = reverse emphasis. Point the cascade at the focal element.
- `std.stagger.lead(items, progress)` gives the currently-leading index —
  use it to sync a highlight or camera to the cascade front.
- Large collections (> 12 items): stagger by row/cluster, not per item, or
  the entrance dribbles.

## Weight & settle

An element must never stop dead at max velocity. Every move ends in one of:

1. A deceleration tail (the last 10–20% of the duration, built into every
   `easeOut*` curve — this is why linear fails).
2. A micro-overshoot that settles (`easeOutBack`, spring, or the explicit
   interpolate recipe above).
3. A landing with follow-through — the element stops but something attached
   to it (shadow, contents, hair-line accent) settles a few frames later.
