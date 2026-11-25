# API

## Authoring

```ts
import {
  define,
  video,
  image,
  svg,
  ogImage,
  collection,
  compose,
  sequence,
  together,
  choose,
  time,
  replaceOccurrence,
  diffCompositionSchedules,
  source,
} from "@foxworth/superimg";
```

### `video(input)`

Animated HTML media. Defaults to 1920×1080, 30 fps, temporal once, and MP4 fallback. `duration` is required; `fps`, `temporal`, and `size` are optional.

### `image(input)`

Static HTML media. Defaults to 1920×1080 and PNG fallback.

### `svg(input)`

Static SVG media. Defaults to 1920×1080 and SVG fallback.

### `ogImage(input)`

Static HTML media. Defaults to 1200×630 and PNG fallback.

### `define(input)`

Lower-level deterministic authoring. All helpers return its canonical `MediaDefinition` shape.

### Shared input

```ts
{
  size?: { width: number; height: number };
  sample?: Data;
  resolve?: ({ data }) => { duration?: Duration };
  editions?: Record<string, {
    size: { width: number; height: number };
    render?: RenderFunction;
  }>;
  variants?: Record<string, Partial<Data>>;
  render(ctx): MediaElement;
}
```

`editions` provide exact-aspect art direction. The root render handles every other requested canvas. `variants` are shallow content patches and cannot contain delivery or clock fields.

## Typed vector artwork

Import `Vector` and `vector` from `@foxworth/superimg`. `Vector` owns a layout box; its children
use SVG coordinates. Shapes include `vector.path`, `vector.circle`, and
`vector.rect`. `vector.viewport` creates a nested native SVG viewport with `x`,
`y`, dimensions, and `viewBox`; it does not introduce a CSS layout box.

Definitions include `vector.linearGradient`, `vector.stop`, and `vector.pattern`.
Effects use `vector.filter`, `vector.gaussianBlur`, `vector.merge`,
`vector.mergeNode`, `vector.turbulence`, and `vector.displacementMap`. Groups
inherit typed paint properties. SVG nodes support `data-*` and `aria-*` metadata.
Resource references use stable ids. Browser presentation still purifies typed
vector output; these primitives do not grant markup an unchecked trust flag.

### Imported SVG artwork

Import an SVG as bytes and edit named parts without rewriting the source:

```ts
import { image, svgDocument, SvgArtwork } from "@foxworth/superimg";
import source from "./cup.svg?superimg-svg";

const cup = svgDocument(source);
export default image({
  render: () => SvgArtwork({
    document: cup, id: "cup-left", width: 320, height: 240,
    edits: { glaze: { fill: "#83a994" }, label: { text: "Tea" } },
  }),
});
```

`id` identifies this occurrence and scopes its local definitions and references;
use a different occurrence id for each placement. `only` selects a named painted
subtree with its ancestors and definitions. `svgPart()` places a document or
selected part into an existing `visual`/`Scene` in its original viewBox coordinates.
The SVG viewBox and supported `preserveAspectRatio` alignment are retained.
Edits cover literal paint, existing local linear and radial gradients and patterns, plain
text, selected numeric geometry, path data and translation. IDs must be unique.
`svgDocumentIdentity()` reports separate source and edited revision hashes.

This is a bounded document import, not universal SVG interchange: external
resources, CSS/style attributes, scripts, animation, `foreignObject`, and
`xml:base` are refused. Unsupported elements and root attributes are rejected
when realizing the artwork. Use the whole-file image/SVG route for artwork that
does not need these named edits, and qualify its renderer separately.
Paint edits accept hex and fixed CSS named colors, `none`, `transparent`, or a
local gradient/pattern reference such as `url(#glaze)`. CSS color functions and
host-dependent values such as `currentColor` are not accepted as edits.

Declare fonts used by imported SVG text on the media definition. Node still
rasterization maps declared family, weight and style to the font face. For SVG
text using a variable font or a format-1 font name table, the Node runtime uses
Chromium for capture; those cases require an available browser. Supported static
font collections select the declared face for Node still and video output; SVG
stills can render without Chromium. The edge SVG rasterizer also uses declared
font faces when it has a configured resvg runtime. A collection
whose face metadata cannot be interpreted reliably is refused; provide a
standalone font instead. Renderer support varies with the artwork and font, so inspect the
exported result when fidelity matters.

### Native Canvas and Three modules

For a world that needs Canvas or Three, export an ordinary typed module and import
it with `?superimg-surface` from a trusted media source. The module's `create`
receives the canvas, dimensions and pixel ratio; its `sample` receives absolute
scene-local seconds and data, and `dispose` releases its resources. Do not rely on
the order in which frames are sampled. The source compiler prepares the full module
closure, including dynamic imports, and the host serves it during capture.

The surface normally holds capture until creation and sampling finish. Use
`wait: false` only when another mechanism determines readiness: capture may then
occur before its pixels are painted. A surface removed while loading is cancelled
and does not create a late instance. A plain identifier supplied as `wait` names
the readiness signal without changing the surface's retained identity.

```ts
// world.ts
import type { NativeSurfaceModule } from "@foxworth/superimg";
export default {
  create({ canvas }) {
    const ctx = canvas.getContext("2d")!;
    return {
      sample({ seconds }) { ctx.fillStyle = seconds < 1 ? "red" : "blue"; ctx.fillRect(0, 0, 64, 64); },
      dispose() {},
    };
  },
} satisfies NativeSurfaceModule<Record<string, never>>;
```

```ts
// scene.media.ts
import { NativeSurface, video } from "@foxworth/superimg";
import world from "./world.ts?superimg-surface";
export default video({ size: { width: 64, height: 64 }, duration: "2s",
  render: ctx => NativeSurface<Record<string, never>>({
    id: "world", module: world, width: 64, height: 64,
    seconds: ctx.timeline.seconds, data: {},
  }),
});
```

CLI/Node export and dev preview support this source journey. Production Player,
browser/edge runtime and schema-0 artifacts explicitly refuse native modules;
they do not execute a compiler or grant native scripts authority. Node hosts with
an already prepared value can supply the declared module set without compiling.
See the `celadon-pavilion` example for a Three world and explicit GPU cleanup.

For plain Node with an already-built browser module closure,
`prepareNativeSurface` supplies the bridge and derives the resource identity.
The host must provide the complete emitted JavaScript and asset files; this
helper does not compile TypeScript or discover dependencies.
When a file named `world.js.map` accompanies `world.js`, its source-map
metadata is retained; malformed sidecar maps are refused.

```ts
import { readFile } from "node:fs/promises";
import { image, NativeSurface } from "@foxworth/superimg";
import { prepareNativeSurface, render } from "@foxworth/superimg/runtime";

const world = await prepareNativeSurface({
  entry: "world.js",
  files: { "world.js": await readFile("./dist/world.js", "utf8") },
});
const scene = image({ size: { width: 64, height: 64 },
  nativeModuleSets: world.nativeModuleSets,
  render: () => NativeSurface({ id: "world", module: world.module,
    width: 64, height: 64, seconds: 0, data: {} }),
});
const png = await render(scene, { as: "png" });
```

For a Vite Node SSR application, the host can prepare the same source import
as part of its normal module loading. Pass its Vite `build` function to the
plugin; no separate generated file or per-edit build command is needed:

```ts
// vite.config.ts
import { build, defineConfig } from "vite";
import { nativeSurfaceVite } from "@foxworth/superimg/vite";
export default defineConfig({ plugins: [nativeSurfaceVite({ build })] });
```

```ts
// scene.media.ts, loaded by the Vite Node SSR host
import { image, NativeSurface } from "@foxworth/superimg";
import world from "./world.ts?superimg-surface";
export default image({ size: { width: 64, height: 64 },
  nativeModuleSets: [world],
  render: () => NativeSurface({ id: "world", module: world,
    width: 64, height: 64, seconds: 0, data: {} }),
});
```

The plugin builds a complete browser closure using a separate Vite build and
watches its loaded source files. Broken current source fails loading; the
application owns any last-good preview and its error UI. This integration is
for trusted Node SSR, not browser or edge execution. The nested world build
does not automatically inherit application plugins or aliases. Pass the world
build's needed `resolve` and `plugins` explicitly through the plugin's `world`
option, for example `nativeSurfaceVite({ build, world: { resolve: { alias },
plugins: [worldPlugin] } })`. Supply only plugins appropriate for the browser
world build, not the native-surface plugin itself.
If a watched world changes during its build, the plugin discards that output
and retries the current source up to three times; continued changes return an
error rather than a stale module.

To save a native world as a replayable Node artifact, use
`superimg compile scene.media.ts --artifact-version 1`. Schema 1 retains the
prepared module files and source maps and verifies their identities on read;
older schema-0 readers reject that version. Omit the option for the existing
schema-0 format. Artifact versioning does not change Player or browser/edge
script policies. Project-local declared assets, fonts and audio are vendored at
compile time; artifact replay uses their verified saved bytes instead of the
source paths. Conflicting audio bindings are rejected during compilation.

Existing programs and schema-0 artifacts that use `std.viz.three.scene()` retain
their compatibility loader. Node and CLI capture serve the helper's pinned
Three module from the installed package instead of fetching it from a CDN.
The string helper is no longer part of the public
stdlib authoring type. For new work, move its setup body into `create()`, its
per-frame body into `sample({ seconds, data })`, and its resource cleanup into
`dispose()`. Import Three normally in that module. If the old animation used
progress, compute it from scene-local seconds and the authored duration. See
`examples/marketing/code-galaxy` for a migrated example.

| Previous helper behavior | Native module migration |
| --- | --- |
| Default perspective camera and renderer | Create the camera and renderer explicitly in `create({ canvas, width, height, dpr })`; set pixel ratio and canvas size there. |
| `background` on the canvas wrapper | Paint a surrounding `Frame` or set the Three scene background. The native canvas has no implicit dark background. |
| `progress` available inside string bodies | Pass `ctx.timeline.progress` in the surface's `data`, or calculate progress from `seconds` and the authored duration. Sample absolute time so out-of-order seeks reproduce the same state. |
| `asyncSetup` and readiness label | Make `create` asynchronous when loading resources; capture waits by default. `wait` names the signal, and `wait: false` opts out. |
| Automatic traversal and GPU cleanup | Release owned geometry, materials, textures, environment targets and renderer in `dispose`; account for shared resources so each is released once. |
| Built-in Three CDN and string helpers | Import the host's chosen Three version and call its APIs directly. The host supplies its browser module closure and any declared assets. |

## Typed charts

`@foxworth/superimg/charts` exports TanStack definitions/marks/scales and
`layout(definition, { id, width, height, theme?, typography?, measureText?, motion? })`.
The result contains typed `artwork`, retained `scene`/`points`, diagnostics,
`point(key)`, `mark(markId)`, `project(channel, value)` and `pathPoint(key, progress)`.
Supply explicit datum keys and occurrence ids. SuperImg owns time: line reveal
and signed bar growth use explicit progress; there is no mounted chart clock.
See [Typed charts](charts.md) for rendering limits, annotation geometry and the
line/bar migration.

## Retained composition

`sequence`, `together`, and `choose` create a reusable `Program` with named child occurrences. `time` projects that program to a deterministic video definition. Keep the program value when making another projection; a timed projection is a final media definition, not a child.

```ts
import { sequence, time } from "@foxworth/superimg";
import opener from "./parts/opener.media.js";
import demo from "./parts/demo.media.js";
import result from "./parts/result.media.js";

export const chapter = sequence([
  { id: "demo", content: demo },
  { id: "result", content: result, hold: "1s" },
]);

export const story = sequence([
  { id: "opener", content: opener, hold: "1s" },
  { id: "chapter", content: chapter },
]);

export default time(story, { size: { width: 1920, height: 1080 }, fps: 25 });
```

Every sibling `id` is unique and becomes a qualified path such as `chapter/demo`. Stills need an explicit `hold`. Animated children keep their own fps; the projection samples their native frames on the output clock. A nested Program can have a shallow `data` patch and a longer `hold` that keeps its final frame. When a child canvas differs from its target, use `fit: "contain"` or `fit: "cover"` to map its authored canvas, or `fit: "reflow"` to render the leaf at its immediate target dimensions. Reflow also works inside nested placement: outer rectangles then map that target into the parent canvas. The authored Program canvas is fitted with `contain` when an export destination has different dimensions, while child canvases and clocks stay authored. The timeline uses exact integer frame ranges. Inspection retains the tree, selected routes, local clocks, and placement even when the current IR scene lane must be flattened for rendering.

Place children on the same clock with explicit rectangles and end behavior:

```ts
const comparison = together([
  { id: "before", content: before, rect: { x: 0, y: 0, width: 960, height: 1080 }, fit: "contain" },
  { id: "after", content: after, rect: { x: 960, y: 0, width: 960, height: 1080 }, fit: "contain" },
], { end: "hold" });

const comparisonVideo = time(comparison, { size: { width: 1920, height: 1080 }, fps: 25 });
```

`end: "hold"` keeps a shorter child's last frame visible through the group end; `end: "hide"` removes it when its content ends. `together` supports HTML and SVG leaves. A child may itself be a sequence or another `together`; nested placements retain their coordinate transforms. Give a reusable group an explicit `{ size: { width, height } }` so its authored canvas stays stable when placed at different sizes. Each placement declares `contain`, `cover`, or `reflow`.

Choose one route for a timed export; the other branches remain in the inspected structure:

```ts
const lesson = sequence([
  { id: "question", content: question, hold: "1s" },
  { id: "explanation", content: choose({ beginner, advanced }) },
  { id: "closing", content: closing, hold: "1s" },
]);

const beginnerVideo = time(lesson, {
  size: { width: 1280, height: 720 }, fps: 25,
  routes: { explanation: "beginner" },
});
```

An export must select every choice by its qualified path. Child `sample` is overlaid by occurrence `data`, then by the entry's `uses[path]`. A collection can render a family of complete compositions with `time<Entry>(program, options)` and entries such as `{ id: "a", uses: { "chapter/demo": { title: "A" } } }`. Root entry data keys other than `id` and `uses` are rejected so values cannot silently spill into every child.

Replace a part without mutating the original program, then compare timed ranges:

```ts
const revised = replaceOccurrence(story, "chapter/demo", newDemo);
const before = time(story, { size, fps });
const after = time(revised, { size, fps });
const diff = diffCompositionSchedules(
  before.composition!.schedule,
  after.composition!.schedule,
  ["chapter/demo"],
);
// diff.changed names the replacement; diff.shifted names later moved parts.
```

The diff is conservative. It reports `cacheSafe: false`; schedule equality alone does not prove equal pixels. A long-lived Node host can opt into a bounded captured-frame cache on `createNodeRuntimeAdapter({ compositionFrameCache: { schemaVersion: 1, runtimeVersion, identity } })`. `identity({ path, media })` must return a stable `{ id, version }` for every active child; the host must change `version` whenever that child's render behavior or owned bytes change. The cache keys active child identity, data, sampled frame, placements, output settings, CSS, fonts, and assets. Later branch or child changes can reuse an earlier unchanged frame. A hit skips child rendering and Chromium capture for that frame; encoding still runs. Missing identity or no opt-in means ordinary rendering. This cache does not make `diffCompositionSchedules().cacheSafe` true.

Child `resolve()` runs once per selected occurrence and job after scoped data is applied. Its returned duration updates the parent schedule before rendering. The authored child needs a provisional duration so `time()` can form an initial synchronous media definition.

Child assets keep their local names inside `render(ctx)`. `time()` promotes portable declarations to root keys such as `chapter/demo/logo`, so two children can each call `ctx.asset("logo")` without sharing bytes. Declare a child asset with explicit `{ bytes, mimeType }` or an absolute HTTP(S) URL. For relative sources, call `rebaseCompositionSources(program, { "chapter/demo": new URL("./parts/demo/", import.meta.url) })` before `time()`. The map keys are qualified leaf paths; each base must be an absolute file or HTTP(S) URL. This clones the Program and resolves relative asset, font, and audio sources without guessing from the process directory. Hosts can instead import `prepareProgram` from `@foxworth/superimg/composition/prepare` and provide `sourceBases` and an asset provider; preparation is per job and returns occurrence-qualified declarations and a prepared Program. See [the same-name asset example](../examples/composed/namespaced-assets/) and [the relative-source example](../examples/composed/portable-stage/).

Direct files are ordinary reusable definitions. `source.image({ src, size, fit })` and `source.svg({ src, size, fit })` accept an absolute `file:` URL or `{ bytes, mimeType }`. `source.video({ src, size, fps, duration, trim?, fit? })` uses the same source forms and samples video frames deterministically. Pass a positive duration, or `trim.to` to derive one. Video source audio is not included; add an explicit child audio clip when needed. Source bytes are copied at construction, and the render job freezes file URL bytes before export.

```ts
const still = source.image({ src: new URL("./cover.png", import.meta.url), size: { width: 1200, height: 800 } });
const clip = source.video({
  src: new URL("./demo.mp4", import.meta.url),
  size: { width: 1920, height: 1080 }, fps: 24,
  trim: { from: "1s", to: "4s" }, fit: "cover",
});
const reel = sequence([
  { id: "cover", content: still, hold: "2s", fit: "contain" },
  { id: "demo", content: clip },
]);
```

The same Program can drive a manual deck or one continuous Player timeline. The
host selects the projection and owns navigation, scrolling, route changes, data,
and external effects. `present()` is an optional browser entry; its session
keeps named parts and qualified child paths available to the host.

```ts
import { Player } from "@foxworth/superimg/player";
import { present } from "@foxworth/superimg/player/program";

const player = new Player({ container: element });
const deck = present(player, story, {
  mode: "manual", size: { width: 1920, height: 1080 }, fps: 25,
});
await deck.ready;
await deck.setData("chapter/demo", { title: "Updated" });
await deck.go("chapter");
await deck.previous();
deck.dispose();
player.dispose();
```

For a timed or scroll-driven presentation, use `mode: "timeline"` with the same
Program. Configure the Player drive separately, for example
`new Player({ container: element, drive: "scroll" })`; `present()` retains one
timed projection and seeks named parts on that Player. `session.snapshot()`
exposes the current part, selected routes, scoped data, and interactive child
snapshots. An interactive child made with `defineInteractive()` can appear in a
Program. The host can call `session.setScene("chapter/lesson", scene)` and
subscribe with `session.on("action", event => ...)`; action events include the
qualified child path. A timed export requires explicit route selection; browser
scene state belongs to the host. For the branching lesson above, the host can
start with `routes: { explanation: "beginner" }` and later call
`session.choose("explanation", "advanced")`.

Browser hosts with file-backed children can call `prepareProgram(program,
{ size, fps, routes, sourceBases, assets })` from
`@foxworth/superimg/composition/prepare` before `present()`. This prepares one job's
selected occurrences and returns `program`, `plan`, `composition`, and
`assetDeclarations`. Re-prepare when
the host changes a route whose children need different file sources.

Child audio clips move onto the root clock. Their IDs are prefixed with the occurrence path, `at` is offset by the child's start frame, and each placement is bounded to the child's authored duration (including when `together({ end: "hold" })` keeps its final visual frame). Simultaneous children mix at the same root time. Child mix options must agree; child `atScene` is rejected. Audio `src` accepts a data URL, HTTP(S) URL, file URL, or absolute file path; a relative path needs an explicit source base as above. See [the audio sequence](../examples/composed/audio-sequence/).

Selected child fonts are deduplicated and lifted to the timed root; relative local font paths need an explicit source base. A `Use` can select a child's `variant` and `edition`, which remain visible on its scheduled leaf. Child `inlineCss` and `stylesheets` lift to the one root document, so selectors can affect other children; authors should scope their selectors. Identical Tailwind settings lift once, while conflicting settings fail. Child background, watermark, and readiness settings remain unsupported. The older `compose()` keeps its existing behavior for authored works that depend on it.

Runnable examples: [story and deck](../examples/composed/story-kit/), [direct file sources](../examples/composed/direct-sources/), [mixed still and animated sizes](../examples/composed/mixed-media/), [split screen and picture in picture](../examples/composed/comparison/), [nested comparison](../examples/composed/nested-comparison/), [relative sources, child editions, SVG, and nested reflow](../examples/composed/portable-stage/), [branching lesson](../examples/composed/path-lesson/), [per-entry data family](../examples/composed/data-family/), [same-name child assets](../examples/composed/namespaced-assets/), and [child audio](../examples/composed/audio-sequence/).

## Collections

```ts
collection({
  entries: readonly Entry[] | (() => readonly Entry[] | Promise<readonly Entry[]>),
  entryId?: keyof Entry | ((entry: Entry) => string),
  media: DeterministicMediaDefinition<Entry>,
})
```

A required string `id` field is automatic. Otherwise `entryId` is required. Returned entry objects pass unchanged to `ctx.data`. Nested and interactive collections are rejected.

## Destinations

`@foxworth/superimg/destinations` exports the schema-0 organic catalog, lookup helpers, and custom target parser. Custom syntax is `WIDTHxHEIGHT[.format]`.

## Interactive

```ts
import { defineInteractive } from "@foxworth/superimg/interactive/define";
import { createInteractivePlayer } from "@foxworth/superimg/interactive/player";
import { InteractivePlayer } from "@foxworth/superimg/react/interactive";
```

Interactive definitions are singular live experiences with a guide and host-supplied data. The package owns semantic scenes, actions, hit targets, navigation, checks, and guide layout.

Optional `mediaCapabilities: { version: 0, names }` metadata belongs to compilers
and hosts. Interactive lowering and runtime wrappers preserve it, including an
explicit `names: []`. Host compilers determine capabilities from unminified code
and stamp the realized definition for runtime preparation. The `defineInteractive()`
authoring input is unchanged.

`controller.load(media, { data, assets, assetResolver, fonts })` accepts the same
host resource bindings as `Player.load()`: asset metadata, a filename-to-URL
resolver, and pre-resolved fonts. `InteractivePlayer` accepts these as React
props. Changing a resource prop's identity reloads that mounted session; keep
bindings stable across data changes. Keep live host data in a complete nested
record such as `{ projection }`; `controller.setData({ projection })` replaces
that record and repaints the current guide step.

`controller.update({ data?, size?, sceneStyle? })` changes live inputs in one
accepted presentation without loading a new definition. Data patches root fields;
nested records replace, so omitted root fields remain. `setData(data)` uses the
same merge behavior. Omit `sceneStyle` to retain it; pass `sceneStyle: undefined`
to clear it. A successful update retains guide position, playback and scene/camera
commands. Failed updates restore accepted data/style/size; attempted scene commands
still follow the persistence rules below. A successful replacement `load()` starts
the new definition with fresh scene commands, state and camera.

React `InteractivePlayer` reconciles `data`, explicit numeric `size` and
`sceneStyle` on the mounted controller. Definition, renderer, resource bindings,
playback/trust settings, and switching between explicit and authored sizing remain
structural session changes. Unstarted prop replacements may coalesce; imperative
`ref.setData()` calls keep their own acceptance promises. Disposed sessions cannot
publish stale callbacks or complete an old update against a replacement session.

`controller.scene.set/apply/camera` capture command values when called. Node
overrides retain only the latest touched fields per target and persist across
guide/data changes; `scene.reset()` clears overrides, state and camera. Later
mutation of a submitted object requires another command to take effect. Each
command still requests a render, and a failed render retains its attempted input.
See [persistent host commands and migration](semantic-scenes.md#persistent-host-commands)
for merge rules and the unchanged low-level operation-array contract.

`controller.sceneSnapshot` and the `sceneupdate` event expose immutable semantic
snapshots from accepted presentations. During a pending render or data update,
the last accepted snapshot remains available, `sceneupdate` waits for acceptance,
and native actions are suppressed. `player.getPresentation().isPending`
distinguishes pending updates even when the requested frame is unchanged. Player
always supplies a boolean; a legacy host that omits it cannot qualify actions.
A failed render remains pending until a successful repaint. A replacement load
keeps the last accepted session and its actions active until the candidate commits;
a failed candidate leaves that session intact.

`SceneActionEvent` retains `action`, `nodeId`, and `frame`, and adds
`presentation: { generation, revision, frame, sceneId }` for the accepted render
that declared the action. Only visible semantic nodes declaring that action can
emit it. `ProgramActionEvent` carries the same presentation identity and retains
its qualified child `path`; Program interactive snapshots also come from accepted
presentations. Hosts own data changes and external effects triggered by these
events.

## Runtime

```ts
import media from "./card.media";
import { check, inspect, render, exportMedia, shutdown } from "@foxworth/superimg/runtime";

await check(media);
await inspect(media);
const html = await render(media, { as: "html", data: { title: "Launch day" } });
const bytes = await html.bytes();
const bundle = await exportMedia(media, { for: ["open-graph"] });
await bundle.dispose();
await shutdown();
```

Calls take the media value first. `options.runtime` selects a runtime from `init()`;
omitted, calls share one lazily created runtime. Node disposes that runtime after
2 seconds with no in-flight call. `shutdown()` disposes it immediately.
`check` and `inspect` accept deterministic, collection, and interactive values.
`render` returns one exact document, still, or in-memory animated result (`mp4`,
`webm`, `mov`, `gif`). `data` is a partial of the media value's data type.
`exportMedia` performs complete preflight and returns an unpublished, URL-free
bundle. Results and artifacts expose `stream()`, `bytes()`, `blob()`, and `text()`.
`text()` rejects with `NOT_TEXT` for a non-text MIME type. Dispose the bundle
after its consumer finishes reading it. `renderResponse()` returns a `Response`
with content-type, content-length, and an etag of the SHA-256.

Request-time hosts that already have a media value and need only one synchronous
HTML frame fragment can use the capability-free surface:

```ts
import { renderToHtml } from "@foxworth/superimg/runtime/html";

const html = renderToHtml({ media, data });
```

This entry does not initialize a runtime, execute collection providers, fetch
fonts, rasterize, publish artifacts, or acquire host authority.

Browser-framework hosts compile `*.media.ts` with their own Rolldown/OXC.
Trusted Node hosts can compile sources with `compileNodeMediaSource` from
`@foxworth/superimg-node/source`. `@foxworth/superimg/react/compile` is only the React
authoring shell used by SuperImg's own playground.

Node project hosts import `@foxworth/superimg-interactions` from the `@foxworth/superimg-interactions` package. It exports three independently
compiled interaction sets, dispatch-only mounts, Installations, durable
Projections, and optional Control request contributions. SuperImg owns media
semantics, source inspection and exact editing, portable bundles, package
execution, and recovery rules. Boundary Host owns identity, admission, binding,
revocation, and request-mode proposals. The value-first runtime contract does
not change.

See [Native Media Interactions](./interactions.md) for the four paths, interaction
vocabulary, and downstream host ownership boundary.
