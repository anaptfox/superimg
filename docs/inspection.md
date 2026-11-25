# Browser inspection

Creators and their agents can inspect a running SuperImg preview, select an exact
frame, navigate named parts, and capture the result. Application hosts mount
`@foxworth/superimg/inspection` around their existing Player. The same JavaScript contract
powers the development inspector and optional page tools.

For the repository's persistent developer loop and executable capture procedure,
see [Live browser inspection workflow](browser-workflow.md). The contract below
is independent of the personal shared workflow and works in other hosts.

## Mount an inspection surface

```ts
import { createPreviewInspection } from "@foxworth/superimg/inspection";

const inspection = createPreviewInspection({ readinessTimeoutMs: 5_000 });
const attached = inspection.attach({
  surfaceId: "preview",
  player,
  // Add a ProgramSession for named parts and route selection:
  // presentation: session,
  source: { id: "launch", revision: sourceRevision },
  controls: ["set-mode", "seek-frame"],
});
```

Wait for the Player's successful load before selecting a frame. A surface ID is
unique within this registry. Each attachment has its own clock ownership and
generation; multiple Players can share one registry. The host supplies source
identity when it knows it. The inspector does not derive a source hash from a
render function.

`inspect({ surfaceId })` observes state. Controls are enabled individually by the
host and require `expectedGeneration`, obtained from a fresh snapshot. `list()`
reports the available surfaces, generations, and controls. Pure inspection has
no Boundary requirement and can remain private to the host.

## Capture one exact frame

```ts
const before = await inspection.inspect({ surfaceId: "preview" });
const owned = await inspection.setMode({
  surfaceId: "preview", expectedGeneration: before.generation, mode: "inspection",
});
const shown = await inspection.seek({
  surfaceId: "preview", expectedGeneration: owned.generation, frame: 6,
});
if (shown.presented?.frame !== 6 || shown.readiness.status !== "ready") {
  throw new Error("The selected frame is not ready for capture");
}

// Save shown and capture a browser screenshot while inspection still owns the clock.
const after = await inspection.inspect({ surfaceId: "preview" });
if (after.generation !== shown.generation ||
    after.presented?.revision !== shown.presented?.revision ||
    after.readiness.status !== "ready" || after.clock.owner !== "inspection") {
  throw new Error("The presentation changed during capture");
}
await inspection.setMode({
  surfaceId: "preview", expectedGeneration: after.generation, mode: "live",
});
```

Frames are integers in `0..totalFrames - 1`. A seven-frame movie accepts frame 6
and rejects frame 7. Entering inspection mode pauses playback and suspends the
Player's scroll/pointer driver. Ownership persists through separate screenshot
calls and panel closure. Returning to live restores the suspended driver and
the playback state that existed when inspection began.

Custom host clocks use `suspendInput: () => resumeInput`. Its return value restores
the host's input subscription or clock on live mode or detach. A driven Player
that cannot suspend its clock fails exact inspection. Observation remains
available. Other host code can still reload or seek the Player; the generation
and revision checks detect those changes.

## Read the snapshot

| Field | Meaning |
|-------|---------|
| `generation` | Current Player load/session generation; reload invalidates older targets |
| `requestedFrame` | Most recently requested frame, including work not yet accepted |
| `presented.frame`, `presented.revision` | Last render accepted by the mounted presenter |
| `clock` | Current preview clock owner and playback state |
| `parts`, `currentPart`, `routes`, `activeOccurrences` | Named Program structure, committed selections, and active local clocks |
| `stepId`, `semantic` | Guide position and semantic state paired with the accepted render |
| `nodes` | Surface-scoped node identity, occurrence, scene/action metadata, and measured bounds |
| `geometry` | Surface/iframe rectangles, DPR, and host-viewport coordinate space |
| `readiness` | Resource barrier status for this accepted presentation |
| `coverage` | Measured DOM coverage and opaque canvas/iframe regions |

DOM node `bounds` are CSS pixels in the host viewport, suitable for browser
pointer coordinates. `authoredBounds` describe the root authored canvas when
the scale mapping is available. Qualified occurrence paths distinguish repeated
node IDs in different composition children. Enable occurrence metadata when
presenting a retained Program with `inspection: true`.

Awaited Player seek establishes DOM presentation. The inspection selection
methods also wait for active external stylesheets and their fonts, decoded `<img>` elements,
CSS and pseudo-element image URLs, SVG images, and native video frame readiness. `inspect()` alone does not start that barrier:
`unverified` is a valid observation. Resource failures, timeouts, and superseded
presentations reject the selection. Hosts can extend the barrier through the
attachment's `readiness({ document, signal, frame })` callback for canvas or
other application resources. Arbitrary script work still needs a host readiness policy.

Canvas/WebGL interiors remain opaque to DOM measurement. A host can supply a
`sidecar` with semantic state and node bounds for the exact generation/revision.
Those host claims appear alongside opaque pixel coverage. A semantic snapshot
or retained IR describes structure; a screenshot supplies browser pixel evidence.
Neither establishes decoded export or physical device acceptance.

## Select parts, routes, and guide steps

Attach a `ProgramSession` from `present()` to enable named controls. Use
`mode: "manual"` for a deck or `mode: "timeline"` for one continuous composition.
Include `select-part` and `select-route` in the surface's `controls` as needed:

```ts
const before = await inspection.inspect({ surfaceId: "preview" });
const selected = await inspection.selectPart({
  surfaceId: "preview", expectedGeneration: before.generation, partId: "chapter",
});
const routed = await inspection.selectRoute({
  surfaceId: "preview", expectedGeneration: selected.generation,
  path: "chapter/explanation", selection: "advanced",
});
```

Enter inspection mode first. Routes can prepare and load a new composition,
changing its frame count and generation; use the returned generation for the
next control. A failed route retains the previous committed route and display.
Selecting an already-current part or route avoids a reload. An obsolete target
fails before changing state.

For a guide, attach `interactive: interactivePlayer`, enable `select-step`, and
call `selectStep({ surfaceId, expectedGeneration, stepId })`. Semantic actions
stay with the host and `InteractivePlayer`. Actual browser clicks are still
needed to test hit targeting and audience behavior.

Failures carry a `PreviewInspectionError.code`, including `STALE_GENERATION`,
`FRAME_OUT_OF_RANGE`, `CLOCK_NOT_OWNED`, `CONTROL_NOT_ENABLED`,
`PRESENTATION_SUPERSEDED`, and resource errors. Disposed Players detach their
surface; calls to a withdrawn surface or disposed registry fail. Keep one
current registry and fresh generation values across reloads.

## Optional Boundary page tools

Install the optional host SDK and its current schema peer:

```bash
npm install @foxworth/superimg @foxworth/boundary zod
```

This enables `@foxworth/superimg/inspection/boundary`. The host chooses
which controls to project, limits surfaces, and supplies admission. Registration
uses the SDK's `@foxworth/boundary/webmcp` entry:

```ts
import { createPreviewInteractionMount } from "@foxworth/superimg/inspection/boundary";
import { isWebMcpAvailable, registerWebMcpBinding, webMcpTools } from "@foxworth/boundary/webmcp";

const preview = await createPreviewInteractionMount<{ mayInspect: boolean }>({
  inspection, installationId: "launch-preview",
  allowedSurfaces: ["preview"],
  expose: ["list", "inspect", "setMode", "seekFrame"],
  admit: ({ context }) => context.mayInspect
    ? { decision: "allow" }
    : { decision: "deny", reason: "Preview inspection is disabled" },
});
const registration = isWebMcpAvailable()
  ? await registerWebMcpBinding({
      binding: preview.binding, tools: webMcpTools(preview.projection),
      context: () => ({ mayInspect: hostPolicy.previewInspectionEnabled }),
    })
  : undefined;

// Host teardown, in order:
registration?.dispose();
preview.dispose();
attached.dispose();
inspection.dispose();
```

Admission reads host-created context for every invocation. Browser claims and
tool input are not permission. Exposed controls are absolute selections;
relative next/previous and generic action dispatch are outside the initial
preview tools. The initial interaction IDs are `media.preview.list`, `.inspect`,
`.set-mode`, `.seek-frame`, `.select-part`, `.select-route`, and `.select-step`.

Capability detection can fall back to ordinary JavaScript. A development host
may explicitly expose `window.superimgInspection = inspection`; a browser agent
can evaluate the capture sequence above. That object is a trusted host surface,
separate from Boundary admission. Production hosts decide whether to expose it
or supply a policy-aware wrapper. The [consumer example](../examples/apps/agent-inspection/README.md)
shows fallback, per-invocation admission, and withdrawal.

## Use agent-browser

The repository pins agent-browser 0.39.1 for its browser inspection suite. Its
native WebMCP runner uses a compatible experimental browser; ordinary browsers
can still use the JavaScript API. Discover the mounted tool schemas before
invoking them:

```bash
agent-browser --session preview --json open http://127.0.0.1:4190
agent-browser --session preview --json webmcp list
agent-browser --session preview --json webmcp list media.preview.inspect
agent-browser --session preview --json webmcp invoke media.preview.inspect --params '{"surfaceId":"story"}' --timeout 10000
```

Read the generation from the returned snapshot. Invoke `media.preview.set-mode`
with `mode: "inspection"`, then `media.preview.seek-frame` with that generation
and the desired frame. For example, when the current generation is 1:

```bash
agent-browser --session preview --json webmcp invoke media.preview.set-mode --params '{"surfaceId":"story","expectedGeneration":1,"mode":"inspection"}' --timeout 10000
agent-browser --session preview --json webmcp invoke media.preview.seek-frame --params '{"surfaceId":"story","expectedGeneration":1,"frame":6}' --timeout 10000
agent-browser --session preview screenshot /absolute/path/preview.png
```

Read the CLI's completed `output` (decode JSON if it is a string) and check the Boundary
outcome: `certainty === "completed"` and `result.kind === "returned"`. The
snapshot is `result.value`. A completed CLI status alone does not establish a
successful selection. Save the inspection JSON, accessibility snapshot, and
screenshot together; inspect again after capture and compare generation and
accepted revision before returning to live. Select the correct browser frame
when the host page is itself embedded.

## Development and acceptance

`superimg dev` includes a Preview inspector with exact frame selection,
persistent inspection/live mode, resource status, the versioned snapshot, and
accepted HTML. Its JavaScript surface is `window.superimgInspection` and its
surface ID is `dev-preview`. Closing the panel leaves its selected frame held.

From the repository root:

```bash
pnpm test:browser-inspection
pnpm verify:inspection
```

The focused command runs browser inspection acceptance. The aggregate command
includes repository checks and the separate example catalog gate. A native
WebMCP case requires actual discovery, invocation, and checked outcomes; a
JavaScript fallback does not satisfy that gate. Evidence from a specific run
determines which browser, resource, and driven-playback cases passed.

## Selected source parts

`describeSelectedPart()` from `@foxworth/superimg/inspection` joins a ready accepted
`PreviewSnapshot` with a host-supplied compilation (source revision, coordinates,
manifest and source hashes). It refuses stale presentation/generation/source,
coordinate mismatch and ambiguous nodes. Imported or repeated occurrences remain
inspect-only until the host has an exact occurrence-to-source binding.

`selectedPartTransform(part, { x, y })` constructs the existing edit command only
when both axes have unique exact bindings. It does not execute or approve it;
the host must admit each call and the edit engine rechecks source preconditions.
The [revision-review example](../examples/apps/revision-review/README.md) shows
the complete Node host flow. Its captured source inspector and the accepted
Player snapshot join are separate evidence surfaces.

## Capture evidence and source freshness

The ordinary dev inspector holds an accepted frame, captures media, selects an
in-memory baseline, compares media pixels, and saves a JSON evidence packet with
its PNG bytes. It shows technical findings and coverage, selected-node bounds,
rendered typography, clipping ancestors and detail pixels. Source links require verified bindings;
missing bindings remain inspect-only. Capture uses lazy DOM rasterization and
labels that backend. Browser screenshots and encoded outputs retain their own
evidence kinds.

`@foxworth/superimg/inspection` exports `captureAccepted(adapter, options)` and
`captureFreshness(snapshot, expectedSource?)`. The adapter supplies `inspect()`,
`identity()` and one `capture()` operation; the host owns image bytes and storage.
The guard checks detached observations before and after that operation and keeps
rejected evidence. It never retries an uncertain effect.

Capture consistency and source freshness are separate. A host may provide
`compilation` on its attachment with `status: "pending" | "succeeded" | "failed"`,
its current expected `source`, compiler input/projection identities and
`hostGeneration`. The accepted source remains `snapshot.source`.
`captureFreshness` reports `matched`, `stale` or `unknown`. Stable old art after a
failed edit can be a consistent capture while its source is stale. Hosts without
current compilation information remain unknown. Host compile generations and
Player presentation generations are distinct.

Rich `snapshot.observations` include up to 800 DOM nodes and 120 characters per
text field, with explicit truncation and opaque regions. Optional `parentIndex`
links nodes within that bounded observation; `clipping` retains computed overflow,
clip, mask and transform styles. The inspector follows those links for ancestor
bounds and clipping context. Cropped text or style values also set truncation.
These are browser observations, not an occlusion or visual-quality verdict. Existing canonical
nodes and semantic IR are not truncated. DOM boxes use document viewport pixels;
SVG text metrics identify their SVG user coordinate space. `geometry.content`
identifies the authored media's displayed rectangle separately from the iframe.

## Rendered layout, coverage and profiling

`check` and `inspect` share portable frame/sequence analysis with runtime reports,
review packets and export preflight. Coverage names the checks and sampled scope;
one-frame inspection does not establish sequence or visual quality. Vector text
participates in paint and layout analysis, with source/font estimates distinguished
from browser measurements. Complex paint and opaque content remain unverified.

`just cli inspect media.media.ts --rendered-layout` opts into a Node Chromium
measurement at the selected frame, edition and data. It uses prepared resources
and fulfilled resolution. Ordinary semantic inspection remains browser-free;
hosts without that capability report its absence explicitly. Inspect metadata
retains rendered observations; check reports retain findings and coverage.

Add `--profile` to `check` or `inspect` for a separate JSON diagnostics record on
stderr. It contains command-local inclusive phase durations, invocation counts,
and wall time; it leaves the normal stdout report intact. Preparation, bundling,
and evaluation have separate counts; reusing a prepared value adds no compiler
invocations. Durations can overlap and must not be summed. `wallTimeMs` covers
the command action and its module load; `processElapsedMs` includes Node startup
through the final observation. The benchmark launcher measures process exit and
build orchestration separately. With `--rendered-layout`, `--trace` records an optional
Playwright trace ZIP and reports its artifact directory. Tracing is off by default.
Bounded console/error/request observations cover the operation window; they do
not turn browser text or request failures into a visual verdict.
