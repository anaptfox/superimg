# SuperImg

**Media as code. Generate something reusable for once.**

A TypeScript library for video, images, vector graphics, and interactive media. Author a scene once—then reuse it in another work, embed it live in your app, batch-materialize campaign kits from data, or export files for every platform.

<p align="center">
  <a href="docs/assets/launch-film.mp4">
    <img src="docs/assets/hero.gif" alt="SuperImg launch film: Peg performs a trick on a pencil-test sheet, then the same scene becomes a poster, a website, and a multi-format campaign kit." width="880" />
  </a>
  <br />
  <sub>
    Made with SuperImg · <a href="docs/assets/launch-film.mp4">Watch full 1080p MP4 (0:35)</a> · <a href="examples/marketing/superimg-launch/superimg-launch.media.ts">Read the source</a>
  </sub>
</p>

```bash
npm install @foxworth/superimg
npm install -D @foxworth/superimg-cli
```

---

## Why Baked Pixels Trap Your Work

Most media workflows end at an opaque file: an `.mp4`, a `.png`, or generated footage. When you only need one asset once, that is enough. Then you need a vertical reel for social, a square card for a feed, localized posters for fifty products, and a live version inside your product—and suddenly you are rebuilding the same scene four times in four different tools.

The root cause is simple: **rendered pixels are opaque.** You can play a finished file, and that is all you can do with it.

SuperImg makes **one shift**: represent a scene as a **pure function of time, canvas, and data** that returns an inspectable typed tree:

```text
scene(time, size, data) ──▶ typed tree (Frame / Stack / Text / Vector)
                                ├── Player / InteractivePlayer  (live in your app)
                                ├── sequence() / time()         (reused in another work)
                                ├── collection()                (batch campaign kit)
                                └── check → export --for …      (MP4, PNG, SVG, WebM)
```

Just as sheet music turns a single performance into a notation you can inspect bar by bar, transpose for another ensemble, or play live, turning opaque pixels into typed TypeScript media programs unlocks reuse, structural checking, batching, and live interaction from the *same* source—**before a single frame is encoded.**

---

## 30 Seconds of Real Code

First, author one reusable scene module (`announce.media.ts`). Notice what is *absent*: no codec settings, no output paths, and no platform IDs—only content, timing, and responsive layout:

```ts
import { video, Frame, Stack, Text } from "@foxworth/superimg";

export default video({
  size: { width: 1920, height: 1080 },
  duration: "6s",
  sample: { title: "Launch day", eyebrow: "v1.0" },
  editions: {
    square: { size: { width: 1080, height: 1080 } },
  },
  render(ctx) {
    const t = ctx.director({ enter: "20%", hold: "65%", exit: "15%" });
    const compact = ctx.width <= ctx.height;

    return Frame(
      { width: "fill", height: "fill", fill: "#0b1020" },
      Stack(
        { width: "fill", height: "fill", align: "center", justify: "center", gap: 18 },
        Text({ variant: "eyebrow", color: "#93c5fd" }, ctx.data.eyebrow),
        Text(
          {
            variant: "display",
            color: "#ffffff",
            size: compact ? 64 : 84,
            maxWidth: ctx.width * (compact ? 0.78 : 0.85),
            align: "center",
            motion: t.motion({ y: 24, exit: true }),
          },
          ctx.data.title,
        ),
      ),
    );
  },
});
```

Now give that **exact same module** three different lives without copying it:

**1. Import it into a larger film (`launch.media.ts`):**

```ts
import { sequence, time } from "@foxworth/superimg";
import opener from "./opener.media";
import announce from "./announce.media";

const launch = sequence([
  { id: "opener", content: opener, hold: "1.5s" },
  { id: "announce", content: announce },
]);

export default time(launch, { size: { width: 1920, height: 1080 }, fps: 30 });
```

**2. Play it live inside your React or browser app:**

```tsx
import { Player } from "@foxworth/superimg/react/player";
import announce from "./announce.media";

export function LaunchBanner() {
  return <Player media={announce} data={{ title: "Media as code" }} controls />;
}
```

**3. Check it, inspect a frame, and export for every destination:**

```bash
npx superimg check announce.media.ts
npx superimg inspect announce.media.ts --at 1.5s --png
npx superimg export announce.media.ts --for youtube --for 1080x1920.mp4 --for instagram-square
```

Need programmatic export or single-frame rendering from Node without shelling out to the CLI? Pass the exact same value to `@foxworth/superimg/runtime`:

```ts
import announce from "./announce.media";
import { init, check, render, exportMedia } from "@foxworth/superimg/runtime";

const runtime = await init();
try {
  await check(announce, { runtime });
  const frame = await render(announce, { runtime, as: "html", at: "1.5s" });
  const bundle = await exportMedia(announce, { runtime, for: ["youtube", "instagram-square"] });
  try {
    for (const artifact of bundle.artifacts) {
      await artifact.bytes(); // portable stream/bytes; host owns publication
    }
  } finally {
    await bundle.dispose();
  }
} finally {
  await runtime.dispose();
}
```

---

## Why One Idea Unlocks Four Things

Every concept in SuperImg earns its name only when a concrete problem demands it.

### 1. One scene, many lives (`size` + `editions` + `--for`)

`render(ctx)` receives content coordinates (`ctx.width`, `ctx.height`, `ctx.data`, `ctx.timeline`) and **never** receives destination IDs, codecs, or output paths. Your root render reflows across aspect ratios; add an explicit **`editions`** entry only when an exact aspect ratio deserves different art direction.

Before reading the table below, pause and predict: **what happens if you run `superimg export hero.media.ts --for instagram-square` on a 16:9 video that has *no* `editions.square`?**

```text
authored scene          requested target        result

1920×1080 + square ed.  instagram-square        renders square edition (1080×1080)
1920×1080 (no edition)  instagram-square        MISSING_EDITION (refused before encode)
1920×1080               1080x1920.mp4           reflows root render to 1080×1920
```

SuperImg refuses to silently letterbox landscape artwork into a square frame. Choose an explicit helper (`video()`, `image()`, `svg()`, `ogImage()`, or `define()`) so each medium keeps honest defaults without pretending one unchanged layout fits everywhere.

### 2. Catch broken frames before encoding (`check` + typed tree)

Because `render(ctx)` returns a typed tree (`Frame`, `Stack`, `Text`, `Vector`, `vector.*`) rather than an opaque video stream or raw HTML string, `superimg check` inspects layout geometry, contrast, and temporal continuity *before* launching an encoder:

```text
defect in source                      caught by `check`
────────────────────────────────────  ──────────────────────────
Text placed on an unpainted stage     UNPAINTED_STAGE
Dark text on a dark fill              LOW_CONTRAST_TEXT
Collapsed box or empty container      ZERO_BOX / EMPTY_CONTAINER
Tiny artwork lost on a square stage   SPARSE_FOCAL
Unstable node identity across frames  IDENTITY_FLICKER
```

> **Be clear about what `check` proves:** Structural checks catch missing backgrounds, broken contrast, collapsed geometry, and missing editions before rendering. They cannot judge whether a composition *looks* great—or measure text contrast over opaque `Image()` / `Html()` escape-hatch artwork. For visual truth, capture frames with `inspect --at 1.5s --png` (or `--review` for procedural scenes) and look with your own eyes.

### 3. Compose scenes & campaign kits (`Program` + `collection`)

Two higher-level structures fall straight out of pure media definitions:

- **Reusable compositions (`sequence`, `together`, `choose` → `time`):** Combine stills, videos, and nested programs under stable path IDs (`opener`, `chapter/demo`) with local asset scoping and timed audio, then project the same `Program` into a timed video or a host-driven manual presentation (`@foxworth/superimg/player/program`).
- **Batch collections (`collection`):** Materialize one media program against a static array or a server-only provider. Before browser bundling, the compiler splits server data from media code so secrets, Node imports, and raw datasets never leak into browser bundles or IR artifacts:

```text
catalog.media.ts
  ├── entries: loadProducts()  ──▶ server snapshot (frozen once, never bundled to browser)
  └── media: image<Product>()  ──▶ browser-safe MediaDefinition × N entries × destinations
```

### 4. Drive it live, make it interactive, or tell whole stories

Because the browser `Player` evaluates the exact same deterministic render function as the exporter, your media doesn't retire after export:

- **Passive & driven playback (`@foxworth/superimg/player`, `/player/dom`, `/react/player`):** Play scenes inline, or attach `drive="scroll"` (page story) or `drive="pointer"` (scrub/follow) without rewriting animation logic.
- **Singular interactive scenes (`@foxworth/superimg/interactive/define` + `/react/interactive`):** Author live host-controlled widgets with named semantic actions and step guides—kept in a dedicated import so ordinary playback carries zero interactive weight, and never wrapped in `collection()`.
- **Multi-shot stories (`@foxworth/superimg/film`, `/script`, `/takes`):** Author script-driven, multi-shot films with shared `visual()` rigs (`Instance` / `Scene`), multi-track audio, cue-aligned stills, and portable takes.
- **Host & agent automation (`@foxworth/superimg/inspection/boundary`, `@foxworth/superimg-interactions`):** Mount Boundary-native Preview, Media, Edit, Render, and Script Programs with scoped footprints, static multi-step workflow `Plan`s (`createMediaCheckPlan`, `createMediaPublishPlan`, `analyzeMediaPlan`), and atomic hot-reload `BindingSlot`s (`createPreviewInteractionSlot`, `createMediaInteractionSlot`).

---

## The Whole Model in One Picture

```text
*.media.ts  ──▶  MediaDefinition / Program (pure function of time, size, data)
                        │
                ┌───────┼───────────────┬────────────────────┐
                ▼       ▼               ▼                    ▼
             `check`  Player       collection()        `export --for`
         (structural  (live app /   (N entries ×      (canvas + encoder →
          preflight)   scroll /      frozen snapshot)  atomic bundle)
                       interactive)
```

**When to use SuperImg:** Use it when media needs to live in your repo, react to data, stay consistent across formats, or run inside your software. For a one-off hand-edited video cut with bespoke timeline tweaks, a traditional NLE is the right tool.

---

## Build With Your Coding Agent & Run Locally

SuperImg ships authoring skills covering brief, visual design, motion craft, review, variants, and export:

| Agent | Install |
| --- | --- |
| Claude Code | `claude plugin marketplace add anaptfox/superimg && claude plugin install superimg@superimg` |
| Grok CLI | `grok plugin install superimg --trust` |
| Codex, Cursor, Windsurf, Cline, and others | `npx skills add anaptfox/superimg -a <agent>` |

Give your coding agent a concrete first project and a second use:

> Add SuperImg to this project. Create a short launch scene in its own `*.media.ts` module with explicit sample data. Import that scene into a second composition instead of copying it. Check the media, inspect the rendered frames, and export a video and a poster. Keep reusable source in the repo.

### Verify your environment & run the README example

```bash
# Check Chromium readiness (run `npx superimg setup` only if doctor reports CHROMIUM_MISSING)
npx superimg doctor --json

# From this repository checkout, run the verified README example test:
pnpm --filter @foxworth/superimg exec vitest run src/__tests__/readme-example.test.ts
```

**Trust boundary:** The CLI (`@foxworth/superimg-cli`) compiles first-party `*.media.ts` files in-process; downstream hosts compile them with their own Rolldown/OXC and pass realized values into runtime and player. SuperImg does not publish a general compiler library, and untrusted user-submitted templates are out of scope. See [SECURITY.md](SECURITY.md).

---

## Where to Go Next

| Goal | Start here |
| --- | --- |
| Learn the core model & write your first scene | [Getting started](https://taronfoxworth.com/superimg/docs/getting-started) · [Concepts](https://taronfoxworth.com/superimg/docs/concepts) |
| Author scenes, layouts, vectors, audio, and charts | [API reference](docs/api.md) · [Typed charts](docs/charts.md) · [Audio](docs/audio.md) |
| Embed passive, scroll-driven, or interactive media | [Player guide](docs/player-guide.md) · [Semantic scenes](docs/semantic-scenes.md) |
| Build script-driven multi-shot films & takes | [Film guide](docs/film.md) · [Scripts](docs/scripts.md) · [Takes](docs/takes.md) |
| Inspect live previews & automate edits/exports with Boundary | [Browser inspection](docs/inspection.md) · [Exact source edits](docs/exact-source-edits.md) · [Native media interactions](docs/interactions.md) |
| Browse examples & contributor gates | [Example index](examples/README.md) · [Testing guide](docs/testing.md) · [Docs index](docs/README.md) |

### Packages & Subpaths

| Import | Role |
| --- | --- |
| `@foxworth/superimg` | Authoring helpers (`video`, `image`, `svg`, `ogImage`, `define`, `collection`), layout & vector tree, `sequence`/`together`/`choose`/`time`, `visual`/`Instance`/`Scene` |
| `@foxworth/superimg/runtime` | Value-first `init`, `check`, `inspect`, `render`, `renderResponse`, `exportMedia`, `shutdown` |
| `@foxworth/superimg/runtime/html` | Pure synchronous request-time HTML projection |
| `@foxworth/superimg/player` · `/player/dom` · `/player/program` | Framework-neutral passive, DOM-only, driven, and manual Program playback |
| `@foxworth/superimg/react/player` · `/react/interactive` | Passive React `<Player>` and singular `<InteractivePlayer>` (opt-in authoring shell compiler: `/react/compile`) |
| `@foxworth/superimg/interactive/define` · `/interactive/player` | Singular host-driven interactive definitions and framework-neutral controllers |
| `@foxworth/superimg/film` · `/script` · `/takes` | Multi-shot story authoring, script cue alignment, and portable takes |
| `@foxworth/superimg/inspection` · `/inspection/boundary` | Live preview snapshots, semantic bounds, Boundary preview mount & atomic hot-reload slots |
| `@foxworth/superimg/browser-export` · `/destinations` · `/charts` | Browser DOM/SVG/PDF capture, schema-0 destination catalog, typed charts |
| `@foxworth/superimg-cli` | CLI binary (`superimg`: `dev`, `check`, `inspect`, `export`, `edit`, `doctor`, `setup`) |
| `@foxworth/superimg-interactions` | Node-only Boundary Media, Edit, Render, and Script Programs, static workflow `Plan`s, and hot-reload `BindingSlot`s |

## License

Open source under the MIT License. See [LICENSE](LICENSE).
