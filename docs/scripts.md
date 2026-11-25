# Scripts

A script is one `*.script.md` file. A writer edits it. A film imports it. An
editor such as Prose asks SuperImg which films read it and where each block
sits in them.

The fence line is the edit (`id`, `hold`, `at`, `still`). The body is the
words. `scriptHash` covers the body; `editHash` covers the edit. The script
holds shot durations and shot-local offsets, never film clock times. The film
turns those into the film clock.

## The file

````md
# Barnyard Future

## Campfire

```shot id=campfire hold=6.5 still=2.4
Chick hops on the night ledge. A shooting star crosses the sky.
```

```storyboard
 (o o)  hop
```

```speech at=0.8..3.4
who: chick
do: hop

Goose. Will I
go to Mars?
```

```speech id=mars-answer at=3.8..5.6
who: goose
pace: slow

Not yet, kid.
```

## End card

```card id=sagan-card
attribution: Carl Sagan
source: Cosmos, episode 7, 1980

The sky calls
to us.
```
````

- **Blocks** are `shot`, `speech`, and `card` fences. Anything else, including
  other fenced code, is Markdown and stays where it was written.
- **Fence-line edit attributes** live on the opening fence line:
  - **`id=`** is the block's address: 1 to 80 letters, digits, or hyphens,
    unique in the file. `shot` requires an `id=` (omitting it reports
    `MISSING_ID`). On `speech`, `id=` is optional — write it when something
    outside the file points at the line; otherwise the film view defaults it to
    `<shotId>-<n>` under the nearest preceding shot (or `<section-slug>-<n>`
    before any shot, or `speech-<n>` before any heading). Collisions report
    `DUPLICATE_ID` and leave the colliding blocks with no address.
  - **`hold=<seconds>`** on a `shot` is how long the shot holds (`> 0`).
  - **`still=<seconds>`** on a `shot` is the shot-local moment that best shows
    it (`>= 0`, and `<= hold` when `hold` is present).
  - **`at=<start>..<end>`** or **`at=<start>`** on a `speech` or `card` is its
    shot-local window (`start >= 0`, `end > start`).
  - Unknown `key=value` attributes are preserved and printed back verbatim.
    Invalid timing values report `BAD_ATTR` with their line number.
- **Header fields** come before the first blank line. `who` and `pace` are
  named on a `speech` (`pace` defaults to `say` in the film view when omitted);
  `attribution`, `sign`, and `source` on a `card`. Any other `key: value` is an
  open note to the film (`do`, `react`, `world`, or whatever a film
  understands). Keys are lowercase with hyphens.
- **`storyboard`** fences attach to the block above them as a sketch.
- **Headings** name sections. Each block belongs to the nearest heading above.

## The package

`@foxworth/superimg-script` parses, prints, and hashes the format. It has no
dependencies and runs in a browser, so an editor can use it without the
renderer.

```ts
import {
  editHash,
  filmScript,
  parseScript,
  printScript,
  scriptBlocks,
  scriptHash,
} from "@foxworth/superimg-script";

const doc = parseScript(text);        // null means ordinary Markdown
for (const finding of doc.findings) console.warn(finding.line, finding.message);
scriptBlocks(doc)[0].fields.do = "hop";
const next = printScript(doc);        // canonical; printing it again changes nothing
const words = scriptHash(doc);        // changes when words/speakers/fields change
const edit = editHash(doc);           // also changes when hold/still/at change
const film = filmScript(doc);         // version 2, with defaulted speech ids & pace
```

Parsing never throws. Problems come back as `findings`.

- **`scriptHash(doc)`** is the SHA-256 of the words and intent a film sees:
  sections, resolved ids, speakers, pace, fields, card fields, and lines. It
  excludes timing (`hold`, `still`, `at`), storyboards, and prose between
  fences — so retiming a shot or speech does not invalidate the words hash.
- **`editHash(doc)`** is the SHA-256 of the same film view *plus* timing
  attributes (`hold`, `still`, `at`), so retiming moves `editHash` while
  leaving `scriptHash` unchanged. Storyboards and prose affect neither hash.

## In a film

Import the file. The default export is the film view,
`{ version, hash, editHash, blocks }` (`version: 2`), with defaulted speech ids
and `pace: "say"` resolved, timing attributes included, and storyboards and
prose left out. Saving an imported `*.script.md` file reloads `superimg dev`
automatically.

```ts
import { video, Html } from "@foxworth/superimg";
import script from "../reel.script.md";

const timeline = cut(script.blocks);  // film turns shot holds & local offsets into film clock

export default video({
  duration: `${timeline.total}s`,
  resolve: () => ({
    cues: timeline.cues.map((c) => ({ id: c.id, start: c.start, end: c.end, still: c.still })),
    cueFindings: timeline.issues.map((i) => ({ id: i.id, message: i.message })),
  }),
  render: (ctx) => Html({ id: "scene", width: "fill", height: "fill", html: scene(timeline, ctx.timeline.seconds) }),
});
```

- **`cues`** says where each block sits on the film clock: `start`, `end`, and
  an optional `still`, the moment that best shows it. Without `still` the
  middle is used.
- Each cue also becomes a **marker** with the same id, so a player can
  `goToCheckpoint(blockId)`.
- **`cueFindings`** reports a problem on one block in the film's own words.

A cue id must be a block id from the script (explicit or defaulted). Publish no
cue for a block the film does not place.

## For an editor

```bash
superimg script sources reel.script.md --json
superimg script cues film/reel.media.ts --json
superimg script stills film/reel.media.ts --out ./stills --max-width 540 --json
```

- **`sources`** lists the media files under the working directory (or
  `--root`) that import the script. It reads import syntax only. No film code
  runs, and nothing outside the root is read.
- **`cues`** compiles the film and runs its `resolve()` once. For each block it
  returns `startSeconds`, `endSeconds`, `stillSeconds`, and `costSeconds`, the
  time from this cue's start to the next cue's start. It also returns
  `unplaced` (blocks with no cue), `unknownCues` (cue ids the script no longer
  has), `findings`, `programHash`, and `scriptHash`.
- **`stills`** renders one PNG per block in one browser session and writes
  `<blockId>.png` files. Repeat `--block <id>` to render only some.

Compare `scriptHash(doc)` for the open buffer with the `scriptHash` from
`cues`. When they differ, any still you hold shows the words before the edit.

These are also Boundary interactions, in their own Program so the `media`
Program's identity does not change: `media.script.sources`, `media.script.cues`,
and `media.script.still`. All three read and change nothing.

```ts
import { createNodeScriptInteractionMount, SCRIPT_INTERACTION_IDS } from "@foxworth/superimg-interactions";

const mount = createNodeScriptInteractionMount({ projectRoot, runtime });
const cues = await mount.dispatch({ interactionId: SCRIPT_INTERACTION_IDS.cues, input: { source: "film/reel.media.ts" } }, {});
```

`media.script.still` takes a source, a block id, and an optional `maxWidth`,
and returns one PNG as base64. It needs the host's `runtime`; `sources` and
`cues` do not.

## Limits

- A film may import one script file.
- Collections and interactive definitions have no script cues.
- The browser playground cannot import a script file yet.
- A preview video for "play from this line" is not built. Until then, seek
  the exported file, or a player, to the cue's `startSeconds`.
