# Agent inspection

A public consumer host for `@foxworth/superimg/inspection`. It presents a seven-frame
composition at 25 fps, with named opener/chapter parts and two chapter routes.
The host exposes `window.superimgInspection` in every browser. When the Boundary
SDK detects WebMCP, it registers only the enabled preview tools for the `story`
surface. The checkbox supplies explicit host admission; withdrawal disposes the
registration and revokes its installation.

From the repository root:

```bash
pnpm build:render
pnpm --filter superimg-example-agent-inspection dev
```

Open http://127.0.0.1:4190. Select frame 6, inspect the snapshot, and capture the
preview while its clock owner is `inspection`. Select chapter to go to its first
frame, or change its route. Return to live restores the prior playback state;
this example starts paused.

For repeatable agent capture, use `just browser-inspect --session NAME --surface
story --frame 6`, or pass a shared workflow's `--session-file PATH`. It verifies
the accepted state before and after the screenshot and can compare a previous
capture with `--compare PATH`. See [the live workflow](../../../docs/browser-workflow.md).

The host reports a SHA-256 revision of its bundled story, host and stylesheet
source. This identifies those example inputs; it does not identify the compiled
SuperImg dependency build. Rebuild the render stack after library changes.

Ordinary JavaScript capture preparation:

```js
const inspection = window.superimgInspection;
const before = await inspection.inspect({ surfaceId: "story" });
const owned = await inspection.setMode({
  surfaceId: "story", expectedGeneration: before.generation, mode: "inspection",
});
const shown = await inspection.seek({
  surfaceId: "story", expectedGeneration: owned.generation, frame: 6,
});
// Save shown, take the browser screenshot, then inspect again and compare
// generation and presented.revision before returning to live.
```

The browser tools come from `@foxworth/superimg/inspection/boundary` and registration from
`@foxworth/boundary/webmcp`; ordinary Player and inspection imports have no SDK
requirement. A standalone host installs `superimg`, `@foxworth/boundary`, and the
SDK's current `zod` schema peer. The JavaScript object is an explicit trusted development surface,
so it remains available when WebMCP admission is disabled or tools are withdrawn.
An application can keep that object private or wrap it in its own host policy.

See [Browser inspection](../../../docs/inspection.md) for discovery, the exact
capture sequence, readiness limits, and the repository acceptance command.

## From selection to a source revision

[Revision review](../revision-review/README.md) is the next companion example.
This example stays focused on accepted preview state and admission. The companion
joins a selected named part to supported source edits, compares frozen original
and candidate captures, and applies an exact command with current preconditions.

A visible node or a measured coordinate is not an editable source binding.
Literal source properties can expose exact edits; expressions, imported targets,
and mismatched editions must explain why they remain inspect-only. A preview
reference does not grant edit permission. The native host admits each request
and rejects changed source preconditions.

Keep three kinds of evidence separate: source bindings describe supported edits,
authored review observations describe what the author measured, and captures
show pixels from identified inputs. Pixel capture still requires visual review.
If an edit may have started but its outcome is unknown, reconcile that original
attempt; do not replay it as an ordinary failed request. The companion exposes
explicit Reconcile and Undo controls to demonstrate that distinction.
