# RFC: Story Platform Ergonomics for SuperImg (`superimg-public`)

- **Status:** Proposal (for review — no implementation started)
- **Date:** 2026-11-23
- **Context:** Building **Fireside** (`@fireside/story` + multi-tenant Next.js / Vercel Platforms cloud studio) on top of SuperImg, with **Sunday Companions** as the flagship tenant and arbitrary non-pixel-art story styles as first-class citizens.
- **Evidence base:** Direct audit of `superimg-public` (`packages/superimg-film`, `packages/superimg-script`, `packages/superimg-player`, `packages/superimg-browser-export`, `packages/superimg-node`, `packages/superimg-edge-runtime`, `packages/superimg-next`, `packages/superimg-stdlib`, `packages/superimg-core`, `packages/superimg-cli`, `packages/superimg`) and production usage in `sunday-companion-media` (`PLAN.md`, `EXECUTION.md`, `series/`, `films/`, `app/`).

---

## Executive Summary

The 11-milestone `film-layer` work proved that script-driven film authoring (`*.script.md` → `film()` → cues, stills, continuity checks, dailies, and takes) works in production across a real catalog of films. However, auditing the actual code reveals that the current stack is still shaped around a **local Vite + CLI + Familiar Zig rig + pixel-art SVG-string workflow**.

Building a general-purpose, multi-tenant cloud studio like Fireside exposes four structural friction points in `superimg-public`:

1. **Film compilation assumes local bundler plugins and trusted JS shot modules.** `film()` cannot accept raw Markdown or `filmScript()` output without type friction, `parseScript()` ignores header fields on `shot` blocks, `film()` drops script header fields (`do:`, `mood:`, `camera:`, `sfx:`, `music:`) from `ShotLine`/`ShotContext`, and there is no data-first shot seam for untrusted tenant stories.
2. **Several core `film()` features leak Sunday Companions' pixel-art assumptions or break outside CLI `check`.** `cueFindings` (including `MISSING_GLYPH`) are silently ignored by `runtime.check()` and `exportMedia()`; `film.ts` hardcodes `shape-rendering="crispEdges"` and always emits an empty `Html("fable-lettering")` node (which forces every still off the fast Edge/resvg SVG lane); `vector` lacks `vector.image` for PNG/WebP/SVG cutouts; and `BubbleInput`/`CardInput` omit `screen` dimensions, blocking multi-aspect `editions`.
3. **Browser preview, audio, and export have critical disconnects.** `Player` drops `cues`/`cueFindings`/`breakdown` from `resolve()` (forcing monkey-patching) and plays zero audio; `browser-export`'s runtime adapter hard-rejects `config.audio` even though `BrowserEncoder` already supports `ResolvedAudioTimeline`; `film()` only supports a single `score: string` hardcoded to `role: "sfx"`.
4. **Next.js/Vercel packaging and cloud persistence need clean library boundaries.** `@superimg/next` is `"private": true`; `@foxworth/superimg` declares heavy hard dependencies (`three`, `roughjs`, `@tanstack/charts`, `d3-*`); and the entire `takes` subsystem is trapped as synchronous `node:fs` code inside `packages/superimg-cli`.

This RFC proposes a clean architectural boundary between SuperImg and `@fireside/story`, concrete API updates across the monorepo, and a prioritized P0 / P1 / P2 execution plan.

---

## 1. Browser-First & Data-First Film Compilation (`superimg-film` + `superimg-script`)

### 1.1 Zero-Bundler-Plugin Script Ingestion & Live Browser Recompilation

**Current state & evidence:**
- `packages/superimg-film/src/types.ts:120-126` defines `ScriptModule` with a required `hash: string`, even though `film.ts` never reads `script.hash` and `filmScript(doc)` (`packages/superimg-script/src/film.ts:23-62`) returns `{ version: 2, title, blocks }` without `hash`. Callers in the browser cannot simply pass `filmScript(parseScript(md)!)` into `film()`.
- Because `*.script.md` is imported via a Vite plugin (`sunday-companion-media/app/vite.config.ts:9-35`), editing a script in the Story Room forces a disk write, Vite module-graph invalidation, and a full `location.reload()` (`sunday-companion-media/app/src/editor.ts:115`).
- `packages/superimg-film/src/clock.ts:64-72` accumulates `total += duration` in raw IEEE-754 floats, forcing `sunday-companion-media/films/pig-map/pig-map.media.ts:11-25` to pre-adjust every `hold` in integer microseconds before calling `film()`.
- Retiming a single shot in the editor without destroying CRLF/whitespace forced `sunday-companion-media/app/script-file.mjs:44-66` to hand-roll regex fence splicing around `printScript()`.

**Proposed changes:**
1. **Accept raw script inputs directly in `film()`** (`packages/superimg-film/src/types.ts`, `film.ts`):
   ```ts
   export type FilmScriptInput = string | ScriptDocument | FilmScript | ScriptModule;

   export type FilmOptions<Data> = Series & {
     script: FilmScriptInput;
     // ...
   };
   ```
   - When `script` is a `string`, `film()` calls `parseScript(script)` + `filmScript(doc)` internally and surfaces any parser `ScriptFinding`s into `resolve().cueFindings` (never throwing on malformed user edits while typing in a browser editor!).
   - Make `hash` optional on `ScriptModule` so `filmScript(doc)` is directly assignable with zero bundler plugin.
   - Add a peer/direct dependency on `@foxworth/superimg-script` (which is zero-dependency and browser-safe) inside `@superimg/film` (bundled into `@foxworth/superimg/film`).
2. **Accumulate shot clock in integer microseconds** (`packages/superimg-film/src/clock.ts:64-72`):
   - Track `totalMicros += Math.round(duration * 1e6)` internally so decimal shot boundaries stay exact without user-side pre-compensation (eliminating the 15-line workaround in `pig-map.media.ts`).
3. **Add surgical attribute patching to `@foxworth/superimg-script`** (`packages/superimg-script/src/patch.ts`):
   ```ts
   export interface PatchAttrResult {
     readonly text: string;
     readonly changed: boolean;
   }

   export function patchScriptAttr(
     source: string,
     blockId: string,
     attr: "hold" | "still" | "at" | "in" | string,
     value: string | number | null,
   ): PatchAttrResult;
   ```
   - Preserves CRLF, indentation, unrelated fences, and trailing newlines while rejecting duplicate/ambiguous attributes cleanly. Works identically in browser editors and server API routes.

---

### 1.2 Declarative / Data-First Shots (Zero Untrusted User JS)

**Current state & evidence:**
- `FilmOptions.shots` (`packages/superimg-film/src/types.ts:135`, `film.ts:116-124`) only accepts `readonly Record<string, unknown>[]` and scans `Object.entries(module)` for `typeof draw === "function"`.
- In a multi-tenant cloud platform (Fireside), stories are stored as JSON + Markdown in Postgres. Executing untrusted user JavaScript on Vercel functions, render workers, or other users' browsers is a non-starter.
- Furthermore, `sunday-companion-media/films/where-did-this-grow/lettered-film.ts:8-40` had to build a custom wrapper that rebuilds `film()` on every `resolve()`/`render()` call just to interpolate `{ingredient}` / `{origin}` / `{verdict}` placeholders in dialogue from `data`.

**Proposed changes:**
1. **Support resolver-based and map-based shot lookup alongside ES module namespaces** (`packages/superimg-film/src/types.ts`, `film.ts`):
   ```ts
   export interface ShotResolver<Data = unknown> {
     /** Known shot ids for UNPLACED_SHOT / DUPLICATE_SHOT validation. Optional when dynamic. */
     has(id: string): boolean;
     render(id: string, ctx: ShotContext<Data>): ShotResult | undefined;
   }

   export type ShotsSource<Data = unknown> =
     | readonly Record<string, unknown>[]
     | Readonly<Record<string, Shot<Data>>>
     | ShotResolver<Data>;
   ```
   - Fireside's `@fireside/story` can pass a single pure, trusted `ShotResolver<StoryState>` that interprets declarative JSON shot specs (backgrounds, placed cast cutouts/rigs, props, camera keyframes, lighting) into `Vector` / `vector.image` / `closeOn` trees — **zero `eval`, zero user code compilation, zero bundler plugins** — while code-authored films (like Sunday Companions) keep passing `shots: [kitchen, map, orchard]` unchanged.
2. **First-class template interpolation for `film()` dialogue & cards** (`packages/superimg-film/src/types.ts`, `film.ts`):
   ```ts
   export type FilmOptions<Data> = Series & {
     // ...
     /** Optional per-data word map for `{key}` placeholders in speech/card/title text. */
     tokens?: (data: Data) => Readonly<Record<string, string>>;
   };
   ```
   - When `tokens` is provided, `film()` binds `{key}` placeholders per `data` value (memoized by token signature) inside `resolve()` and `render()`, so `clock()`, `MISSING_GLYPH`, `BUBBLE_TOO_LONG`, typewriter timing, and stills all stay consistent for `collection()` and personalized viewer data (`Guest at Supper`, `Where Did This Grow?`) without custom `letteredFilm()` wrappers.

---

### 1.3 Expose Script Header Fields (`do:`, `mood:`, `camera:`, `sfx:`, `music:`) on Shots & Lines

**Current state & evidence:**
- `packages/superimg-script/src/parse.ts:164-198` reads a `shot` fence body as raw `shotText = body.join("\n").trim()` and **never calls `splitBody(body)`**. Consequently, `shot.fields` is always `{}` — authors cannot write `mood: tense`, `camera: close-on chick`, `music: campfire-bed`, or `sfx: kettle` in a `shot` block header.
- On `speech` and `card` blocks, `superimg-script` *does* parse `fields` into `FilmSpeech.fields` / `FilmCard.fields`, **but** `packages/superimg-film/src/types.ts:7-24` and `film.ts:134-136` drop `fields`, `lines`, `pace`, `attribution`, `sign`, and `source` when constructing `ShotLine` and `BubbleInput`.
- Because `BubbleInput` didn't receive `id` or `fields`, `sunday-companion-media/films/the-empty-perch/the-empty-perch.media.ts:13` had to build a side-table `shots.edit.speechId(input.index) === "ignored"` just to style one quiet bubble!

**Proposed changes:**
1. **Parse header fields on `shot` blocks in `@foxworth/superimg-script`** (`packages/superimg-script/src/parse.ts`, `print.ts`):
   - Call `splitBody(body)` on `shot` blocks using the exact same rule as `speech`/`card`: `key: value` lines before the first blank line populate `block.fields`; if any line in the header is not `key: value`, the entire body stays `block.text` (100% backward-compatible with all existing scripts).
   - Update `printScript()` to print `shot.fields` before a blank line when non-empty.
   - `filmScript()` already includes `fields: sorted(item.fields)` on `FilmShot` (`packages/superimg-script/src/film.ts:31`), so `scriptHash` and `editHash` automatically cover shot fields.
2. **Surface full block metadata on `ShotContext`, `ShotLine`, `BubbleInput`, and `CardInput`** (`packages/superimg-film/src/types.ts`, `film.ts`):
   ```ts
   export type ShotLine = {
     id: string | null;
     kind: "speech" | "card";
     who?: string;
     pace?: string;
     lines: readonly string[];
     /** Open header notes from the script block (e.g. `do`, `mood`, `sfx`, `react`). */
     fields: Readonly<Record<string, string>>;
     start: number;
     typed: number;
     end: number;
   };

   export type ShotContext<Data = unknown> = {
     id: string;
     t: number;
     u: number;
     duration: number;
     /** Output canvas dimensions in pixels (enables responsive/edition reframing). */
     screen: CanvasSize;
     /** Shot description text and enclosing heading from the script. */
     text: string;
     section: string | null;
     /** Open header notes from the shot block (e.g. `mood`, `camera`, `music`, `sfx`). */
     fields: Readonly<Record<string, string>>;
     lines: readonly ShotLine[];
     data: Data;
   };
   ```
   - Also add `id: string | null`, `fields: Readonly<Record<string, string>>`, `screen: CanvasSize`, `displayName: string` onto `BubbleInput` (and `id`, `fields`, `screen` onto `CardInput`).

---

### 1.4 Closing the Four Gaps Logged in `EXECUTION.md`

Every gap logged in `sunday-companion-media/EXECUTION.md:35` has a direct root cause in `superimg-public`:

#### Gap 1: In-point / trim for reused shots
- **Evidence:** `films/season-one-recap/shots.ts:13-16` and `films/season-one-recap/trim.ts` had to write a manual `trim(shot, offset, sourceDuration)` wrapper, and `packages/superimg-types/src/composition.ts:49-62` (`Use`) supports `hold?: Duration` but no `trim`.
- **Proposal:**
  1. Export `trimShot(shot, { in: number; out?: number; sourceDuration?: number })` from `@foxworth/superimg/film` (and support `in=<seconds>` fence attribute on `shot` blocks in `@foxworth/superimg-script`, covered by `editHash` and passed into `TimedShot` so a script alone can slip a shot's in-point without code!).
  2. Add `readonly trim?: Readonly<{ in?: Duration; out?: Duration }>` to `Use` in `packages/superimg-types/src/composition.ts` and honor it in `packages/superimg-core/src/composition/time.ts` (shifting child local time by `trim.in` and bounding by `trim.out` / `hold`).

#### Gap 2: `export` and `runtime.check()` ignoring `MISSING_GLYPH` (and all `cueFindings`)
- **Evidence:** Searching the entire monorepo shows `cueFindings` is **only** read in `packages/superimg-node/src/library/source-check.ts:264` (CLI `check`) and `packages/superimg-node/src/library/script.ts:263` (`script cues`). It is **never** read in `packages/superimg-core/src/runtime/semantic.ts` (`analyzeMediaValue` / `analyzeExportMediaValue`). As a result, `exportMedia()`, `superimg export`, and browser/Node `runtime.check()` silently ignore `MISSING_GLYPH`, `UNKNOWN_SPEAKER`, `BUBBLE_OFF_CANVAS`, `SHOT_SHORTER_THAN_LINES`, `PROP_NOT_PLANTED`, and `CAST_UNMET`!
- **Proposal:**
  1. Add optional `severity?: "error" | "warning" | "info"` to `ResolveCueFinding` (`packages/superimg-types/src/resolve.ts:39-44`, defaulting to `"error"` for backward compatibility).
  2. In `packages/superimg-core/src/runtime/semantic.ts`, promote every `selection.preparedResolve?.resolved?.cueFindings` entry into `RuntimeFinding` (`category: "authoring"`, `code: f.code ?? "SCRIPT_CUE_FINDING"`, `details: { blockId: f.id }`, `coordinates: selection.coordinates`) during both `analyzeMediaValue` and `analyzeExportMediaValue`.
  3. Remove the now-redundant duplicate push in `packages/superimg-node/src/library/source-check.ts:263-271` (deduplication handles any transition).
  - **Payoff:** `superimg export`, `exportMedia()`, browser `runtime.check()`, and Node `runtime.check()` all enforce `MISSING_GLYPH` and film findings uniformly!

#### Gap 3: `script cues` and `script stills` rejecting `collection()`
- **Evidence:** `packages/superimg-node/src/library/script.ts:195-200` throws `UNSUPPORTED_SOURCE` whenever `loaded.descriptor.kind === "collection"`, even for static collections like `films/where-did-this-grow/where-did-this-grow.media.ts`.
- **Proposal:**
  1. Add `entryId?: string` to `readScriptCues()` (`packages/superimg-node/src/library/script.ts:187`), `media.script.cues` / `media.script.still` interaction schemas (`packages/superimg-interactions/src/script/`), and `--entry <id>` to `superimg script cues` and `superimg script stills` (`packages/superimg-cli/src/cli/commands/script.ts`).
  2. For static collections, resolve the requested `--entry` (or default to the first entry and report `entryId` in the output JSON). For provider collections, accept a `snapshot` (matching `media.source.check`) or fail with `COLLECTION_PROVIDER_DEFERRED` instead of `UNSUPPORTED_SOURCE`.

#### Gap 4: Bridging the Vector-Tree vs. SVG-String & Image-Cutout Split
- **Evidence:**
  1. `packages/superimg-stdlib/src/tree/vector.ts:360-371` has **no `vector.image` node** — PNG/WebP/SVG cutouts cannot be placed inside `Vector(...)` to inherit `closeOn()` camera transforms, `cast()` head tracking, or `prop()` continuity tags.
  2. `packages/superimg-film/src/breakdown.ts:168-178` skips `extractSubjects()` whenever `typeof art === "string"` — so SVG-string shots get zero `prop` breakdown (breaking `PROP_NOT_PLANTED`) and must manually compute final-coordinate `heads` (losing automatic head transform projection).
  3. `packages/superimg-film/src/film.ts:15` hardcodes `shape-rendering="crispEdges"` on every string SVG shot and overlay (wrong for smooth illustrations/comics/photos).
  4. `packages/superimg-film/src/film.ts:68-70` unconditionally appends an empty `Html({ id: "fable-lettering", ... })` even when `lettering.length === 0`. Because `Html(...)` forces the frame off `lane: "svg"`, **no `film()` can currently rasterize stills/OG images on `@foxworth/superimg/runtime/edge-raster` (`@resvg/resvg-wasm`)!**
- **Proposal:**
  1. **Add `vector.image(props)`** (`VectorImageProps: { href: string; x?: number; y?: number; width: number; height: number; preserveAspectRatio?: VectorAspectRatio; opacity?: number; transform?: VectorTransformValue; clip?: string; mask?: string }`) to `packages/superimg-stdlib/src/tree/vector.ts`, lowerers (`lower-svg.ts`, `lower.ts`), `packages/superimg/src/index.ts`, and `packages/superimg-film/src/measure.ts` (`case "image"`).
  2. **Parse semantic markup tags in SVG-string shots** (`packages/superimg-film/src/measure.ts`, `breakdown.ts`, `camera.ts`):
     - Support `data-superimg-cast="<name>"`, `data-superimg-prop="<name>"`, and `data-superimg-head="<x>,<y>"` on any `<g>`/element inside SVG-string shots.
     - Walk the lightweight SVG AST already built in `measure.ts` (`fromMarkup`), composing `transform` matrices with `parseTransform`/`mul`/`apply` (already in `transform.ts`!) and respecting `opacity="0"` / `display="none"` — giving SVG-string shots **automatic head projection AND full `PROP_NOT_PLANTED` / `CAST_UNMET` breakdown**!
  3. **Remove pixel-art hardcoding & keep pure-Vector films on the SVG fast lane** (`packages/superimg-film/src/film.ts`):
     - Add `shapeRendering?: "auto" | "crispEdges" | "geometricPrecision"` on `Series` (default `"auto"` for smooth vector/illustration stories; pixel series set `"crispEdges"`).
     - Omit the dummy `Html({ id: "fable-lettering" })` node when `lettering.length === 0` (only emit `Html` if a bubble/card/title actually returns a raw SVG string!). Pure-Vector films with Vector bubbles/cards now stay 100% on `lane: "svg"` — unlocking Edge/Vercel resvg OG image rendering!

---

## 2. Storytelling Ergonomics & Reusable Primitives

### 2.1 Architectural Boundary: SuperImg vs. Fireside (`@fireside/story`)

Keeping SuperImg lean and general-purpose requires a crisp boundary:

| Concern | Belongs in **SuperImg** (`@superimg/film`, `@superimg/stdlib`, `@superimg/player`, `@superimg/core`) | Belongs in **Fireside** (`@fireside/story` + Next.js app) |
|---|---|---|
| **Script grammar, parsing, hashing, surgical patching** | Yes (`@foxworth/superimg-script`) | Uses directly in editor & DB sync |
| **Shot clock, reading pace, trim/in-point, cues, continuity** | Yes (`@foxworth/superimg/film`) | Configures series rules & reads findings |
| **Declarative Story JSON schema (scenes, backgrounds, transitions)** | No (only exposes `ShotResolver` seam) | Yes — Fireside's data-first story DSL |
| **Cast & prop identity, head tracking, universal adapters (image/SVG/rig)** | Yes (`cast()`, `prop()`, `vector.image`) | Uploads/stores tenant assets & compiles rigs offline |
| **Bubble geometry, safe-area clamping, collision avoidance math** | Yes (pure layout helpers + `paintedBounds()`) | Yes for concrete bubble visual themes (comic, pixel, storybook, subtitle) |
| **Multi-aspect `editions` plumbing & focal camera reframing** | Yes (`FilmOptions.editions`, aspect-aware `closeOn`) | Chooses target aspects per tenant/distribution channel |
| **Audio timeline mixing, VO duration binding, Player audio preview** | Yes (`AudioTimeline`, `film({ audio, narration })`, `Player` audio) | TTS provider billing/UI, voice cloning, music library |
| **Browser/Cloud/Edge export mechanics & `TakeStore` contract** | Yes (`runtime`, `browser-export`, `edge-raster`, `takes` interface) | Postgres/R2/Vercel Blob `TakeStore` impl, worker queue, tenant auth, custom domains |

---

### 2.2 Bubble Measurement, Safe-Zone & Collision Avoidance

**Current state & evidence:**
- `sunday-companion-media/series/sunday.ts:54-83` and `series/fable.ts:46-76` duplicate ~40 lines of bubble clamping and tail-clamping math with hardcoded `const SW = 1080; const SH = 1920;` because `BubbleInput` (`packages/superimg-film/src/types.ts:61-70`) does not pass `screen` or `safeBox`.
- `@superimg/stdlib` already has `getSafeArea` / `getSafeBox` (`packages/superimg-stdlib/src/safe-area.ts`) for `"broadcast"`, `"title"`, `"action"`, `"social"`, and `"social-center"`, and `@superimg/film` already has `paintedBounds` (`measure.ts`), yet neither is wired into `film()`.
- When two characters speak simultaneously or overlappingly (`at=0.2..2.5` and `at=1.0..3.0`), bubbles currently collide blindly with no awareness of previously placed bubbles.

**Proposed changes (`packages/superimg-film`):**
1. Add `safeArea?: SafeAreaPreset | SafeAreaInsets` to `Series` (default `{ top: 16, right: 24, bottom: 16, left: 24 }` or `"none"` for backward compatibility, `"social"` for 9:16 social stories).
2. Enrich `BubbleInput` with:
   ```ts
   export type Rect = { x: number; y: number; width: number; height: number };

   export type BubbleInput = {
     id: string | null;
     who: string;
     /** Display label from `cast(name, ..., { label })`, defaulting to `who.toUpperCase()`. */
     displayName: string;
     castMeta?: Readonly<Record<string, unknown>>;
     lines: readonly string[];
     fields: Readonly<Record<string, string>>;
     t: number;
     start: number;
     typed: number;
     end: number;
     index: number;
     head: Point;
     /** Current output canvas in pixels (changes per edition!). */
     screen: CanvasSize;
     /** Safe content box inside `screen`. */
     safeBox: Rect;
     /** Painted boxes of already-placed active bubbles on this frame, for collision avoidance. */
     occupied: readonly Rect[];
   };
   ```
   Similarly pass `screen` and `safeBox` to `CardInput` and `drawTitle(t, title, { screen, safeBox })`.
3. Export pure layout & measurement helpers from `@foxworth/superimg/film`:
   - `paintedBounds(art)` (already implemented in `measure.ts:290`, just re-export it!).
   - `placeBubble(opts: { head: Point; size: CanvasSize; safeBox: Rect; gap?: number; tailMargin?: number; occupied?: readonly Rect[]; prefer?: "above" | "below" }): { x: number; y: number; tailX: number; tailSide: "bottom" | "top"; box: Rect }` — handles horizontal clamping, automatic flip-below when a tall character's head is near the top safe edge, and vertical stacking push-apart against `occupied` boxes.

---

### 2.3 Multi-Aspect `editions` Reframing (`9:16`, `16:9`, `1:1`)

**Current state & evidence:**
- `VideoInput` (`packages/superimg-types/src/define.ts:109`) supports `editions`, **but `FilmOptions` (`packages/superimg-film/src/types.ts:133-139`) does not accept or forward `editions`**!
- `closeOn(point, view, art)` (`packages/superimg-film/src/camera.ts:30-37`) clamps the camera transform strictly against `series.stage` (`360×640`), completely unaware of the output `screen` aspect ratio. Rendering a `9:16` film onto a `1:1` (`1080×1080`) or `16:9` (`1920×1080`) destination either letterboxes with huge bars (`fit: "contain"`) or blindly center-crops (`fit: "cover"`) — cutting off heads and props.
- Square destinations (`1080x1080`, `instagram-square`) fail SuperImg export preflight with `MISSING_EDITION` unless `editions.square` exists!

**Proposed changes (`packages/superimg-film`):**
1. Add `editions` to `FilmOptions`:
   ```ts
   export type FilmReframe = "contain" | "cover" | "focus";

   export type FilmEdition = {
     size: CanvasSize;
     fit?: FilmReframe;
     safeArea?: SafeAreaPreset | SafeAreaInsets;
     /** Optional stage crop/override for exact art direction. */
     stage?: CanvasSize;
     bubble?: Series["bubble"];
     card?: Series["card"];
     drawTitle?: Series["drawTitle"];
   };

   export type FilmOptions<Data> = Series & {
     // ...
     editions?: Readonly<Record<string, FilmEdition>>;
   };
   ```
2. Implement **`fit: "focus"`** (aspect-aware smart reframing) in `packages/superimg-film/src/camera.ts`:
   - When `fit === "focus"`, compute the `cover` scale from `stage` → `screen`, then pan the stage viewport toward the active focal point (`closeOn` point, or speaking character's `head` if no explicit `closeOn`), clamped to stage boundaries so no background bars appear and the active speaker/subject stays framed inside `safeBox` across `9:16`, `1:1`, and `16:9`.
   - Forward compiled editions into `video({ ..., editions })` and run `resolve()` bubble-bounds checks per selected edition (`config.width` / `config.height` are already passed into `resolve({ config })`!).

---

### 2.4 Universal Cast & Prop Adapters + Speaker Display-Name Registry

**Current state & evidence:**
- `cast()` (`packages/superimg-film/src/cast.ts:72-137`) only supports `Rig` (with pixel-art heuristics: `rig.w > 30 ? size / 2 : size` and `shapeRendering: "crispEdges"`) or raw `Drawn`.
- `packages/superimg-core/src/bundler/rig-module.ts` shells out via `execFile` to a local Zig `familiar` binary — unusable on Vercel/cloud or for non-Familiar creators.
- `sunday-companion-media/series/cast/fox.ts:9` and `series/sunday.ts:60` had to manually export `foxLabel = "FOX"` and branch `b.who === "fox" ? foxLabel : b.who.toUpperCase()`. Meanwhile `findings.ts:34` checks `MISSING_GLYPH` against `block.who.toUpperCase()`, which is **wrong** whenever a speaker's display name differs from their script id (e.g. `who: dr-chen` with display name `"DR. CHEN"`, or `who: narrator` with label `""`).

**Proposed changes (`packages/superimg-film/src/cast.ts`, `types.ts`, `findings.ts`):**
1. Add declarative, JSON-serializable cast adapters alongside existing overloads:
   ```ts
   export interface CastCommonOptions {
     /** Human-facing display name printed in bubbles/captions (default: name.toUpperCase()). */
     label?: string;
     /** Arbitrary series/theme metadata (e.g. badgeColor, voiceId, aliases). */
     meta?: Readonly<Record<string, unknown>>;
     seed?: number;
   }

   export interface ImageCutoutSpec {
     kind: "image";
     /** Default image URL or asset key. */
     src: string;
     /** Optional pose-name → image URL/asset map (e.g. `{ talk, happy, surprised }`). */
     poses?: Readonly<Record<string, string>>;
     width: number;
     height: number;
     /** Ground-contact anchor in local image coordinates (default `{ x: width / 2, y: height }`). */
     anchor?: Point;
     /** Head point relative to `anchor` at scale 1 (e.g. `{ x: 0, y: -height }`). */
     head: Point;
     shadow?: boolean;
   }

   export interface SvgCutoutSpec {
     kind: "svg";
     viewBox: { width: number; height: number };
     markup: string;
     poses?: Readonly<Record<string, string>>;
     anchor?: Point;
     head: Point;
   }
   ```
   - `cast(name, imageCutoutSpec, opts)` renders using `vector.image(...)`, automatically flips horizontally via `scaleX: -1`, scales around `anchor`, applies `lift` + ground shadow, and tags both `CAST_HEAD` and `SUBJECT`.
   - Compiled `Rig` JSON (`RigPetEntry`) continues to work directly in browser/cloud with zero `.toml` or Zig binary requirement; `superimg rig compile <dir>` CLI command can pre-compile `.rig.toml` → `.rig.json` for cloud upload.
2. Expose `castLabel(member)` and `castMeta(member)` and wire them into `film()`:
   - `BubbleInput.displayName` uses `castLabel(member) ?? block.who.toUpperCase()`.
   - `MISSING_GLYPH` checks `displayName` (when `bubbleShowsName !== false`) instead of raw `block.who.toUpperCase()`.

---

### 2.5 Live Browser `resolve()` / `check()` Feedback for Editors

**Current state & evidence:**
- `sunday-companion-media/app/src/room.ts:103-121` had to monkey-patch `media.resolve` before calling `player.load()` because `Player` (`packages/superimg-player/src/player-load-core.ts:113-130`) discards `cues` (keeping only start-time `markers`), `cueFindings`, and `breakdown`.
- There is no direct zero-overhead helper to inspect a `film()`'s live findings + cues + breakdown in a browser editor while typing without spinning up a full DOM player or calling a Node backend.

**Proposed changes:**
1. **Expose resolved metadata on `Player`** (`packages/superimg-player/src/player-load-core.ts`, `player-types.ts`, `player.ts`):
   - Retain `cues`, `cueFindings`, and `breakdown` from `applyTemplateResolve()` on `PreparedSessionLoad` and attach them to the success branch of `LoadResult` AND via `player.getCues()`, `player.getCueFindings()`, and `player.getBreakdown()`.
   - Zero monkey-patching needed in Fireside or Sunday Companions' Story Room.
2. **Export fast pure `inspectFilm(media, options?)` from `@foxworth/superimg/film`**:
   - Runs `film()`'s `resolve()` synchronously/purely in the browser (< 5 ms for a 30-shot film) and returns `{ duration, fps, size, cues, findings, breakdown }` so a web script editor gets instant red squiggles (`UNKNOWN_SPEAKER`, `SHOT_SHORTER_THAN_LINES`, `BUBBLE_OFF_CANVAS`, `PROP_NOT_PLANTED`, `MISSING_GLYPH`) on every keystroke!

---

## 3. Cloud, Next.js/Vercel & Export Ergonomics

### 3.1 Next.js App Router / Turbopack / Vercel Compatibility Audit

Inspecting `packages/superimg/package.json`, `packages/superimg-next/`, `packages/superimg-script/`, and `packages/superimg/tsdown.*.ts` revealed five concrete issues to address for Next.js 15/16 App Router + Turbopack + Vercel deployment:

| Package / Entry | Current Finding | Required Fix |
|---|---|---|
| **`@superimg/next`** (`packages/superimg-next/package.json:4`) | Marked `"private": true` — cannot be installed by Fireside or external Next.js apps! | Publish as `@foxworth/superimg-next` (or re-export as `@foxworth/superimg/next/server` and `@foxworth/superimg/next/client`). |
| **`@foxworth/superimg` root dependencies** (`packages/superimg/package.json:274-289`) | Hard `dependencies` include `three` (~650 KB+ unpacked), `roughjs`, `@tanstack/charts`, `d3-force`, `d3-scale`, `date-fns`, `saxes`, `@resvg/resvg-wasm`. Bloats Vercel serverless output file tracing (OFT) and cold starts. | Move `three`, `roughjs`, `@tanstack/charts` to optional peerDependencies (or subpath-isolated bundles) and add a bundle-size budget check for `dist/film.js` (target `< 25 KB` gzip, zero Node built-ins). |
| **`@foxworth/superimg/film` exports** (`packages/superimg/package.json:186-190`) | Only declares `types`, `import`, `default` — missing explicit `browser`, `react-server`, `edge-light`, `workerd`, `node` conditions. | Add explicit universal export conditions and include `film` in `verify:build` (`check-workerd-compat.mjs` + `check-no-react.mjs`). |
| **`@foxworth/superimg/browser-export` in RSC** (`packages/superimg/package.json:22-27`) | No `"react-server"` guard — importing in a Next.js Server Component crashes at runtime with `document`/`window` errors instead of a clear boundary error. | Add a `"react-server"` stub (matching `src/react/react-server.ts`) that throws an explicit Client Component guidance error. |
| **`"use client"` directive preservation** (`packages/superimg/tsdown.browser.ts`, `packages/superimg/package.json:150-156`) | `src/react/player.ts` and `src/react/index.ts` have `"use client";` after `//!` comments; `tsdown`/Rolldown bundling can reorder/drop directives unless banner-preserved and checked. Also `exports["./react/player"]["react-server"]` points directly to `./dist/react/player.js` — this ONLY works in Next.js App Router if line 1 of `dist/react/player.js` is literally `"use client";`! | Ensure `tsdown.browser.ts` emits `"use client";` as the exact first statement on all client React entries (`react/player`, `react/index`, `react/interactive`, `react/compile`, `react/session`) and add a `verify:build` assertion checking line 1 of every client entry. |

> **Good news:** `@foxworth/superimg-script` (`packages/superimg-script/package.json`) is already zero-dependency, pure ESM, and 100% browser/Edge/Node/Turbopack-safe. Re-exporting it as `@foxworth/superimg/script` (while keeping `@foxworth/superimg-script` standalone) is a low-cost ergonomic win.

---

### 3.2 Timeline Audio Ergonomics (VO/TTS, Audio-Driven Speech, Music Ducking, SFX)

**Current state & evidence:**
1. **`film()` only accepts `score?: string`** (`packages/superimg-film/src/film.ts:168`), hardcoded to `audio: { id: "score", src: score, role: "sfx", duration: `${duration}s` }`. It cannot attach per-speech VO clips, a ducked music bed, or SFX cues, and even labels the music score as `role: "sfx"` (so ducking wouldn't duck it!).
2. **`ResolveResult` cannot return `audio`** (`packages/superimg-types/src/resolve.ts:70-90`), preventing data-driven or resolved-clock films from emitting dynamic audio timelines.
3. **`clock()` cannot accept measured VO/TTS durations.** SuperImg already has a rich `NarrationPlan` / `preparedNarrationAudio()` contract (`docs/narration.md`, `packages/superimg/src/index.ts:20`), yet `film()`'s `clock()` ignores measured speech clip durations and only uses the synthetic `0.33 * words` reading rule.
4. **Browser `Player` plays zero audio.** Grepping `packages/superimg-player/src/` and `packages/superimg-media/src/` confirms `config.audio` is never loaded or played during preview.
5. **Browser export hard-rejects ALL audio.** `packages/superimg-browser-export/src/runtime/adapter.ts:424-433` emits `BROWSER_AUDIO_TIMELINE_UNAVAILABLE`, even though `BrowserEncoder.setResolvedAudio()` is **already implemented** in `packages/superimg-browser-export/src/export.ts:63-66`!

**Proposed changes:**
1. **Rich audio on `FilmOptions` & `clock()`** (`packages/superimg-film/src/types.ts`, `clock.ts`, `film.ts`):
   ```ts
   export interface SpeechAudioClip {
     src: string;
     durationSeconds: number;
     transcript?: TranscriptWord[];
     volume?: number;
   }

   export type FilmAudioOptions = {
     /** Background music bed(s), defaulted to `role: "music"` and auto-ducked under voice. */
     music?: AudioValue;
     /** Per-speech-block VO/TTS clips keyed by speech block id (e.g. `"help-1"` or `id=`). */
     speech?: Readonly<Record<string, SpeechAudioClip>> | NarrationPlan;
     /** Soundboard lookup for script `sfx: <name>` header fields on shots or lines. */
     sfx?: Readonly<Record<string, string | Omit<AudioClip, "at">>>;
     /** Extra raw AudioClip entries. */
     clips?: readonly AudioClip[];
     /** Mix & ducking configuration (defaults to `{ ducking: true, duckingLevel: 0.25 }` when `speech` + `music` coexist). */
     mix?: AudioMixOptions;
   };
   ```
   - When `speech[blockId]` is present and the script block omits an explicit `at=start..end` end time, **`clock()` uses `speech[blockId].durationSeconds`** (plus configurable pad) instead of the synthetic word-count heuristic!
   - `film()` automatically emits a complete `AudioTimeline` (`music` + placed `voice` clips at `shot.start + line.start` + `sfx` clips triggered by `sfx:` header fields) with ducking enabled.
   - Keep `score?: string` working (fixing its default `role` to `"music"`).
2. **Allow `audio?: AudioValue` on `ResolveResult`** (`packages/superimg-types/src/resolve.ts`, `packages/superimg-core/src/rendering/resolve-template.ts`):
   - Enables `collection()` and personalized films to resolve entry-specific VO/music tracks at resolve time.
3. **Wire `resolveAudioTimeline` in `browser-export` runtime adapter** (`packages/superimg-browser-export/src/runtime/adapter.ts:358-365, 424-433`):
   - Resolve `definition.config.audio` using `@superimg/core`'s pure audio timeline normalizer + fetched audio bytes from `prepareRuntimeResources()`, and pass `resolvedAudio` directly to `exportImageDataToVideo()`. Removes the `BROWSER_AUDIO_TIMELINE_UNAVAILABLE` blocker!
4. **WebAudio preview playback in `@superimg/player`** (`packages/superimg-player/src/player-audio.ts`):
   - Opt-in (or default-on muted-until-user-gesture) WebAudio timeline player driven by `ResolvedAudioTimeline` (mix gain, fades, simple voice-ducking envelope), synchronized to `play()`, `pause()`, `seek()`, and `player.setMuted(boolean)` / `player.setVolume(number)`.

---

### 3.3 Cloud Render Workers, Browser Capture & Edge OG Images

Fireside needs three complementary delivery tiers on Vercel + cloud workers, all consuming the **exact same `film()` definition**:

```
                       Single authored Film / StoryDefinition
                                         │
         ┌───────────────────────────────┼───────────────────────────────┐
         ▼                               ▼                               ▼
  Tier 1: Edge / Vercel          Tier 2: Browser Draft           Tier 3: Cloud Worker
  OG Images & Stills             Client-Side MP4/WebM            Production Master MP4
  ─────────────────────          ────────────────────            ─────────────────────
  @foxworth/superimg/            @foxworth/superimg/             @foxworth/superimg/
    runtime/edge-raster            runtime (browser) +             runtime (node)
  (@resvg/resvg-wasm)              browser-export                startExport() /
  Zero Chromium, <150ms          WebCodecs + MediaBunny          prepareNodeMediaExport()
  PNG/SVG for og:image           Zero server cost                Chromium + node-av
  & contact-sheet cards          (Needs audio wiring!)           Streams -> R2 / Blob
```

**Specific gaps to close in `superimg-node` and `superimg-edge-runtime`:**
1. **Unblock Tier 1 (Edge OG Images & Stills for `film()`):**
   - Removing the stray empty `Html("fable-lettering")` in `film.ts:68-70` (Section 1.4 Gap 4) + supporting `vector.image` makes pure-Vector `film()` shots land on `frame.lane === "svg"`.
   - Verify `packages/superimg-edge-runtime/src/adapter-base.ts` embeds fetched/frozen `vector.image` hrefs (data URI / asset map) so `@resvg/resvg-wasm` renders PNG cutouts inside SVG cleanly on Vercel Functions!
2. **Unblock Tier 2 (Browser Video Export with Audio):**
   - Wire `resolvedAudio` in `packages/superimg-browser-export/src/runtime/adapter.ts` (Section 3.2).
   - Expose `onProgress` forwarding from `renderAnimated()` (`adapter.ts:358-397`) into `ExportOptions.onProgress` so browser export dialogs show frame-accurate progress.
3. **Harden Tier 3 (Cloud Render Workers in `superimg-node`):**
   - Make `prepared-export.ts:42`'s hardcoded `64 * 1024 * 1024` (64 MiB) fetched-resource ceiling configurable via `NodeRuntimeAdapterOptions.maxFetchedBytes` (a 3-minute film with WAV score + multi-track VO + high-res PNG backgrounds easily exceeds 64 MiB).
   - Document & test `startExport()` + `poolStillPages: true` + `AbortSignal` + `onProgress` streaming `ExportBundle.artifacts[].stream()` straight to S3/R2/Vercel Blob without touching local project directories.

---

### 3.4 Cloud-Friendly Takes, Revisions & Publication Receipts

**Current state & evidence:**
- The entire `takes` subsystem lives inside `packages/superimg-cli/src/cli/takes/store.ts` (not exported by any library package), uses synchronous `node:fs` (`readFileSync`, `writeFileSync`, `renameSync`), and assumes a `.superimg/takes/` folder on disk next to `.media.ts`.
- Because there is no library API, `sunday-companion-media/app/server.ts:37-40` spawns `superimg takes ... --json` as a subprocess per HTTP request, manually queues concurrent writes, and works around CLI formatting quirks (`// Some CLI versions print human-readable feedback even with --json`).
- Feedback is encoded as flat strings (`"shot jarQuestion: trim 0.5s"`) rather than structured shot-keyed objects, and `takes diff` (designed in `PLAN.md:186-193`) is not implemented yet.
- `ExportBundle` (`@superimg/types`) and `MediaExportReceipt` (`@superimg/interactions/src/contracts.ts:245-251`) have no standard bridge to `TakeRecord`.

**Proposed changes:**
1. **Extract a storage-agnostic `@foxworth/superimg/takes` entry** (new `packages/superimg-takes` or module in `@superimg/core` re-exported from `@foxworth/superimg/takes`):
   ```ts
   export interface TakeFeedbackEntry {
     readonly id: string;
     readonly rating: "good" | "bad" | "note";
     readonly blockId?: string;
     readonly text: string;
     readonly author?: string;
     readonly createdAt: string;
   }

   export interface TakeRecordV2 extends Omit<TakeRecord, "schemaVersion"> {
     readonly schemaVersion: 2;
     readonly scriptHash?: string;
     readonly editHash?: string;
     readonly cues?: readonly ResolveCue[];
     readonly feedback?: readonly TakeFeedbackEntry[];
   }

   export interface TakeStore {
     list(scope: string): Promise<readonly TakeRecordV2[]>;
     get(scope: string, idOrLabel: string): Promise<TakeRecordV2 | null>;
     put(scope: string, record: TakeRecordV2): Promise<TakeRecordV2>;
     putBlob(sha256: string, bytes: Uint8Array, mimeType?: string): Promise<void>;
     getBlob(sha256: string): Promise<Uint8Array | null>;
     addFeedback(scope: string, id: string, entry: Omit<TakeFeedbackEntry, "id" | "createdAt">): Promise<TakeRecordV2>;
     findByRendition(sha256: string): Promise<readonly TakeRecordV2[]>;
   }
   ```
   - CLI keeps a `FileTakeStore` implementation (reading schema 0, 1, and 2 transparently) and delegates to the shared contract.
   - Fireside implements `TakeStore` over Postgres + R2/Vercel Blob in ~80 lines with zero CLI shelling!
2. **Add pure `diffTakes(a, b)` & `takeFromExportBundle(bundle, meta)`:**
   - `diffTakes(takeA, takeB)` compares two takes by `shot` block id (hold changes, added/removed/edited speech lines, file/asset hash changes) — reusable in Fireside's browser Dailies compare view, API routes, AND `superimg takes diff <a> <b>`.
   - `takeFromExportBundle(bundle, { scriptHash, editHash, cues, label, receipt? })` creates a portable `TakeRecordV2` directly from a runtime `ExportBundle` (attaching rendition SHA-256s, MIME types, coordinates, and optional `MediaExportReceipt` digest).

---

## 4. Prioritized Action Plan

### P0 — Unblocks Fireside V1 Immediately

| # | Item | Package / File Targets | Proposed Change / API | Scope |
|---|---|---|---|---|
| **P0.1** | **Zero-plugin browser script ingestion & integer clock** | `packages/superimg-film/src/{types,film,clock}.ts`, `packages/superimg-film/package.json` | Accept `string \| ScriptDocument \| FilmScript` in `film({ script })`; surface parse findings in `cueFindings`; sum shot clock in integer microseconds. | **S** |
| **P0.2** | **Declarative `ShotResolver` seam & token interpolation** | `packages/superimg-film/src/{types,film}.ts` | Accept `ShotResolver<Data>` / `Record<string, Shot<Data>>` in `FilmOptions.shots` (zero untrusted user JS) + `tokens?: (data) => Record<string, string>`. | **S** |
| **P0.3** | **Script header fields on `shot` blocks & `ShotContext`/`ShotLine`/`BubbleInput`** | `packages/superimg-script/src/{parse,print}.ts`, `packages/superimg-film/src/{types,film}.ts` | Parse `key: value` header fields on `shot` fences (`mood:`, `camera:`, `sfx:`, `music:`); expose `fields`, `lines`, `screen`, `text`, `section` on `ShotContext` / `ShotLine` / `BubbleInput`. | **S** |
| **P0.4** | **Promote `cueFindings` (`MISSING_GLYPH`, etc.) into runtime `check` & `export`** | `packages/superimg-core/src/runtime/semantic.ts`, `packages/superimg-types/src/resolve.ts`, `packages/superimg-node/src/library/source-check.ts` | Fold `preparedResolve.resolved.cueFindings` into `RuntimeFinding[]` in `analyzeMediaValue` & `analyzeExportMediaValue` (with `severity` support). Fixes `export` ignoring `MISSING_GLYPH` everywhere. | **S** |
| **P0.5** | **`vector.image` primitive + universal `cast()` image/SVG cutout adapters + display labels** | `packages/superimg-stdlib/src/tree/{vector,lower-svg,lower}.ts`, `packages/superimg-film/src/{cast,measure,findings,film}.ts`, `packages/superimg/src/index.ts` | Add `vector.image(...)`; add `ImageCutoutSpec` / `SvgCutoutSpec` + `label`/`meta` to `cast()`; configurable `shapeRendering` (default `"auto"`). | **M** |
| **P0.6** | **Keep pure-Vector `film()` on the SVG fast lane (unblocks Edge OG images)** | `packages/superimg-film/src/film.ts`, `packages/superimg-edge-runtime/src/adapter-base.ts` | Stop emitting empty `Html("fable-lettering")` when `lettering.length === 0`; verify `vector.image` asset embedding in `edge-raster`. | **S** |
| **P0.7** | **Expose resolved `cues`, `cueFindings`, `breakdown` on `Player` + pure `inspectFilm()`** | `packages/superimg-player/src/{player-load-core,player-types,player}.ts`, `packages/superimg-film/src/index.ts` | Return `cues`/`cueFindings`/`breakdown` on `Player` `LoadResult` + getters; export pure `inspectFilm(media)` for instant editor diagnostics. | **S** |
| **P0.8** | **Next.js App Router / Vercel packaging fixes** | `packages/superimg-next/package.json`, `packages/superimg/package.json`, `packages/superimg/tsdown.browser.ts` | Publish `@foxworth/superimg-next` (or `@foxworth/superimg/next/*`); add `"browser"`/`"react-server"`/`"edge-light"` conditions on `./film` & `./browser-export`; enforce line-1 `"use client";` on all React client builds in `verify:build`. | **S** |

### P1 — Major Ergonomic & Refactor Wins

| # | Item | Package / File Targets | Proposed Change / API | Scope |
|---|---|---|---|---|
| **P1.1** | **Rich `film()` audio timeline + VO-driven speech clock + `ResolveResult.audio`** | `packages/superimg-film/src/{types,clock,film}.ts`, `packages/superimg-types/src/resolve.ts`, `packages/superimg-core/src/rendering/resolve-template.ts` | Add `FilmOptions.audio` (`music`, `speech` VO/NarrationPlan, `sfx` soundboard, `mix`/ducking); let `speech` durations drive `clock()`; fix `score` default role to `"music"`; allow `ResolveResult.audio`. | **M** |
| **P1.2** | **Browser video export with audio + `Player` WebAudio preview** | `packages/superimg-browser-export/src/runtime/adapter.ts`, `packages/superimg-player/src/{player,player-audio}.ts` | Wire `resolveAudioTimeline` into `browser-export` runtime adapter (removes `BROWSER_AUDIO_TIMELINE_UNAVAILABLE`); add synced WebAudio preview playback + mute/volume controls to `Player`. | **M** |
| **P1.3** | **Multi-aspect `editions` + focal reframing + `placeBubble()` collision solver** | `packages/superimg-film/src/{types,film,camera,measure,bubble-layout}.ts` | Forward `editions` on `FilmOptions`; add `fit: "focus"` aspect-aware reframing in `camera.ts`; pass `screen`/`safeBox`/`occupied` into `BubbleInput`; export `placeBubble()` and `paintedBounds()`. | **M** |
| **P1.4** | **SVG-string head projection & continuity breakdown** | `packages/superimg-film/src/{measure,breakdown,camera}.ts` | Parse `data-superimg-cast`, `data-superimg-prop`, `data-superimg-head` in SVG-string shots with matrix transform propagation so SVG-string shots get automatic head tracking and `PROP_NOT_PLANTED`/`CAST_UNMET`. | **M** |
| **P1.5** | **Shot in-point / trim (`trimShot`, `in=` fence attr, `Use.trim`)** | `packages/superimg-script/src/{parse,print,film}.ts`, `packages/superimg-film/src/{clock,film,trim}.ts`, `packages/superimg-types/src/composition.ts`, `packages/superimg-core/src/composition/time.ts` | Support `in=` on `shot` fences, `trimShot()` helper, and `trim: { in, out }` on `sequence()` `Use` entries. | **S–M** |
| **P1.6** | **Surgical script patching (`patchScriptAttr`)** | `packages/superimg-script/src/patch.ts` | Non-destructive fence attribute patching preserving CRLF/whitespace for live timeline drag-to-retime editors. | **S** |
| **P1.7** | **`script cues` & `script stills` support for `collection()`** | `packages/superimg-node/src/library/script.ts`, `packages/superimg-cli/src/cli/commands/script.ts`, `packages/superimg-interactions/src/script/` | Accept `--entry <id>` / `entryId` (defaulting to first static entry) instead of throwing `UNSUPPORTED_SOURCE`. | **S** |
| **P1.8** | **Storage-agnostic `@foxworth/superimg/takes` + `diffTakes()` + `ExportBundle` bridge** | New `packages/superimg-takes` (or `superimg-core/takes`), `packages/superimg-cli/src/cli/{takes,commands/takes}.ts`, `packages/superimg/package.json` | Async `TakeStore` interface, schema v2 structured per-shot feedback, pure `diffTakes(a, b)`, `takeFromExportBundle()`, and CLI `takes diff`. | **M** |

### P2 — Later Ecosystem & Optimization

| # | Item | Package / File Targets | Proposed Change / API | Scope |
|---|---|---|---|---|
| **P2.1** | **Slim `@foxworth/superimg` hard dependency graph** | `packages/superimg/package.json`, `packages/superimg/tsdown.*.ts` | Move `three`, `roughjs`, `@tanstack/charts` out of hard `dependencies` into optional peers or dedicated subpath packages; enforce `< 25 KB` gzip budget on `./film`. | **M** |
| **P2.2** | **Configurable cloud worker resource caps in `prepareNodeMediaExport`** | `packages/superimg-node/src/runtime/{adapter,prepared-export}.ts` | Expose `maxFetchedBytes` (default 64 MiB → configurable up to e.g. 512 MiB) and streaming asset cache hooks for long-form cloud film renders. | **S** |
| **P2.3** | **Offline rig compiler CLI (`superimg rig compile`)** | `packages/superimg-cli`, `packages/superimg-core/src/bundler/rig-module.ts` | Pre-compile `.rig.toml` → portable `.rig.json` artifacts so Familiar-authored characters upload cleanly to cloud tenants without shipping a Zig binary to servers. | **S** |
| **P2.4** | **Single-package `@foxworth/superimg/script` re-export & transition hooks on `film()`** | `packages/superimg/package.json`, `packages/superimg-film/src/film.ts` | Re-export `@foxworth/superimg-script` under `@foxworth/superimg/script`; add optional shot-to-shot `transition` (`cut` / `crossfade` / `dip`) driven by `transition:` shot header field. | **S–M** |

---

## Recommended Execution Order

To ship cleanly without regressing Sunday Companions' byte-identical baselines (`3,957/3,957` Pig frames):

1. **PR 1 — Script & Film Core Foundation (P0.1, P0.2, P0.3, P1.6):** `superimg-script` shot header fields + `patchScriptAttr`; `superimg-film` direct script input, integer microsecond clock, `ShotResolver`, `tokens`, enriched `ShotContext`/`ShotLine`/`BubbleInput`.
2. **PR 2 — Runtime Validation & Player Inspection (P0.4, P0.7):** Promote `cueFindings` into `superimg-core/src/runtime/semantic.ts`; expose `cues`/`cueFindings`/`breakdown` on `Player` + `inspectFilm()`.
3. **PR 3 — Cutouts, Pure-SVG Lane & Next.js Packaging (P0.5, P0.6, P0.8):** `vector.image`, universal `cast()` cutout adapters + `label`, remove dummy `Html("fable-lettering")` & hardcoded `crispEdges`, publish `@foxworth/superimg-next` & verify `"use client"` / export conditions.
4. **PR 4 — Audio End-to-End (P1.1, P1.2):** `FilmOptions.audio` + VO-driven clock + `ResolveResult.audio`, `browser-export` audio wiring, `Player` WebAudio preview.
5. **PR 5 — Multi-Aspect Reframing, Trim & Continuity Parity (P1.3, P1.4, P1.5, P1.7):** `editions` + `fit: "focus"` + `placeBubble()`, SVG-string `data-superimg-*` projection/breakdown, `trimShot`/`in=`/`Use.trim`, collection `script cues`/`stills`.
6. **PR 6 — Portable Cloud Takes (P1.8, P2.2):** Extract async `TakeStore` + `diffTakes()` + `takeFromExportBundle()` + configurable worker `maxFetchedBytes`.
