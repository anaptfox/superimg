# Cleft

Cleft is a deterministic material identity study built from typed media nodes.
Its fixed two-slab mark carries flat ink, mineral grains, and etched graphite.
Every grain keeps the same id and coordinates; only surface light changes.

`cleft.media.ts` exports the 18-second 4K hero as default and the silent
eight-second pointer example as `live`. `INITIAL_CLEFT` is the gallery input.
Use `Player({ drive: "pointer", hoverBehavior: "none", playbackMode: "once" })`
for `live`; use the separate `cleft-loop.media.ts` for ambient playback.

## Controls and capture

Live presets may seek 1.6 s (revealed), 3.4 s (ink), 4.8 s (mineral), or 6.5 s (graphite).
The `material` input can also override automatic paint. `logicalSeconds:null`
lets the player clock choose the pose. A numeric `logicalSeconds` freezes an
explicit host snapshot. Keep `inputVersion` with the accepted host state.

Suspend pointer drive for sliders, keyboard controls, reduced-motion holds,
and inspection. Freeze data first, await its accepted update, then seek and
await resource readiness before capture. Verify the same presentation revision
afterward. Keyboard controls should offer one-frame arrows, 30-frame page
steps, Home/End, and native labeled preset buttons.

## Fidelity and limits

The logical sampler always contains 8,192 grains. Full draws them all; Reduced
keeps edge grains and alternates only unprotected decorative grains. Both use
the exact canonical contours and clip all facets to them. Observations report
logical and drawn populations separately. 128 stable facet paths keep browser
node count bounded. There is no collision simulation, browser script, or
random draw during render.

The loop uses `frame % 120 / 120`; encoded frames 0–119 approach the next cycle,
and analytic frame 120 matches frame 0. Inclusive scene time must not replace
this discrete loop phase. Encoded video and sound seams still need review.

## Verification

```sh
env npm_config_manage_package_manager_versions=false pnpm exec vitest run examples/showcase/cleft/model.test.ts
just cli check examples/showcase/cleft/cleft.media.ts --craft --json
just cli inspect examples/showcase/cleft/cleft.media.ts --review --review-clips --json
just cli inspect examples/showcase/cleft/cleft.media.ts --at 8.5s --png
just cli export examples/showcase/cleft/cleft.media.ts --for 3840x2160.mp4
just cli export examples/showcase/cleft/cleft.media.ts --variant teaching --for 3840x2160.mp4
```

The review plan covers draw-on, hold, 4K macro, camera return, and all three
materials. `model.test.ts` checks identities, polygon membership, bad gap
fixtures, reduced fidelity, shuffled seeks, teaching parity, and analytic loop
closure. A green probe does not establish aesthetic or 4K pixel acceptance.

The fonts are portable shared bytes from `_material/resources.ts`. Original
audio is baked offline and belongs to export definitions; live starts silent.
Performance reports must name canvas, browser, hardware, fidelity, and counts.
