# SuperImg

Programmatic media framework. TypeScript media programs → destination-ready video, image, GIF, and SVG bundles.

## Skills & agents (video / design)

Use these when building or critiquing SuperImg media — not only the framework skill.

| Name | Kind | Path | When to use |
|------|------|------|-------------|
| **superimg-pipeline** | Skill | `skills/superimg-pipeline/` | Full idea → ship conductor |
| **superimg-brief** | Skill | `skills/superimg-brief/` | Ideate: audience, beats, format |
| **superimg** | Skill | `skills/superimg/` (+ AGENTS managed block) | API: `define()`, director, stdlib, CLI, IR debug |
| **animator** | Skill | `skills/animator/` + `references/` | Motion craft / critique |
| **video-designer** | Skill + agent | `skills/video-designer/` | Heavy creative design (loads superimg + animator) |
| **superimg-review** | Skill | `skills/superimg-review/` | `check`/`inspect` + craft review |
| **superimg-variants** | Skill | `skills/superimg-variants/` | Multi-format outputs / reels |
| **superimg-ship** | Skill | `skills/superimg-ship/` | Render, cache, compile, baseline |
| **superimg-arrangements** | Skill | `skills/superimg-arrangements/` | Perceptual contracts: name the work a picture removes |

**Agent distribution:** canonical sources are root `skills/`, `agents/`, `commands/`. `pnpm --filter @superimg/agent-plugins build` regenerates all adapters (Grok Build, Grok Bot, Codex trees, `openai.yaml`, embedded router copies, command `.toml`); `just check` fails on drift. Claude Code plugin serves from repo root (`.claude-plugin/`); Grok Build via `grok plugin install superimg --trust`; Grok Bot via `.cursor-plugin/marketplace.json` (trusted native CLI dispatch; plugin is knowledge, not a dispatcher). Details: `docs/agent-distribution.md`.

**Routing:**
- Full video from scratch → **superimg-pipeline**
- Framework / CLI / template bugs → **superimg** + `check`/`inspect`
- Should this be a picture / before-and-after / timeline → **superimg-arrangements**
- “Motion feels off” → **animator**
- New scene design / visual redesign → **video-designer**
- QA / “is it ready” → **superimg-review**
- Reel + YouTube + OG → **superimg-variants** then **superimg-ship**

Do not invent CSS keyframes/timers for video templates — motion is pure `render(ctx)` + director/stdlib (see skills).

## Commands

This project uses [Just](https://github.com/casey/just) for task automation. **Always use `just <recipe>` instead of raw pnpm/npm commands.**

| Task | Command |
|---|---|
| Setup (first time) | `just setup` |
| Install deps | `just install` |
| Dev (all packages) | `just dev` |
| Docs site | `just docs` — user MDX in `apps/docs/content/docs`; deep guides in repo `docs/` |
| Run example | `just example <name>` |
| Build package | `just build-pkg <name>` |
| Dev package | `just dev-pkg <name>` |
| Test package | `just test-pkg <name>` |
| **Build render stack** | **`just build-render`** (types→…→cli; required before CLI) |
| **CLI (builds stack first)** | **`just cli <args…>`** e.g. `just cli list` |
| Rebuild render stack | `just rebuild-render` |
| Build all | `just build` |
| Rebuild (clean + build) | `just rebuild` |
| Run tests | `just test` |
| Lint | `just lint` |
| Type-check | `just typecheck` |
| Clean | `just clean` |
| Full check | `just check` |
| Version bump | `just bump` |
| Publish | `just publish` |
| Release workflow | `just release` |

Run `just` or `just --list` to see all available recipes.

### Anti-stale build (agents — critical)

CLI export path is **`@foxworth/superimg-cli` → `@superimg/node` → `@superimg/playwright` → `@superimg/core` / types**. Editing one package and running only `pnpm --filter @superimg/playwright build` leaves **stale dist** downstream; flags and encoders look “ignored.”

| Do | Don’t |
|----|--------|
| `just build-render` after types/core/playwright/node/cli changes | Single-package build then `node …/cli.js` |
| `just cli export … --for …` (always rebuilds stack first) | Assume turbo cached the right graph without rebuild |
| `just rebuild-render` when behavior is “impossible” | Partial `pnpm --filter core` + `cli` only (misses playwright/node) |

**Publishing is manual-only.** npm publishes happen via `just release` / `just publish` from a maintainer machine. GitHub Actions are for testing/exporting only — never add npm publish steps, tokens, or `id-token` permissions to workflows.

## Git

Never add a Claude/Anthropic co-author trailer to commit messages in this repo.

## Video Project Structure

Media programs are `*.media.ts` files discovered anywhere in the project. Their kind is declared by `video()`, `image()`, `svg()`, `ogImage()`, or a compatible bare `define()` definition—not by the filename.

**Examples location**: `examples/<category>/<name>/<name>.media.(ts|js)`

**CLI (preferred — builds the export stack first):**
```bash
just cli list
just cli export examples/basics/hello-world/hello-world.media.js --for youtube
just cli inspect path/to/foo.media.ts --pretty
```

If you already ran `just build-render`, raw CLI works:
```bash
CLI="node ./packages/superimg-cli/dist/cli.js"
$CLI list
$CLI export path/to/foo.media.ts --for youtube
```

| Action | Command |
|--------|---------|
| List all media | `just cli list` |
| Dev/preview | `just cli dev <path>` |
| Export for a destination | `just cli export <path> --for youtube` |
| Inspect (debug) | `just cli inspect <path> --pretty` |
| Export a custom size | `just cli export <path> --for 1200x630.png` |

Output: `output/<name>.export/`

**Requires**: Chromium headless shell via `npx superimg setup` or `just cli setup` (`just setup` is deps + build only). SuperImg pins Playwright to the account cache unless `SUPERIMG_BROWSERS_PATH` or a durable `PLAYWRIGHT_BROWSERS_PATH` is set. `just cli doctor --json` first — run setup only on `CHROMIUM_MISSING`. `CHROMIUM_LAUNCH_DENIED` means leave the OS sandbox, not re-install.

## Debug (templates)

**Prefer `check` then `inspect`** — do not shell many single-frame renders to learn timing.

```bash
just cli check path/to/foo.media.ts --pretty            # pass/fail gate first
just cli inspect path/to/foo.media.ts --pretty
just cli inspect path/to/foo.media.ts --diff 0.35,0.85
just cli inspect path/to/foo.media.ts --at 0.5,0.9 --png
just cli export path/to/foo.media.ts --for youtube      # final delivery
```

| Tool | For |
|------|-----|
| `check` | Default pass/fail: resolve-aware load, footguns, NaN/empty (versioned JSON) |
| `inspect` | Runtime config, director phases, multi-progress text/colors, `--diff` (JSON, no browser by default) |
| `inspect --summary` | Config + phases only (fast) |
| `doctor` / `setup` | Environment / Chromium |
| `export --for WIDTHxHEIGHT.png --at TIME` | One explicit still rendition |
| `list` / `list --shallow` | Enumerate templates (metadata vs paths only) |

Full portable debug guidance lives in the superimg skill (`skills/superimg/SKILL.md` → `superimg skill update`). See also `docs/testing.md`.

After structure looks right, critique motion with the **animator** skill checklist; for major visual redesigns use **video-designer**.

**Footguns:** Prefer **percent** director phases (sum 100%) for still/HTML single-frame paths. Const-bound `duration`/`width`/etc. are AST-folded; dynamic `resolve()` still needs runtime inspect.

<!-- BEGIN superimg-skill v0.1.0 — managed by `superimg skill update`; do not edit -->
# SuperImg

Author media content; select delivery when exporting.

## Choose the helper

| Job | Helper | Defaults |
|-----|--------|----------|
| Video | `video()` | 1920×1080, 30 fps, MP4 |
| Still | `image()` | 1920×1080, PNG |
| Vector | `svg()` | 1920×1080, SVG |
| Open Graph | `ogImage()` | 1200×630, PNG |
| Custom contract | `define()` | explicit |

All helpers lower to canonical `MediaDefinition`. Every helper accepts `size: { width, height }` for custom authored dimensions.

```ts
import { video, Frame, Stack, Text } from "@foxworth/superimg";

export default video({
  duration: "5s",
  sample: { title: "Hello" },
  render(ctx) {
    const t = ctx.director({ in: "20%", hold: "80%" });
    return Stack(
      { width: "fill", height: "fill", align: "center", justify: "center" },
      Text({ variant: "display", motion: t.motion({ y: 24 }) }, ctx.data.title),
    );
  },
});
```

`render(ctx)` returns one typed media tree. **Frame vs Stack:** Frame owns its position (`x`/`y`); Stack is laid out by its parent — never pass `x`/`y` to Stack. Omitted size hugs content; `width: "fill"` / `height: "fill"` when you mean fill.

## Director & Multi-Beat Narrative Timing

Never build manual `BEAT` / `T` timestamp tables. Use `ctx.director()` for both simple phase layouts (`enter` / `hold` / `exit`) and multi-act or overlapping cue windows in seconds:

```ts
// Simple phase layout
const t = ctx.director({ enter: "0.6s", hold: "2s", exit: "0.4s" });

// Multi-act & overlapping cue windows in seconds
const d = ctx.director({
  acts: { title: [0, 3.0], happy: [0.8, 12.6], away: [11.8, 20.6] },
  cues: { hop: [1.0, 1.45], lean: [1.5, 2.0] },
});
const hopP = d.span("hop", "outCubic");
const blinkP = d.span([2.2, 2.5], "inOutCubic");
```

Last act holds by default; pass `exit: true` (or an `exit` phase on that motion's `during`) to leave. Screen tours use `t.beats({ during, of, cross })`. Static image/SVG contexts do not expose temporal APIs. See [references/motion-and-review.md](references/motion-and-review.md) for timing, easing, stagger, and safe-area craft rules.

## Stdlib Essentials (`@foxworth/superimg/stdlib`)

**Never re-implement math, easing, color mixing, safe areas, or responsive helpers in template files.** Import them from `@foxworth/superimg/stdlib` (or access via `ctx.std`):

- **Math & interpolation:** `clamp`, `lerp`, `mapClamp`, `remap`
- **Color:** `mix` (perceptual OKLCH color mixing)
- **Easing:** `easeOutCubic`, `easeInCubic`, `easeInOutCubic` (plus `easeOutExpo`, `easeOutBack`, etc.)
- **Responsive & safe areas:** `createResponsive(ctx)`, `Safe` / `getSafeBox` (broadcast & `social-vertical` 9:16 safe zones)
- **Timing & cascades:** `layoutTimeline`, `readTimeSeconds`, `stagger` (`stagger.ms` for millisecond gaps with automatic `500ms` cascade cap)

## Vector & Typography (No Raw `<svg>` in `Html()`, No Font Outliners)

**Paint** is `Fill` / `Image` / `Video`. **Vector art** is `Vector(...)` with the typed `vector.*` namespace:

- **Primitives:** `vector.circle`, `vector.rect`, `vector.line`, `vector.ellipse`, `vector.polyline`, `vector.polygon`, `vector.path`, `vector.group`, `vector.text`, `vector.run`
- **Defs, masks, clips, paint & filters:** `vector.defs`, `vector.mask`, `vector.clip`, `vector.linearGradient`, `vector.radialGradient`, `vector.stop`, `vector.pattern`, `vector.filter`, `vector.gaussianBlur`, `vector.turbulence`, `vector.displacementMap`

Masks, clips, gradients, and filters take explicit stable ids, and groups/nodes refer to those ids directly without writing `url(#...)`. Feed `std.svg.draw()` and `std.svg.morph()` geometry into `vector.path()` rather than assembling SVG strings. **Never write raw `<svg>` strings inside `Html({ html })`** (flagged by `superimg check` as `RAW_SVG_IN_HTML`). The only markup hole is boxed `Html({ id, width, height, html })` for third-party HTML — never `html` on Frame.

**Typography & native font measurement:**
- `Text`, `Code`, and `vector.text` support `reveal` (`0..1` typewriter/character reveal) natively.
- Local `.ttf`, `.otf`, `.woff`, and `.woff2` files declared in `fonts: [...]` are measured natively — **never write Python `fonttools` scripts to outline fonts into SVG paths.**
- Let one `Text` contain a complete paragraph and let `Stack` flow from its measured height. Avoid character-count wrapping and fixed one-line Frames around text that may wrap. Put highlight paint/padding on a content-sized container. Nonbreaking spaces keep authored quantities/units together.

For developed SVG art files, import `./art.svg?superimg-svg`, call `svgDocument(bytes)`, and place it with `SvgArtwork` or `svgPart` in a Scene. Named edits are bounded; use a unique occurrence id for local definitions. For Canvas or Three, import a typed `NativeSurfaceModule` with `?superimg-surface` and sample it at `ctx.timeline.seconds`. CLI/Node and dev preview support these modules; production Player, browser/edge runtime and schema-0 artifacts refuse them. Opt in to schema 1 when compiling a native Node replay artifact. See [the artwork contract](references/api.md#imported-art-and-native-surfaces) for the limits.

## Charts

For line/time-series and bar charts, import `layout`, `defineChart`, marks and
scales from `@foxworth/superimg/charts`. Return `layout(definition, { id, width, height }).artwork`
inside the media tree. Use explicit mark ids/datum keys; annotations use the
result's points/scales or `pathPoint`, never scraped SVG. Pass explicit director
progress through `motion.lineReveal` / `motion.barsGrow`; do not mount a chart
animation loop. When authoring charts, read [the chart contract](references/api.md#typed-charts)
for typography, supported paint, identity, and legacy helper migration.

## Shared visual scenes

For characters, split scenery, attached props or process diagrams, use `visual()` → `Instance()` → `Scene()`. Supply accepted data and explicit placement; named anchors bind props. Use `entityId` for persistent identity and `id` for the current visual occurrence. Inspect the resolved packet via `@foxworth/superimg/scene`. Read [the shared scene contract](references/api.md#shared-visual-scenes) before authoring projection, camera, semantic hits, or boxed artwork.

## Responsive media

The root render responds to `ctx.width` and `ctx.height` (and `createResponsive(ctx)`). Add an edition only for an exact aspect ratio that needs different art direction:

```ts
video({
  duration: "12s",
  render: renderResponsive,
  editions: {
    square: {
      size: { width: 1080, height: 1080 },
      render: renderSquare,
    },
  },
});
```

Root `variants` are shallow data patches. They never contain size, fps, duration, format, codec, path, or filename.

## Reusable compositions

Use a `Program` when a named part must remain inspectable or be used in another work. `sequence()` orders parts, `together()` places them on one clock, and `choose()` names alternatives. `time()` makes a deterministic video with an explicit canvas, fps, and route for each choice.

```ts
import { sequence, time } from "@foxworth/superimg";

const story = sequence([
  { id: "opener", content: openerImage, hold: "1s" },
  { id: "chapter", content: chapterProgram },
]);
export default time(story, { size: { width: 1920, height: 1080 }, fps: 25 });
```

IDs are stable path segments (`chapter/demo`). Stills need a hold in a timed sequence. A child of a different size needs `fit: "contain"` or `fit: "cover"`. Keep the original Program for another projection; the timed media definition is a final output. For host-controlled selection, pass a Program to `present()` from `@foxworth/superimg/player/program` with `mode: "manual"`; the host owns navigation. See [references/api.md](references/api.md#retained-composition) for placement, routes, scoped collection data, and current resource limits.
Child asset names stay local: two children may each use `ctx.asset("logo")` when they declare portable bytes or an absolute HTTP(S) URL. `time()` gives each occurrence a qualified resource key. Imported child modules cannot use relative asset paths after bundling.
Child audio clips get qualified IDs and root clock offsets; placement ends within the child's authored duration. Use portable audio sources and matching child mix settings. See [references/api.md](references/api.md#retained-composition) for the accepted audio timing rules.

## Collections

Collections batch-materialize deterministic media:

```ts
import { collection, video } from "@foxworth/superimg";
import { loadClips } from "./clips.server";

export default collection({
  entries: loadClips,
  media: video<Clip>({
    duration: "12s",
    render: (ctx) => renderClip(ctx.data),
  }),
});
```

Providers are zero-argument sync/async functions returning complete arrays. Static readonly arrays work too. A required string `id` is automatic; otherwise provide `entryId` as a string-valued key or resolver. Do not infer identity from names, titles, numeric ids, or array positions.

Provider code stays server-only. Never place secrets, Node imports, or large static datasets in the media projection.

## Trust

CLI `check` / `export` / `dev` compile first-party `*.media.ts` in-process. Browser-framework hosts compile those files with their own Rolldown/OXC. Trusted Node hosts use `compileNodeMediaSource` from `@foxworth/superimg-node/source`. Collection providers run in a child Node with an allowlisted env. Export Chromium runs `Html()` scripts (Three / Lottie). Production Player (`render-only`) strips scripts. Untrusted templates are out of scope — see `SECURITY.md`.

Helpers (`video`, `image`, `svg`, `ogImage`, `define`, `collection`) are `@superimg/types` re-exports on `@foxworth/superimg`. Tree nodes (`Frame`, `Stack`, `Text`, `Html`, `Plate`) come from the root `@foxworth/superimg` entry, not `index.shared`. `defineInteractive` is `@foxworth/superimg/interactive/define`. `createDirector` is `@superimg/stdlib` / `ctx.director()`, not a root export. `@superimg/core` is rasterize / IR, not the authoring helpers.

## Interactive media

Interactive media is singular and host-driven:

```ts
import { defineInteractive } from "@foxworth/superimg/interactive/define";

export default defineInteractive<Lesson>({
  guide: lessonGuide,
  render: (ctx) => renderLesson(ctx.data),
});
```

Do not wrap interactive definitions in collections. Author with `@foxworth/superimg/interactive/define`, mount framework-neutral controllers from `@foxworth/superimg/interactive/player`, and import `InteractivePlayer` from `@foxworth/superimg/react/interactive`.

## Dev preview

`superimg dev source.media.ts --variant ID --edition ID` selects one content
projection; the browser also provides variant and edition selectors. Explicit
Default overrides startup selections. HMR keeps the selected projection and the
last accepted output on compile failure. Stills hide playback controls.

Singular interactive media mounts its controller with guide navigation and JSON
root-data patches. Reset preview restores authored sample data and frame zero,
paused. Live interactive state is not an export. Collection preview holds the
selected CLI snapshot; its dev export is disabled until exact snapshot delivery
is supported. Use explicit collection export instead.

## Zero-FFmpeg Visual Review, Debug & Export Loop

**Never shell out to `ffmpeg` or `magick montage` to extract frames or build contact sheets** — `--review` does this deterministically in one command. Run this 3-step loop:

```bash
# 1. Check layout, contrast, SVG usage, and motion craft at target dimensions
superimg check foo.media.ts --for 1080x1920 --craft

# 2. Pre-encode visual review -> generates contact-sheet.png + frame PNGs in .superimg/reviews/...
#    (Omit --at to automatically sample every director act/phase hold!)
superimg inspect foo.media.ts --for 1080x1920 --at 0.8s,1.9s,6.2s --review

# 3. Direct file export + post-encode contact-sheet.png decoded from actual MP4 frames
superimg export foo.media.ts --for 1080x1920 --review -o foo-9x16.mp4
```

In this repo use `just cli` (builds the render stack first). Elsewhere: `npm i @foxworth/superimg` and `npm i -D @foxworth/superimg-cli`, then `npx superimg <cmd>`. One-off: `npx @foxworth/superimg-cli <cmd>`.

`just cli doctor --json` before setup or export. Run `npx superimg setup` only on `CHROMIUM_MISSING`. `CHROMIUM_LAUNCH_DENIED` means leave the OS sandbox — do not re-install.

`check` goes red on layout and authoring issues (`ZERO_BOX`, `EMPTY_CONTAINER`, `TEXT_OUTSIDE_PARENT`, `FLOW_TEXT_LINE_OVERLAP`, `RAW_SVG_IN_HTML`, `IDENTITY_FLICKER`, `UNPAINTED_STAGE`, `LOW_CONTRAST_TEXT`, `SPARSE_FOCAL`) as well as empty/NaN HTML. Uncolored Text on an unpainted stage fails `UNPAINTED_STAGE` / `LOW_CONTRAST_TEXT` — paint a `Fill` and set Text color (default ink `#111827`). Square chat stills (`1080x1080`, `instagram-square`) fail `MISSING_EDITION` unless the root is already square or `editions.square` exists — do not letterbox landscape art. Tiny ink on a square stage fails `SPARSE_FOCAL`.

`--for` on `check`, `inspect`, and `export` accepts organic destination ids (`youtube`, `instagram-square`, `tiktok`, `linkedin`, `facebook`, `x`, `pinterest`, `threads`, `reddit`) or `WIDTHxHEIGHT[.format]`. Pass `-o <path>` on single-artifact exports to write directly to a file path while keeping atomic bundle publication. Collections export all entries by default; repeat `--entry` to restrict them. Animated-to-still requires `--poster` or `--at TIME` in **seconds** (`0s`, `1.5s`, `1500ms`). Inspect/check `--at` accepts explicit `1.5s`, `1500ms`, `45f`/`f:45`, or explicit progress such as `50%`.

Attaching a picture to a message is a different job: `superimg check spec.json` then `--for 1080x1080.png` renders a perceptual arrangement straight from JSON, no `*.media.ts` needed. See the `superimg-arrangements` skill.

For particles, camera travel, or procedural material, use `inspect <media> --review --review-clips --json` and a co-located `*.review.ts` plan. Read [references/motion-and-review.md](references/motion-and-review.md) for the complete timing, easing, stagger, safe-area, and critique reference, and [references/api.md](references/api.md) for the full public contract.

## Library runtime

Use `@foxworth/superimg/runtime` when code already has an authored media value:

```ts
import launch from "./launch.media";
import { init, check, inspect, render, exportMedia, shutdown } from "@foxworth/superimg/runtime";

await check(launch);
await inspect(launch);
const html = await render(launch, { as: "html" });
await html.bytes();
const bundle = await exportMedia(launch, {
  for: ["youtube", "instagram-square"],
});
try {
  for (const artifact of bundle.artifacts) {
    // artifact.path is relative; artifact.stream() is a byte stream.
    await artifact.bytes();
  }
} finally {
  await bundle.dispose();
}
await shutdown();

const runtime = await init();
await render(launch, { runtime, as: "png" });
await runtime.dispose();
```

Calls are media-first. Omit `runtime` to use one shared runtime. Node disposes
that runtime after 2 seconds with no in-flight call. `shutdown()` disposes it
immediately. Pass `options.runtime` for a runtime from `init()`. `data` is a
partial of the media value's data type. `render` `as` is `html`, `svg`, `png`,
`jpeg`, `webp`, `mp4`, `webm`, `mov`, or `gif`. Animated formats return one
artifact's bytes. Results and artifacts expose `stream()`, `bytes()`, `blob()`,
and `text()`. `text()` rejects with `NOT_TEXT` for a non-text MIME type.
`renderResponse()` returns a `Response` with content-type, content-length, and
an etag of the SHA-256.

`check` and `inspect` do not execute collection providers by default. `render`
produces one exact result. `exportMedia` performs its own complete preflight.
The portable bundle owns unpublished artifacts and remains readable after the
runtime is disposed; dispose it separately.

## Host interactions

Node project hosts use `await createNodeMediaInteractionSession({ projectRoot })`
from `@foxworth/superimg-interactions` (the `@foxworth/superimg-interactions` package). Use `session.mount`
for dispatch and `await session.dispose()` after admitted work finishes. The session
pairs the mount and its runtime in one kernel; do not pass a runtime from
`@foxworth/superimg/runtime.init()` to the lower-level source mount. Its interaction ids
are `media.project.discover`, `media.source.describe`, `media.source.check`,
`media.source.inspect`, `media.collection.snapshot`, `media.artifact.compile`,
and `media.export`. Discovery, description, check, and inspect never run
providers. Snapshot freezes one provider execution; compile publishes one
schema-0 Media IR artifact; export consumes that snapshot and the runtime bundle
before returning a durable publication receipt. Boundary control, durable
recovery, public URLs, and deployment stay host-owned.

Exact source edits dispatch the Edit Program, not a file rewrite:

```bash
just cli edit bindings launch.media.ts --json
just cli edit set-node-transform --command command.json
just cli edit trim-scene-end --command command.json
just cli edit set-phase-boundary --command command.json
```

Ids are `media.edit.bindings`, `media.edit.set-node-transform`,
`media.edit.trim-scene-end`, and `media.edit.set-phase-boundary`. Bindings
first; mutating commands carry the current intent hash and source hashes.
Trusted CLI uses `createNodeEditInteractionMount()`. Expressions, spreads, and
imported targets stay inspect-only.

For long exports, `ExportOptions.onProgress` observes portable
`ExportProgressEvent` values at the `runtime.render` stage. Interaction hosts use
`MediaInteractionProgressOptions`, `MediaInteractionProgressRecord`, and
`createMediaInteractionProgressReporter()` to add execution identity, ordering,
elapsed time, stages, items, and exact work. Totals are optional; show a
heartbeat when unknown and never invent a percentage or `/0`. Progress is
observation only: cancellation remains an `AbortSignal`, while authority,
retry, uncertain-effect reconciliation, and schema-0 receipts remain separate.

## Driven playback (omakase)

**Live browser inspection:** when selecting frames, navigating a preview, or
capturing browser evidence, read [references/api.md#browser-inspection](references/api.md#browser-inspection).
Use the host's `@foxworth/superimg/inspection` surface; enter persistent inspection mode,
await the accepted frame and resources, capture, and verify the same revision.
For persistent edit-and-inspect work and comparable evidence, read
[references/live-browser.md](references/live-browser.md). In this repository,
`just browser-inspect` uses the same capture procedure as the acceptance tests.

Author the motion. One geometry, many materials. Teach the lockup (draw-on → hold) before a comic tour. If the mark jumps, it is a montage.

- `drive="scroll"` — page story. Sticky player, tall parent. We measure travel.
- `drive="pointer"` — follow or scrub. X across the player box.
- Do not ask about springs, atlas vs chroma, fps, or scroll length.
- `Plate({ src })` only when a real short clip must be the subject. `superimg plate <file>`. Page owns the background.
- Never put `drive` on `InteractivePlayer` or stills.
- Examples: `examples/apps/lockup-scroll`, `examples/apps/lockup-pointer`.
<!-- END superimg-skill -->
