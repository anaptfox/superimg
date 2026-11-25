# Live browser inspection workflow

Use one browser while investigating a preview, editing source and comparing the
result. The transport is agent-browser 0.39.1; the host supplies SuperImg's accepted
presentation. The developer command uses the same capture procedure as the tests.

## Start the preview and browser

```sh
just build-render
pnpm --filter superimg-example-agent-inspection dev
```

In another terminal, start a named browser:

```sh
tests/integration/node_modules/.bin/agent-browser --session my-inspection --headed open http://127.0.0.1:4190
just browser-inspect --session my-inspection --surface story --frame 6
```

Keep the same executable, environment and configuration for subsequent commands.
If you use a config file, pass that same `--config` to both commands. Capture
inspects an existing browser; it does not build, launch or reload one. It leaves
the requested frame held in inspection mode.

Use the named-session commands above for the qualified 0.39.1 workflow. The
separately installed personal `agent-browser-workflow` helper also supports exact
0.39.1, including persistent resume, observation, and owned-session close. Select
this project's executable and preserve its configuration across commands.

The repository also accepts `--session-file PATH` from a producer qualified for
the same executable version. It reads that record without importing personal
skill code, and locks it until capture and evidence are saved. Preserve an older
session's original executable; a dependency update does not migrate a running
browser or make its saved identity current.

## Read and compare evidence

The JSON summary links a new directory. `capture.json` pairs the before/after
accepted packets, consistency verdict, source freshness, geometry, diagnostics and
image hashes. `media.png` is the comparison subject; `capture.png` retains the
surrounding viewport as context. Both come from one browser screenshot, so cropping
does not scroll, re-seek or take a second exposure. `commands.json` retains raw
output, stderr, exit status, timing and parse failures. Missing or offscreen media
geometry prevents an accepted media crop; a partially clipped crop cannot be a
comparison baseline.

Consistency acceptance requires the requested frame, ready resources and
inspection clock ownership, with stable generation, accepted revision, compilation
state, source, selection coordinates, geometry and browser document/target around
capture. Freshness is a separate result: `matched` means the accepted output matches
the host's expected compiled source; `stale` means compilation is pending/failed or
the identities differ; `unknown` means the host has insufficient source identity.
A consistent capture can preserve old artwork while a new compilation has failed.
The CLI exits nonzero for rejected or stale evidence and keeps the report and any
available pixels. It never silently selects or captures again. Selection failures
may leave a report without pixels.

Pin a known expected output revision when the host does not provide compilation
intent, or when testing a particular edit:

```sh
just browser-inspect --session my-inspection --surface story --frame 6 \
  --expected-revision COMPILED_REVISION
```

Use the host's exact accepted-output identity. For ordinary dev preview this is
`source.revision` from `/api/template-bundle`, paired with its `inputIdentity`;
`/api/config` and IR also expose the paired identities. Checkout HEAD, a file's
mtime and a new Player revision are not substitutes. A wrong expected revision
rejects the capture. Hosts that cannot establish it continue to report `unknown`.

The runner uses the host's exposed `window.superimgInspection` JavaScript entry.
`--entry fixture` selects the repository test adapter. Native WebMCP admission,
withdrawal and checked outcomes remain a separate tested path. The application
decides whether to expose a JavaScript inspection object.

Keep the previous `capture.json`, make the edit, and use the normal build/HMR
workflow. Render-stack edits still require `just build-render`. Then reselect:

```sh
just browser-inspect --session my-inspection --surface story --frame 6 \
  --compare /absolute/previous/capture.json
```

Comparison requires accepted captures with the same capture backend, browser
version, source ID, URL, selection coordinates, media dimensions, fps/frame count,
selected frame and part/route/step. Media crop scale, DPR and decoded image size
must agree, both crops must be fully visible, and the baseline bytes must match
their recorded hash. Missing identity/geometry is an explicit incompatibility.
Source revisions and generations may change across an edit; the current source
cannot be stale. Surrounding inspector layout can move without changing the media
comparison subject. `diff.png` marks exact changed media pixels at threshold zero;
a change is evidence, not automatically a regression. Invalid comparisons exit
nonzero with the specific mismatch. Unknown source freshness stays labeled unknown.

The host reports source identity when known. Checkout HEAD and a new presentation
revision do not prove the browser loaded current dirty source. The public example
identifies its bundled story, host and stylesheet sources separately from the SuperImg dependency build.
Keep those scopes separate in the finding.

For DOM layout, join canonical node/occurrence IDs with authored and viewport
bounds, computed typography and SVG text metrics. Rich observations stop at 800
DOM nodes and 120 characters per text field and report truncation. SVG `getBBox()`
uses SVG user space; it is not a viewport or ink box. Canvas interiors, cross-origin
frames and unresolved source mappings remain explicit coverage limits. Media
capture acceptance does not establish craft, encoded output or device acceptance.
Source-language parsing still belongs to compiler/source tools.

## Ordinary dev inspector

Open **Inspector**, select a frame and choose **Capture media**. This path uses
SnapDOM DOM rasterization and the same portable accepted-capture guard; it does
not require agent-browser. The packet pairs output bytes with copied warnings,
frozen capture geometry, requested/actual sizing and a bounded DOM context.
Warnings are read after export/context completes. Backend identity distinguishes
these captures from Chromium screenshot evidence.

Choose **Use as baseline**, make the edit through normal HMR, capture again, then
**Compare media**. Selection, frame, canvas and backend must remain comparable.
Only media pixels enter the diff. Select a node for its bounds, typography,
source-mapping status and detail crop. Technical findings must match the accepted
source and frame; otherwise the view labels them unverified. **Save evidence**
downloads the accepted/rejected report, source freshness, capture facts and hashed
image bytes together. Visual review remains `unreviewed` until a person or craft
review actually judges the result. A syntax error keeps accepted artwork visible
while compilation/freshness becomes failed/stale; recovery must accept a new
compiled source before freshness becomes matched.

## Checks and recovery

`pnpm test:browser-inspection` builds the render stack and runs integration tests.
After a successful build, focus work on one case:

```sh
pnpm --filter @superimg/integration-tests test:browser-inspection browser-inspection/capture.e2e.test.ts
```

Malformed CLI output and upstream `outcome_unknown` are unknown outcomes with
retained diagnostics, including when a caller requests known failure responses.
The wrapper adds no retry. Upstream 0.39.1 does not replay mutations after request
bytes were sent; it can retry read-only commands and failures before sending.
Inspect the resulting page state before another input when an outcome is unknown.
Inspect changed configuration, replaced daemons and failed preview servers before
continuing. Chromium launch denial is not a reason to reinstall the browser.
Leave a requested live browser open. Close only the owned session:
`agent-browser --session my-inspection close`.

Browser diagnostic buffers are observations, not complete histories: console,
errors and requests are capped at 100 entries with 2,000-character text fields;
serialized CLI sections are bounded and mark truncation. Agent-browser error
buffers are unscoped, and request coverage starts only when collection begins.
Node rendered-layout diagnostics instead attach an operation window and dropped
counts so a reused page cannot attribute prior-job events to this frame. HTTP
errors and transport failures remain separate observations.

Use `--trace` only when diagnosing a capture. It records a Chrome JSON trace around
selection/capture and saves `trace.json`, including a trace-stop error if one
occurs. Node host opt-in inspection traces are separately labeled Playwright ZIPs.
Recording must start before a failure to preserve its activity, and trace overhead
belongs outside ordinary benchmark trials.

```sh
just browser-inspect --session my-inspection --surface story --frame 6 --trace
just browser-inspect --session my-inspection --surface story --frame 6 --explore
```

`--explore` requests snapshot deltas and conditional screenshots for repeated
observations. Its result is explicitly `unverified`; unchanged output may produce
no new image, and `--compare` cannot be combined with it. Take a normal capture
for final accepted evidence. Never run reloading vitals against a held frame or
install a fake browser clock in latency measurements. Use the
[benchmark method](../tooling/benchmarks/README.md) for raw samples, exact identities
and compatible baselines. The native headed browser remains the baseline live
view; stream viewers have separate qualification. A live session does not imply
background monitoring.

The unavailable-WebMCP acceptance fixture also passes
`--args --disable-blink-features=WebMCP`. agent-browser's `--no-webmcp` disables
its observation and experimental enable flags; it does not guarantee that a
newer Chromium hides the page API. The fixture records its explicit launch
configuration and checks API absence, an empty native catalog and working
ordinary JavaScript playback.
