# API

## Authoring

### Imported art and native surfaces

`svgDocument` accepts bytes from a static `./art.svg?superimg-svg` import.
`SvgArtwork({ document, id, width, height, edits })` places the art and scopes
local definitions by occurrence id; `svgPart` places the whole document or a
named subtree in an existing Scene. Edits support bounded paint, plain text,
selected geometry, path data and translation. Source and edited revision hashes
are available via `svgDocumentIdentity`. Scripts, CSS, external resources,
`foreignObject`, `xml:base` and unsupported SVG elements are refused.

For Canvas/Three, write an ordinary module satisfying `NativeSurfaceModule<Data>`
with `create`, absolute-time `sample`, and `dispose`; import it with
`?superimg-surface` and pass it to `NativeSurface<Data>`. The host supplies the
complete prepared module set. CLI/Node and dev preview support this path;
production Player, browser/edge runtime and schema-0 artifacts refuse it. Use
`superimg compile scene.media.ts --artifact-version 1` for a native Node replay
artifact; schema 0 remains the default and older readers reject schema 1.
Capture waits for the surface by default. `wait: false` opts out and can capture
before paint; use it only when another mechanism supplies readiness. A plain
identifier passed as `wait` names the readiness signal.
In a Vite Node SSR host, add `nativeSurfaceVite({ build })` from
`@foxworth/superimg/vite` to the host's Vite configuration, import `build` from
the host's Vite, and declare `nativeModuleSets: [world]` on the media value.
The plugin builds trusted world imports with that Vite and watches the loaded
sources; the host owns error UI and any last-good preview. Pass any required
world-build aliases and plugins explicitly through `world: { resolve, plugins }`;
the separate world build does not automatically inherit application settings.
See `examples/showcase/celadon-atelier`, `celadon-pour`, and `celadon-pavilion`
for editable artwork, motion, and a native Three world respectively.

```ts
import { define, video, image, svg, ogImage, collection, compose, Frame, Stack, Text, Vector, vector, Fill, Image, Video, Html } from "@foxworth/superimg";
```

`video()` defaults to 1920×1080, 30 fps, temporal once, and MP4. `image()` defaults to 1920×1080 PNG. `svg()` defaults to 1920×1080 SVG. `ogImage()` defaults to 1200×630 PNG. Every helper accepts custom `size` and lowers to canonical `MediaDefinition`; bare `define()` is the lower-level escape hatch.

`render(ctx)` returns one typed **tree**. Frame owns position (`x`/`y`); Stack is laid out by its parent. Omitted size hugs; `width: "fill"` fills. Paint is `Fill` / `Image` / `Video`. The markup hole is boxed `Html()` — not `html` on Frame. Last act holds unless `exit: true`. Screen tours use `t.beats({ during, of, cross })`. `style` accepts a CSS string, a style object, or a `MotionResult` (no `.style` required). JSX is not the authoring syntax; `h()` is the advanced low-level escape hatch.

### Semantic vector art

`Vector({ width, height, viewBox }, ...children)` introduces an SVG coordinate
plane inside the media tree. Its children come from the `vector` namespace:

```ts
const draw = ctx.std.svg.draw(d, progress);
return Vector(
  { id: "diagram", width, height, viewBox: { x: 0, y: 0, width, height } },
  vector.defs(
    vector.clip(
      { id: "plot-window" },
      vector.path({ d: windowPath, fill: "#fff" }),
    ),
  ),
  vector.group(
    { id: "plot", clip: "plot-window" },
    vector.path({
      id: "series",
      d,
      fill: "none",
      stroke: "#7c3aed",
      strokeWidth: 3,
      strokeDasharray: draw.strokeDasharray,
      strokeDashoffset: draw.strokeDashoffset,
    }),
  ),
);
```

Use the typed `vector.*` namespace: `circle`, `rect`, `line`, `ellipse`, `polyline`, `polygon`, `path`, `group`, `text`, `run`, `defs`, `mask`, `clip`, `linearGradient`, `radialGradient`, `stop`, `pattern`, `filter`, `gaussianBlur`, `turbulence`, and `displacementMap`. Mask, clip, gradient, pattern, and filter ids are explicit and stable; group and paint references are plain ids, never handwritten `url(#...)`. `Text`, `Code`, and `vector.text` accept `reveal` (`0..1` typewriter/character reveal), and local `.ttf`, `.otf`, `.woff`, and `.woff2` fonts in `fonts: [...]` are measured natively without font-outlining scripts. Geometry algorithms such as `std.svg.draw()`, `morph()`, Bézier helpers, shape paths, and text measurement feed these nodes. Keep `Html()` for deliberately opaque third-party markup — never place raw `<svg>` strings inside `Html()` (flagged as `RAW_SVG_IN_HTML` by `superimg check`).

Shared root fields include `sample`, `resolve`, `render`, exact-aspect `editions`, and shallow data `variants`. Variants cannot own delivery or clock fields.

## Typed charts

Import `layout`, `defineChart`, `lineY`, `lineX`, `barY`, `barX`, `areaY`, `group`,
and compact `scaleLinear`, `scaleBand`, `scalePoint`, `scaleOrdinal` from
`@foxworth/superimg/charts`. Supply a static TanStack definition and
`{ id, width, height, theme?, typography?, measureText?, motion? }` to `layout`.
Return its typed `artwork`; retain `scene`, `points`, `point(key)`, `mark(markId)`,
`project(channel, value)` and `pathPoint(nodeKey, progress)` for annotations.
Scene coordinates describe the final layout; artwork can be partially revealed.

Use explicit mark ids and datum keys. Occurrence ids qualify clip/mark ids.
`motion.lineReveal` and `motion.barsGrow` sample explicit 0–1 progress, optionally
overridden by `motion.marks[markId]`. Frames never depend on prior playback.
Supply concrete theme colors and host typography; absent `measureText`, the
result reports `APPROXIMATE_TEXT_METRICS`. Unsupported gradient/CSS paint,
stroke joins, dynamic focus/state and custom rendering fail with a chart error.
Static charts do not mount focus, keyboard, pointer or motion hosts.

The string helpers `std.viz.charts.bar/barHorizontal/bars/line/lineTime/lines`
are replaced by this entry. Specialized area/stack, bar-race, pie, scatter,
sparkline, hierarchy, force and contour helpers remain separate string helpers.
See `examples/developer/npm-stats` and `examples/data/chart-primitives` in the
repository for typed charts without SVG parsing or duplicate axis calculations.

## Retained composition

`sequence(parts)` retains named occurrences in authored order. A part is `{ id, content, hold?, data?, fit?, variant?, edition? }`, where `content` is a deterministic media definition or another Program. IDs are unique among siblings and produce qualified paths such as `chapter/demo`. Timed stills require `hold`; animated children keep their native fps while `time()` samples them on the output clock. A nested Program can inherit a shallow `data` patch and extend its final frame with a longer `hold`. `variant` chooses a child data patch and `edition` chooses child art direction for that occurrence. Child `resolve()` runs once per selected occurrence after `sample < variant < use.data < entry.uses[path]`; its resolved duration updates the parent schedule before render.

```ts
import { sequence, time } from "@foxworth/superimg";

const chapter = sequence([
  { id: "demo", content: demoVideo },
  { id: "result", content: resultImage, hold: "1s" },
]);
const story = sequence([
  { id: "opener", content: openerImage, hold: "1s" },
  { id: "chapter", content: chapter },
]);
export default time(story, { size: { width: 1920, height: 1080 }, fps: 25 });
```

`together(parts, { end: "hold" | "hide", size? })` places children on one clock. `size: { width, height }` fixes a reusable group's canvas. Each part has `rect: { x, y, width, height }` and `fit: "contain" | "cover" | "reflow"`. `hold` keeps a shorter child's last frame until the group ends; `hide` removes it. HTML and SVG leaves can share the group. A child can be a sequence or another `together`; nested placement transforms compose, including reflow at a leaf's immediate target.

`choose({ beginner, advanced })` retains all branches. A timed projection selects each choice with `routes` keyed by qualified choice path: `time(lesson, { size, fps, routes: { explanation: "beginner" } })`. Exports cannot leave a route open. Browser hosts own viewer input and may load a fresh timed projection for the selected route.

`time<Entry>(program, options)` accepts scoped collection entries shaped `{ id, uses: { "chapter/demo": { ...childData } } }`. Root entry data cannot override every child. Keep providers in `.server` modules. `replaceOccurrence(program, path, content)` returns a new Program; `diffCompositionSchedules(before, after, changedPaths)` reports changed and shifted ranges with conservative `cacheSafe: false`. Long-lived Node hosts may opt into `createNodeRuntimeAdapter({ compositionFrameCache: { schemaVersion: 1, runtimeVersion, identity } })`; `identity({ path, media })` must return `{ id, version }` for every active child and advance the version whenever its behavior or owned bytes change. A valid captured-frame hit skips child rendering and Chromium capture, while encoding still runs. This does not change the schedule diff's proof claim.

Child assets can use explicit `{ bytes, mimeType }` or absolute HTTP(S) URLs. Two imported children may both declare `assets.logo`: their render functions use `ctx.asset("logo")`, while `time()` retains separate root keys such as `first/logo` and `second/logo`. For relative child asset, font, or audio paths, explicitly bind a qualified leaf path to an absolute file or HTTP(S) source base: `time(rebaseCompositionSources(program, { "chapter/demo": new URL("./parts/demo/", import.meta.url) }), { size, fps })`. The helper clones the Program and rebases declarations synchronously. `prepareProgram(program, { size, fps, sourceBases, assets })` from `@foxworth/superimg/composition/prepare` also accepts per-job bases and an asset provider. See `examples/composed/portable-stage/` and `examples/composed/namespaced-assets/`.

`source.image({ src, size, fit? })`, `source.svg({ src, size, fit? })`, and `source.video({ src, size, fps, duration?, trim?, fit? })` turn a direct file into an ordinary reusable media definition. `src` is an absolute `file:` URL or `{ bytes, mimeType }`; source video is visual-only, so declare audio separately. A video needs a positive duration or `trim.to` from which to derive one.

Child audio clips receive occurrence-qualified IDs and root `at` offsets. Their placement ends within the child's authored interval, even when a placed visual is held. Simultaneous children mix at the same root time. Child mix settings must agree; child `atScene` is rejected. Relative audio sources need an explicit source base. See `examples/composed/audio-sequence/`.

```ts
import { Player } from "@foxworth/superimg/player";
import { present } from "@foxworth/superimg/player/program";

const player = new Player({ container: "#stage" });
const session = present(player, story, { mode: "manual", size: { width: 1920, height: 1080 }, fps: 25 });
await session.ready;
await session.go("chapter");
```

Manual presentation selects top-level sequence parts using one stable Player. A nested Program retains its own timed projection. `time()` keeps the Program, selected routes, placements, selected child editions/variants, and exact frame schedule visible in inspect/IR. When a child canvas differs from its target, `fit: "contain"` or `fit: "cover"` maps its authored canvas; `fit: "reflow"` renders the leaf at its immediate target dimensions, including inside a nested placement. A different export destination fits the authored Program canvas with `contain`. Selected child fonts lift to the root. Child `inlineCss` and `stylesheets` lift into one shared document, so scope selectors; incompatible child Tailwind settings fail. Child background, watermark, and readiness settings remain unsupported. `compose()` retains its existing behavior for older works.

For a selected part containing a choice, pass `routes` keyed by its path in the full sequence: `present(player, story, { mode: "manual", size, fps, routes: { "lesson/explanation": "beginner" } })`. A choice that is the whole part uses the part ID as its route key.

For one host API across manual selection and continuous playback, import `present` from `@foxworth/superimg/player/program`. `present(player, program, { mode: "manual" | "timeline", size, fps, routes?, initialId? })` returns a session with `ready`, `parts`, `go`, `next`, `previous`, `choose`, `setData`, `setScene`, `snapshot`, and `dispose`. The host subscribes to interactive child actions with `session.on("action", listener)`; events include the qualified child path. Use `new Player({ container, drive: "scroll" })` with `mode: "timeline"` for a scroll-driven presentation. `defineInteractive()` children retain their guide, semantic scene, and action bridge inside a Program. The host owns routes, scene state, and external effects. If children need file preparation, call `prepareProgram(program, { size, fps, routes, sourceBases, assets })` from `@foxworth/superimg/composition/prepare` for each job and present its returned `program`.

## Collections

```ts
collection({
  entries: readonly Entry[] | (() => readonly Entry[] | Promise<readonly Entry[]>),
  entryId?: keyof Entry | ((entry: Entry) => string),
  media: DeterministicMediaDefinition<Entry>,
})
```

A required string `id` is automatic. Returned objects pass unchanged to `ctx.data`. Nested and interactive collections are rejected. Providers are imported from dedicated server modules and remain absent from browser programs and artifacts.

## Destinations

`@foxworth/superimg/destinations` exports the schema-0 organic catalog, lookup helpers, and custom `WIDTHxHEIGHT[.format]` parsing.

## Interactive

`@foxworth/superimg/interactive/define` exports pure authoring, semantic query, guide layout and checks. `@foxworth/superimg/interactive/player` exports framework-neutral controllers. `@foxworth/superimg/react/interactive` exports `InteractivePlayer`. Interactive definitions are singular live experiences, not collections.

## Runtime

```ts
import { init, check, inspect, render, exportMedia, renderResponse, shutdown } from "@foxworth/superimg/runtime";

await check(media);
const html = await render(media, { as: "html", data: { title: "Launch" } });
await html.bytes();
const response = await renderResponse(media, { as: "png" });
const bundle = await exportMedia(media, { for: ["open-graph"] });
await bundle.dispose();
await shutdown();

const runtime = await init();
await inspect(media, { runtime });
await runtime.dispose();
```

The runtime consumes imported media values, never source paths. Calls are
media-first. Omit `runtime` to use one shared runtime from the platform
`init()`. Node disposes that runtime after 2 seconds idle. `shutdown()`
disposes it immediately. `data` is a partial of the media value's data type.

`check` and `inspect` accept deterministic, collection, and interactive values
and skip providers by default. `render` accepts deterministic exportable media
and returns one exact HTML, SVG, PNG, JPEG, WebP, MP4, WebM, MOV, or GIF
result. Animated `as` reads the single export artifact into memory.
`exportMedia` performs a complete preflight and returns an unpublished portable
bundle. `renderResponse` returns a `Response` whose headers are content-type,
content-length, and an etag of the SHA-256.

Bundle artifact paths are normalized and relative. Each result and artifact
exposes MIME type, byte length, SHA-256, coordinates, `stream()`, `bytes()`,
`blob()`, and `text()`. `text()` rejects with `NOT_TEXT` for a non-text MIME
type. Dispose the bundle separately from the runtime.

## Scripts

A script is one `*.script.md` file: `shot`, `speech`, and `card` fences, with
optional `storyboard` sketches attached to the block above. The fence line is
the edit (`id=`, `hold=` and `still=` on `shot`, `at=<start>..<end>` or
`at=<start>` on `speech`/`card`); the body is the words and header fields
(`who`, `pace`, `attribution`, `sign`, `source`, plus open `key: value` notes).
`shot` requires `id=`; `speech` defaults its `id` to `<shotId>-<n>` (or
`<section-slug>-<n>`) and `pace` to `say` when omitted. The script holds shot
durations and shot-local offsets, never film clock times.
`@foxworth/superimg-script` parses, prints, and hashes it (`parseScript`,
`printScript`, `scriptBlocks`, `filmScript`, `scriptHash`, `editHash`).

A film reads its script by importing the file. The default export is
`{ version: 2, hash, editHash, blocks }`; storyboards and prose are left out.
`hash` (`scriptHash`) covers words/speakers/fields and ignores timing;
`editHash` also covers `hold`/`still`/`at`. Saving an imported `*.script.md`
reloads `superimg dev` automatically. The film turns those into the film clock
and publishes it from `resolve()`:

```ts
import script from "../reel.script.md";
const timeline = cut(script.blocks);
export default video({
  duration: `${timeline.total}s`,
  resolve: () => ({
    cues: timeline.cues.map((c) => ({ id: c.id, start: c.start, end: c.end, still: c.still })),
    cueFindings: timeline.issues.map((i) => ({ id: i.id, message: i.message })),
  }),
  render: (ctx) => renderScene(timeline, ctx.timeline.seconds),
});
```

A cue id is a script block id (explicit or defaulted). Each cue also becomes a
marker with that id. Publish no cue for a block the film does not place.

```bash
superimg script sources reel.script.md --json      # films that import it; runs no film code
superimg script cues film/reel.media.ts --json     # per block: start, end, still, cost; unplaced; findings
superimg script stills film/reel.media.ts --out ./stills --max-width 540 --json
```

The same reads are the `script` interaction Program: `media.script.sources`,
`media.script.cues`, `media.script.still`, mounted with
`createNodeScriptInteractionMount({ projectRoot, runtime })`. See `docs/scripts.md`.

## Film

`@foxworth/superimg/film` exports `film`, `cast`, and `closeOn`. Pass
`film({ ...series, script, shots: [shotModule], score?, data? })` a script
module and one or more modules whose named functions match shot IDs.
It returns an ordinary video definition (1080×1920 and 30 fps by default).
The optional score begins at zero and spans the film.

Each `Shot<Data>` receives `{ id, t, u, duration, data }` and returns vector
children, an SVG fragment, or `{ art, heads }`. Time and progress are local
to the shot. `closeOn({ x, y }, { zoom, x?, y? }, art)` clamps the camera
against stage edges and projects tagged heads through nested camera groups.
Explicit heads use final stage coordinates and override matching cast tags.
Vector stage art fits by containment. String stage art fits by centered crop.

`cast(name, rig, { seed? })` accepts a generated pet rig with `w`, `h`, and
`poses` of filled paths. Place it with `(t, { x, y }, options?)` where `x`
is the painted rest pose's center and `y` is the feet line. Size, flip, pose
and walk affect placement. A hand-drawn member takes `{ draw, head }`. Its
draw function receives the placement. Its local head offset is scaled and
mirrored before being added to that placement.

The series owns the screen-space `bubble`, `card`, and `title` painters.
Bubbles receive shot-local times and the projected speaker head in pixels.
Cards receive card-local time and duration. The title painter runs on the
first shot's clock. Supply an explicit title string with `drawTitle` when
customizing both the string and its painter. A script title is used when
available, with the first block heading as the legacy fallback.
String art defaults to a fade, while vector art defaults to a cut.

`resolve()` publishes cues and markers for addressed blocks. The bubble
placement check samples each speech's still. String geometry is measured
where the SVG fragment can be read as typed artwork. See
`examples/film/` and `docs/film.md` for the authoring loop.

Film helpers are `clamp`, `span`, `mix`, `mixColor`, `ease`, `inOut`,
`inCubic`, `outCubic`, `outBack`, `hash`, `r`, `ellipse`, `poly`,
`line`, and `place`.

## Node interactions

CLI delivery review: `superimg export film.media.ts --for 1920x1080.mp4 --review
--json` exports once and decodes that published movie for the existing review
plan/packet. One explicit MP4/WebM target and one authored animated selection are
supported; choose declared variants/editions explicitly. Collections and dynamic
observation resolution are not supported by this review surface. Source preview
review remains `inspect --review`. The CLI retains the publication receipt and
separate review outcome; an unsuccessful review does not undo a completed
publication. Packet `delivery` and each derivative name the movie hash and
encoded frames. Technical delivery checks, author-reported observations and
human visual acceptance stay distinct. This native orchestration adds no
Boundary wire interaction or execution grant.

`@foxworth/superimg-interactions` is the Node-only, Boundary-backed surface of the `@foxworth/superimg-interactions` package. Ordinary `*.media.ts`
authoring stays on `superimg` and never imports it.

Trusted hosts call `createNodeMediaInteractionMount()` and `mount.dispatch`. The
host passes an explicit runtime and retains lifecycle ownership. The interaction
ids are `media.project.discover`, `media.source.describe`,
`media.source.check`, `media.source.inspect`, `media.collection.snapshot`,
`media.artifact.compile`, and `media.export`. Discovery, description, check,
and inspect are direct-only. Snapshot executes a provider once. Compile
publishes one schema-0 Media IR artifact. Export consumes a matching snapshot
and the portable runtime bundle, publishes manifest-last, and returns a
serializable publication receipt.

Exact source edits use `createNodeEditInteractionMount()` / CLI `superimg edit`.
Ids are `media.edit.bindings`, `media.edit.set-node-transform`,
`media.edit.trim-scene-end`, `media.edit.set-phase-boundary`, and
`media.edit.set-composition-hold`. The hold edit requires an inline Program
passed to `time()` in the same source file and a qualified still occurrence
path; imported Programs have no exact hold binding yet. Bindings is
direct-only. Mutating edits need the current intent hash and source hashes.
The CLI is trusted native dispatch of those interactions; do not rewrite
`*.media.ts` by possessing the file.

Checked callers use `MEDIA_COMPILED_INTERACTIONS`, `installMediaInteractions`, and
`projectMediaInteractions`, then `bindProjection`. Request mode is a proposal
only. The mount does not create an App, grant, attempt store, or control plane.
URLs, deployment, durable workflow receipts, and source catalog identity remain
host responsibilities.

## Player

`@foxworth/superimg/player` is the framework-neutral passive playback surface:
`Player`, `MediaSession`, `MediaClock`, and their playback types. React graph
boundaries remain under `@foxworth/superimg/react/*`. `@foxworth/superimg/react` and
`@foxworth/superimg/react/player` accept realized media values. SuperImg's CLI compiles
first-party templates in-process. Browser-framework hosts compile `*.media.ts` with
their own Rolldown/OXC. Trusted Node hosts can compile with `compileNodeMediaSource`
from `@foxworth/superimg-node/source`.
`@foxworth/superimg/react/compile` is only SuperImg's own playground shell
(`CompilingPlayer`, `useCompiler`, `useCompiledMedia`).

## Browser inspection

For the persistent workflow and repository capture command, read
[live-browser.md](live-browser.md). The contract below also works in other hosts.

`@foxworth/superimg/inspection` exports `createPreviewInspection()`. Hosts attach a Player
under a unique `surfaceId`, optionally add a ProgramSession or InteractivePlayer,
and enable each control. The pure entry has no Boundary requirement.
`@foxworth/superimg/inspection/boundary` is an optional host Preview Program; the Boundary
SDK registers its explicitly projected/admitted tools through `/webmcp`.

For a host exposing `window.superimgInspection`, prepare exact capture with:

```js
const inspection = window.superimgInspection;
const before = await inspection.inspect({ surfaceId: "preview" });
const owned = await inspection.setMode({
  surfaceId: "preview", expectedGeneration: before.generation, mode: "inspection",
});
const shown = await inspection.seek({
  surfaceId: "preview", expectedGeneration: owned.generation, frame: 6,
});
```

1. Discover available surfaces/controls with `list()` or the host's page tools.
2. Read a fresh generation, enter inspection mode, then select an integer frame
   within `0..totalFrames - 1`. Part/route/step selection also requires this mode.
3. Require the desired `presented.frame` and `readiness.status === "ready"`.
   Save the snapshot, then take the browser screenshot while the clock is held.
4. Inspect again. Accept the capture only if generation and presented revision
   match, resources remain ready, and the clock owner is still `inspection`.
5. Return to `live` using the latest generation. Retain declared failures and
   refresh stale targets instead of reporting a requested frame as presented.

`inspect()` observes the last accepted DOM state and any requested frame
separately. Bounds use host-viewport CSS pixels; occurrence paths distinguish
repeated child IDs. Canvas interiors remain opaque unless the host supplies
sidecar semantics. IR/semantic state and screenshots establish different proof;
browser capture does not establish encoded-export or physical-device acceptance.

For WebMCP, discover schemas before invoking `media.preview.inspect`,
`media.preview.set-mode`, or `media.preview.seek-frame`. Decode the CLI output
and require Boundary `certainty: "completed"` with `result.kind: "returned"`
before using `result.value`. Native tool availability is capability-detected;
ordinary JavaScript is the host's fallback. The development inspector exposes
`window.superimgInspection` with surface ID `dev-preview`.

## Shared visual scenes

`visual<Data>()`, `Instance()` and `Scene()` are root `superimg` exports. Use them for reusable characters, split scenery, attached props, and process diagrams across video, image, SVG and interactive media. Each definition samples explicit data once per resolution. A frame has named parts, local bounds, and local anchors. Rendering owns no simulation clock or commands.

```ts
const worker = visual<{ handY: number }>({
  id: "worker",
  render: ({ data }) => ({
    parts: [{ id: "body", bounds: { x: -20, y: -80, width: 40, height: 80 },
      content: vector.path({ d: "M-20 0L0 -80L20 0Z", fill: "#2e3a4f" }) }],
    anchors: { hand: { x: 20, y: data.handY } },
  }),
});
// cup is another visual definition with its own explicit bounds.
return Scene({ id: "street", width: ctx.width, height: ctx.height },
  Instance({ id: "worker-appearance", entityId: "worker-1", of: worker,
    data: { handY: -40 }, at: { x: 120, y: 200 }, transform: { scaleX: -1 } }),
  Instance({ id: "sale-cup", entityId: "sale-1", of: cup, data: null,
    attachTo: { instance: "worker-appearance", anchor: "hand" } }),
);
```

`id` identifies the visual occurrence; `entityId` identifies a persistent host entity; the definition's `id` identifies shared art. Composition qualifies scene/instance/part paths per occurrence. Part `band`, projected depth, and `order` control paint independently of semantic ancestry. `placement` is an offset in the scene projection basis; art bounds and anchors are local pixel coordinates. Planar instance transforms support translation, rotation and independent scale axes, including mirroring. `at` and `attachTo` are mutually exclusive. Attachments inherit their owner's placement/depth and require the same world/screen space.

The default basis paints x/y directly and uses z only for depth. Supply `projection: { x: [100, 0], y: [0, -90], z: [0, -45], depth: [0, 0, 1] }` for a projected street. Depth sorts far first, bands ascending. A camera explicitly pans, zooms, rotates, or fits `targets: ["worker-appearance", "sale-cup"]` with optional padding. Fit uses declared envelopes. Screen instances use pixel coordinates and bypass projection/camera. Unsupported implicit follow and 3D rotations reject before publication.

Normal tree nodes accept `semantic: { id, kind, role, label, tags, actions, metadata }`. An instance's own `id` supplies semantic identity. Explicit instance hit regions use `semantic.hit` (`rect` or `circle`); hits, anchors, part envelopes and paint use the same matrices. Actions declare host-interceptable intent. Hosts admit commands and publish accepted data independently.

Import `resolveSceneTree`, `collectSceneSnapshots`, `collectSceneDescriptions`, `sceneObservations`, and `scenesAtFrame` from `@foxworth/superimg/scene` for pure inspection. Resolve first, then collect. Spatial packets include instance/definition/entity identity, named anchors, part order, opaque status, viewport, camera matrices and explicit hit geometry. Ordinary semantic descriptions remain available without inventing spatial geometry. Packet geometry describes declared envelopes; it does not measure opaque interiors or prove contrast/occlusion. Composition placement lifts spatial packets into the delivered canvas.

Media IR schema 0 carries frame ranges under `extensions["superimg/scene"]`. Scene evidence participates in intent/scene hashes. `scenesAtFrame(ir, frame)` reads the range for a nonnegative encoded frame. Portable packets contain JSON data; handlers and host authority stay outside them. Spatial packets are detached and deeply frozen.

### Recurring subjects

`subjectSet()` binds persistent entities to reusable designs without replacing
`visual`, `Instance`, `Scene` or retained composition. Bound visuals have exactly
three data fields: `design`, `state` and `performance`. The set infers all three
from each visual's data type. Designs and samples must be finite plain JSON data;
snapshots are detached and deeply frozen without freezing caller objects.

```ts
const mug = visual<{
  design: { color: string };
  state: { fill: number };
  performance: { tilt: number };
}>({ id: "mug", render: ({ data }) => drawMug(data) });

const cast = subjectSet({
  designs: {
    ceramic: { of: mug, design: { color: "#d6a46c" }, revision: "mug-design-1" },
  },
  entities: {
    breakfast: { design: "ceramic" },
    counter: { design: "ceramic" },
  },
});

Instance({
  ...cast.sample("breakfast", {
    state: { fill: storySeconds < 5 ? 1 : 0.5 },
    performance: { tilt: 0 },
  }),
  id: "cup-closeup",
  at: { x: 100, y: 200 },
});
```

`sample()` returns `of`, `entityId`, structured `data` and a `binding`. Supply
occurrence `id`, placement, transforms and attachments through the existing
`Instance` API. Samples accept only `state` and `performance`. For an intentional
new appearance, construct a new set snapshot selecting a declared design, with
its revision and optional `appearanceId` / `styleRevision`. Existing sets and
samples remain unchanged. The library does not persist sets or approve updates.

The binding retains entity ID, definition ID, design revision and accepted
design parameters. `Instance` and the scene resolver reject a mismatched entity,
definition ID or design. Portable scene packets retain the binding across
composition placement, and it participates in IR intent hashing. Revision
strings are author/host references, not automatically derived source hashes,
proof of approval or authentication. A definition ID alone does not establish
function equivalence; hosts must still pin the compiled source/resource closure.
Bindings do not validate application-specific numeric ranges or choose acting.

Continuity and performance remain explicit input. Use an intentional work clock
for state carried across cuts and an occurrence clock for local reveals; the
library does not accumulate hidden state or infer prop ownership. Unbound
visuals and instances retain their existing data contracts. See
`examples/showcase/recurring-subjects` for two independent mugs sharing a design
across a cut and an exact square edition.

Keep reusable SVG definitions and their resource references together inside one part. Resource IDs are qualified per part/instance/occurrence. Box existing SVG markup in `Html()` with explicit bounds; interiors stay opaque. External stylesheets, arbitrary scripts and cross-part fragment references need an explicit host/resource design rather than inferred rewriting. Layout content uses an explicit SVG foreignObject and requires browser rasterization.

See `examples/showcase/scene-process` for the same reusable machine/tool/workpiece scene delivered as still, native SVG, video and an interactive experience, including accepted-state tests and measured resolver limits.

This initial implementation has source-reviewed limitations that its current
acceptance fixtures do not cover. Nested scenes and arbitrary layout wrappers
do not yet establish canvas-coordinate evidence; some composition and
interactive boxing paths lose ordinary semantic descriptions or occurrence
qualification. Explicit camera coordinates and fitted camera coordinates have
different origins. Multipart placement offsets use the scene projection basis
rather than the instance's local transform. Overlapping explicit hit regions
follow registration order, and clicking artwork can identify a part rather
than its owning instance. Ordinary semantic metadata collection can freeze
nested caller objects, and structurally copying an authored Scene retains its
original resolver closure. Qualify these cases before relying on them in a
consumer; passing the examples is not a general scene correctness guarantee.
