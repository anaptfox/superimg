# Inspect a mounted preview

Keep a task-owned browser open across observations and edits when requested.
Preserve executable/configuration, target, URL, viewport and the last evidence
path. Use the installed browser tool's version-matched help.

For a host exposing `window.superimgInspection`, use the existing
[browser inspection contract](api.md#browser-inspection): discover the surface,
read a fresh generation, enter inspection mode, select the frame, and await its
accepted presentation and resources. Capture pixels, inspect again, and reject
changed generation, accepted revision, compilation state, target, geometry,
selection coordinates, readiness or clock ownership. Save rejected evidence;
do not silently recapture. Consistency and source freshness are separate facts:
`matched` means accepted source equals the host's expected compiled output,
`stale` covers pending/failed compilation or mismatched identities, and `unknown`
means identity is unavailable. Stable old pixels during a compile failure remain
stale evidence.

In the SuperImg repository, the test/developer procedure is executable:

```sh
just browser-inspect --session my-inspection --surface story --frame 6
just browser-inspect --session my-inspection --surface story --frame 6 \
  --compare /absolute/previous/capture.json
just browser-inspect --session my-inspection --surface story --frame 6 \
  --expected-revision COMPILED_REVISION
```

Pass the original `--config` when one was used. Use the named-session path unless
a session-file producer is qualified for the same installed CLI version; only
then supply its `session.json` as `--session-file PATH`. The command observes an
existing host and leaves its frame held; it does not build or launch a preview. Outside
this repository, use the same host API sequence with the available browser driver.
No personal skill installation is required.

The repository transport is qualified with agent-browser 0.39.1. Malformed CLI
output and `outcome_unknown` stop capture as uncertain; retain the command
transcript and inspect the page before another input. The wrapper does not retry.
Upstream can retry read-only commands and failures before sending, but does not
replay mutations after request bytes were sent. An unknown outcome does not mean
the action failed or that repeating it is safe.

Read the compact result, then relevant packets and images. `media.png` is the
comparison subject; `capture.png` retains viewport context from the same exposure.
The report records both hashes, crop mapping, diagnostics and source freshness.
Comparison requires the same backend/browser version, source ID, selection,
frame, media size/clock, crop scale and DPR, plus intact baseline image bytes.
Clipped crops and stale current source cannot compare. Source revisions and
generations may change across edits; inspector UI movement alone must not become
a media-pixel change.

Host `source`, a successful build and an accepted frame have different scopes.
For ordinary dev preview use the exact `source.revision` from
`/api/template-bundle`, paired with compiler input/projection identities;
checkout HEAD or a Player revision is insufficient. `--expected-revision` rejects
a different output. Unknown freshness remains unknown. Rebuild the render stack
after changing its packages, even when the browser remains open.

The ordinary dev **Inspector** can Capture media, Use as baseline, Compare media
and Save evidence without browser automation. It labels SnapDOM rasterization
separately from Chromium screenshot capture. Saved evidence includes image bytes,
hash, consistency/freshness and SnapDOM warnings/geometry after export completes.
Node selection shows canonical identity, bounds, computed typography, source
mapping and detail pixels. Technical findings must match accepted source/frame.
Visual review remains unreviewed.

Use semantic nodes and bounds to locate a problem; use pixels to judge the result.
Rich DOM context is bounded at 800 nodes and 120 characters per text field with
truncation coverage. SVG text bounds identify SVG user space. Canvas interiors,
cross-origin frames and unresolved source mappings remain limits. Diagnostics
are bounded at 100 console/error/request entries and 2,000-character text fields;
agent-browser histories are not automatically scoped to this frame. Native WebMCP
acceptance still requires discovery, admission and checked outcomes.

Use `superimg-review` for craft and export evidence. A small layout edit needs
a focused comparison; renderer changes need relevant tests. For performance,
use `--trace` for an opt-in Chrome JSON diagnostic recording and keep its overhead
outside ordinary timing trials. `--explore` provides snapshot deltas/conditional
pixels as unverified observations; it cannot combine with `--compare` or replace
a final normal capture. Reloading vitals must not disturb a held frame, and fake
clocks must not enter latency measurement. Use the project's benchmark method
with raw samples, exact identities and compatible baselines. Keep the session
reference in the handoff when live work continues.
