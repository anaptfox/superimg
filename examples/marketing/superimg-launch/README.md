# SuperImg launch film

A 34.9 second, 1920×1080 film about one scene used many times. Peg, a stack of
four soft clay slabs, performs a card trick on a pencil-test sheet. The same
frame becomes a poster, then a website. The scene is printed as two campaign
kits (poster, social card, banner). Peg learns a new trick: it deals its blue
slab, and a small sun hops between two hills on it. The slab's hills grow into
the world around Peg. The richer scene is printed as a poster again and
published as a website again. The film ends on the campaign kit under
"Media as code."

It is one `video()` program. Every frame is a pure function of
`ctx.timeline.seconds` through a single director plan.

## Run it

From the repository root (`just cli` builds the render stack first):

```bash
just cli check examples/marketing/superimg-launch/superimg-launch.media.ts --for 1920x1080 --craft
just cli inspect examples/marketing/superimg-launch/superimg-launch.media.ts --summary --pretty
just cli inspect examples/marketing/superimg-launch/superimg-launch.media.ts --at 2.4s,6.5s,9s,15.4s,18.6s,22.08s,26.25s,30.1s,32.6s,34.9s --review
just cli export examples/marketing/superimg-launch/superimg-launch.media.ts --for 1920x1080.mp4 --review
```

Elsewhere, install `@foxworth/superimg` and `@foxworth/superimg-cli` and use
`npx superimg` with the same arguments.

Timing and print-layout tests:

```bash
node_modules/.bin/vitest run --config examples/marketing/superimg-launch/vitest.config.ts
```

## Chapters

| Seconds | Act | What happens |
|---|---|---|
| 0 – 9 | `reuse` | Film → held frame → 4:5 poster → website |
| 9 – 11.8 | `finish` | Peg finishes its card trick on the website |
| 11.8 – 18.8 | `batch` | Two entries, each scanned out as a poster, a social card and a banner |
| 18.8 – 20.1 | `revise` | Peg lifts out of its print; the published prints stay unchanged |
| 20.1 – 23.45 | `ability` | The new trick: deal, present, wink |
| 23.45 – 26.55 | `world` | The slab's hills grow into sky, far hills, near hills, ground, foreground |
| 26.55 – 27.1 | `held` | The sun freezes at the poster's printed instant |
| 27.1 – 30.3 | `poster` | The richer poster is printed, with the sun's hop as a dotted path |
| 30.3 – 32.8 | `website` | The website, published again |
| 32.8 – 34.9 | `close` | The campaign kit returns under "Media as code."; the last 1.3 s hold |

## Files

| File | Job |
|---|---|
| `superimg-launch.media.ts` | The film: layout in stage units, every layer, Peg's mounts |
| `cut/plan.ts` | The director plan (acts and cues in seconds), section lengths, Peg's clocks |
| `cut/sheet.ts` | The pencil-test sheet: paper art plus typed vector pencil marks |
| `cut/prints.ts` | The campaign kit: entries, formats, hand-placed arrangements, `print()` |
| `cut/land.ts` | The miniature's world at full size: paper planes, poster land, website land |
| `cut/type.ts` | Font families and files |
| `peg/visual.ts` | Peg as one shared `visual()` definition |
| `peg/art.ts` | Peg's art as self-contained SVG: `fanSvg()` (card trick) and `trickSvg()` (new trick with the slab) |
| `peg/*.ts` | The clay painter, Peg's geometry and both performances |
| `assets/fonts/` | Newsreader Medium and IBM Plex Sans 400/600, with their SIL OFL licences |

## Reusing the parts

Peg is one shared visual. Mount it anywhere with an `Instance`:

```ts
import { Instance, Scene } from "@foxworth/superimg";
import { peg } from "./peg/visual";
import { fanSvg, PEG_BOX, SCENE_BOX, svgUri, trickSvg } from "./peg/art";

// The card trick at motion time 2.4 s, in a world's two lent colours.
Scene({ id: "stage", width, height },
  Instance({ id: "peg", entityId: "peg", of: peg, at: { x, y },
    data: { src: svgUri(fanSvg(2.4, { fx: "#3b3732", shadow: "#c4b79c" }, "peg")), box: PEG_BOX, scale: 2 } }));

// The new trick: trick time t, the slab's miniature at its own time s.
// `clock` is { director: sampleDirector(ctx), oscillate: ctx.std.oscillate, radToDeg: ctx.std.math.radToDeg }.
data: { src: svgUri(trickSvg(t, s, clock, "peg")), box: SCENE_BOX, scale: 2 }
```

`at` is Peg's floor point. `scale` is pixels per drawing unit; the art is laid
out at its final size so it rasterises sharply.

`print(entry, format, width, height)` from `cut/prints.ts` returns one campaign
print as a typed tree. Change the copy or a world's colours in `ENTRIES`, or an
arrangement in `ARRANGE`, and every print that uses it changes.

Section lengths are `knobs` in `cut/plan.ts`. Every later boundary is derived
from them and from Peg's performances, so a change moves the rest of the film
with it.

## How it is built

- **Text is text.** Headlines, copy, mastheads and buttons are `Text` or typed
  `vector.text` with declared local fonts. Accent full stops are separate runs.
- **Peg is opaque art.** The clay painter emits SVG with filters and a tooth
  texture. Peg's pose and lent colours are data. Its interior is not a tree of
  editable vector nodes.
- **Some scenery is opaque art too:** the paper grain, the paper planes and
  the printed land use colour-matrix and drop-shadow filters. Pencil marks,
  lamp pools, vignette, rules, dotted notation and the prints' stock and
  gradients are typed vector nodes.
- **One clock.** Opening beats, batch prints, world growth and the close are
  all cues of the one director plan. The new trick and the slab's miniature
  sample their own authored plans through `ctx.director().clip()`, so Peg can
  hold a pose while the miniature keeps hopping.
- **Colour** comes from `ctx.std.color`. When the page brightens or darkens,
  the mix weight follows light, so type flips colour while the page behind it
  is already light.
- **Responsive.** Layout is in stage units: 546 units tall, as wide as the
  output's aspect. The sheet, kits, website and close adapt to width. The film
  is authored at 16:9.

## Limits

- Peg and the filtered scenery are images inside the tree. `check` cannot
  measure text contrast over them, so it reports `TEXT_PAINT_UNVERIFIED`
  warnings. Review the frames by eye.
- Headlines with a coloured full stop are mixed-run `vector.text`. Their
  metrics are approximate (`TEXT_METRICS_APPROXIMATE`).
- The painter's own tween is unnamed (`IR_anonymous_id`). Its motion is
  sampled.
- Rendering draws a fresh Peg SVG every frame, so export is slower than a flat
  motion-graphics film.
