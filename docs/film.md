# Make a film from a script

The script sets the order of shots and carries the dialogue. A shot module draws
the scene at a requested time. The series supplies the stage, cast, and the
look of bubbles, cards, and the title.

Use the [lighthouse example](../examples/film/film.media.ts) as a starting point.

```ts
import { film } from "@foxworth/superimg/film";
import script from "./film.script.md";
import { lighthouse } from "./series";
import * as shots from "./shots";

export default film({ ...lighthouse, script, shots: [shots] });
```

A shot fence names a function exported by one of the shot modules. Speech and
cards run inside the shot above them.

````md
```shot id=lookout hold=2.4
The lighthouse goes dark.
```

```speech id=mira-asks at=0.3..1.9
who: mira

Did the light go out?
```
````

Omit `at` to let the reading clock place the line. Omit `hold` to give the
shot enough time for its latest-ending line and a short pause. A silent shot defaults to
2.4 seconds. Set `still` on a shot to select a specific frame for dailies.

A shot receives `{ id, t, u, duration, lines, data }` with shot-local time `t`
and progress `u`. `lines` lists the shot's scheduled speech and card blocks
(`{ id, kind, who?, start, typed, end }`, shot-local seconds) so art can react
to dialogue, for example a character that turns when someone starts speaking.
Return an array of vector children or an SVG fragment. Use `cast()` to tag a
vector actor's head. `closeOn()` moves the art and its tagged heads together,
and every enclosing group transform (`place()`, `vector.group({ transform })`)
carries a head with it. A shot may also return `{ art, heads }` with explicit
head points in the final stage coordinates. This is how SVG string shots
supply heads. Bubbles, cards, and titles draw in output pixels.

Only a function exported under a shot's id is a shot. A shot module may export
helpers freely. If two modules export the same shot id the check reports
`DUPLICATE_SHOT` and the first is used.

## Cast and props

`cast(name, rig | { head, draw })` makes a speaker. A speaker is identified by
its cast name, whatever key it is stored under in `series.cast`; an entry that
`cast()` did not make is an error when `film()` is called. Placement options
are `size`, `flip`, `pose`, `walk`, `tint`, `opacity`, `shadow` and `lift`.
`lift` raises the sprite and its head by that many stage units; a rig's shadow
stays on the ground and fades with the sprite's opacity. A hand-drawn artist
receives `lift` in its options and raises its own art.

`prop(name, draw)` tags any prop art with its name, as `cast()` tags actors, so
`superimg film breakdown` and the continuity checks can follow it. The same prop
may appear more than once in a frame. Pass either a reusable draw function
`prop("cinnamon-jar", (x, y) => [...])` or art directly
`prop("cinnamon-jar", [...])`.

`closeOn(point, { zoom, x?, y? }, art)` needs a positive zoom. Above 1 the
camera crops the stage and never shows its edges. Below 1 the stage is smaller
than the screen, so the camera centres it on the point and holds it on screen.

## Breakdown

`film()` samples each placed shot at its still, at every eighth of its length
(start and end included), and at the middle of each line. Any cast member or
prop whose tagged group draws something with nonzero opacity is recorded in the
shot's breakdown (`{ cast, props }`). A shot drawer that throws at a sampled
time is skipped for that time; the breakdown is advisory and never fails a
check on its own.
`resolve()` publishes the full table under `breakdown`, and `filmBreakdown(media)`
reads it directly without running a full check.

```bash
superimg film breakdown examples/film/film.media.ts
superimg film breakdown examples/film/film.media.ts --with mira --with pip
superimg film breakdown examples/film/film.media.ts --json
```

## Title

The film title is a string. It defaults to the script's first level-1 heading
(a `*.script.md` import provides it as `script.title`, `null` without one) and
`film({ ...series, title: "Another" })` replaces it. The series draws it with
`Series.drawTitle(t, title)` during the first shot, so retitling a series never
removes its painter.

## Series options

| Option | Meaning |
| --- | --- |
| `stage`, `size`, `fps`, `background` | Art coordinates, output canvas (default 1080×1920), frame rate (30), backdrop |
| `cast` | Speakers, by `cast()` name |
| `bubble`, `card`, `drawTitle` | Painters in output pixels. A script `card` with no `card` painter is a finding |
| `ending` | `"cut"` (default for vector art) or `"fade"` (default for SVG-string art). The fade uses `background` |
| `fit` | `"contain"` (vector art) or `"cover"` (SVG-string art) by default. Override to change how the stage meets the canvas. SVG-string art paints `background` where a contained stage leaves bars |
| `bubbleLimits`, `glyphs`, `bubbleShowsName` | Lettering checks. Set `bubbleShowsName: false` when the bubble does not letter the speaker's name |
| `continuity` | Continuity supervisor options: `replantAfter?: number` (default off) and `introductions?: boolean` (default off) |

## What the check reports

Timing: `SHOT_SHORTER_THAN_LINES`, `INVALID_HOLD` (a hold that is not a
positive number; the reading clock sets the length instead),
`STILL_OUTSIDE_SHOT`, `BLOCK_BEFORE_SHOT` (a speech or card above the first
shot). Times compare with a nanosecond tolerance, so a boundary that is exact
in decimals is exact here, and published cue times and the film duration are
rounded to a microsecond.

Script and series: `UNPLACED_SHOT`, `DUPLICATE_SHOT`, `UNKNOWN_SPEAKER`,
`BUBBLE_TOO_LONG`, `MISSING_GLYPH` (lines, card attribution, sign and source,
the speaker name when bubbles letter it, and the title), `NO_CARD_PAINTER`.

Continuity, from the script and shot breakdown:

- `PROP_NOT_PLANTED`: a known prop (any prop that appears in the film's
  breakdown) is named in a later shot's speech lines or shot description
  without having appeared in an earlier shot. Matching is a case-insensitive
  word match where `-` and whitespace are equivalent (`cinnamon-jar` matches
  `cinnamon jar`). When `continuity.replantAfter` is set to a positive number
  `N` (off by default), a prop that reappears after being absent for `N` or
  more intervening shots is also flagged with `PROP_NOT_PLANTED`.
- `CAST_UNMET`: when `continuity.introductions` is `true` (off by default), a
  speaker speaks in a shot with or addresses by name a cast member they have
  never shared an earlier shot with.

Staging, at each speech cue's still: `NO_HEAD`, `BUBBLE_OFF_CANVAS` and
`BUBBLE_UNPARSEABLE`. The bubble is measured by what it paints, not by where the
speaker stands, so a bubble the series clamps on screen for an off-frame
speaker is fine. Rectangles, circles, ellipses, lines, polylines, polygons and
paths are measured with their transforms and strokes; text is estimated from its
anchor and size; nodes with opacity 0, `display="none"` or a mask paint
nothing, and a clip cuts what it covers. SVG-string bubbles are read as a
browser reads them. Only broken markup (an unfinished tag, a mismatched or
missing close) is `BUBBLE_UNPARSEABLE`.

```bash
superimg check examples/film/film.media.ts --pretty
superimg film breakdown examples/film/film.media.ts
superimg script cues examples/film/film.media.ts --json
superimg script cues examples/film/film.media.ts --md
superimg export examples/film/film.media.ts --for 1080x1920.mp4
```

Cues give the start, end, and representative still of each placed block;
`--md` prints them as a table that includes each card's attribution, sign and
source. The
player can seek to a cue by its block ID. The check reports timing, speaker,
lettering, continuity, and sampled bubble placement issues.
