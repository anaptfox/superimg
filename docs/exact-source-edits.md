# Exact source edits

Use the Node edit engine to change a supported literal in a trusted `*.media.ts` source while retaining the surrounding TypeScript. The engine discovers source bindings, checks the caller's source and intent hashes, compiles a proposed replacement, checks its Media IR effects, and writes the replacement only when asked to apply the plan. A binding marked `exact` is a candidate for an edit; the command can still be rejected when its target or resolved effects do not match.

For a correction to transcript or caption **data**, use the transcript and caption transforms instead. An exact source edit changes the authored program; it is appropriate when the literal in that program is itself what you intend to change. See [transcripts and captions](transcripts.md).

## Discover and apply

Install `@foxworth/superimg-node` and import its Node-only edit entry. The default constructor uses the standard project source compiler; a host can supply `compileSource` in the constructor for its own compilation context. The compiler executes trusted authored code and is not a sandbox.

For a source containing `Text({ id: "title" }, "Before")`:

```ts
import { NodeEditEngine } from '@foxworth/superimg-node/edit';

const engine = new NodeEditEngine({ projectRoot: '/absolute/project/path' });
const source = 'scene.media.ts';
const context = {};
const current = await engine.bindings(source, context);
const binding = current.manifest.bindings.find(
  (item) => item.targetId.endsWith('::title') && item.propertyPath === 'text',
);
if (!binding || binding.capability !== 'exact') {
  throw new Error('The title has no exact text binding');
}

const command = {
  schemaVersion: 0 as const,
  source,
  kind: 'set-node-text' as const,
  target: { nodeId: binding.targetId, textBindingId: binding.bindingId },
  value: { text: 'After' },
  expected: {
    intentHash: current.manifest.intentHash,
    sourceHashes: { ...current.sourceHashes },
  },
};

// Planning compiles the proposed source without writing it.
const plan = await engine.plan(command, context);
console.log(plan.replacements, plan.output.diff, plan.output.verificationFrames);

// Apply only after the host has decided to accept this plan.
const result = await engine.apply(plan, context);
const verification = await engine.verify(plan, result, context);
if (!verification.ok) throw new Error(verification.message);

// A checked inverse is a new edit, not an unconditional file restore.
// It carries the planned post-edit intent and source hashes. Execute it only
// when undo is intended; a subsequent change makes those preconditions stale.
// await engine.execute(result.transaction.inverse, context);
```

Use the full `sourceHashes` map and `intentHash` returned by the same binding inspection. The engine rejects stale preconditions during planning and checks the files again when applying. Reinspect and make a new decision if the source changes; do not substitute old hashes. The host owns selection, authorization, undo history and coordination with other writers. Serialize source writers: the file hash check and final rename are separate operations, not an atomic compare-and-swap.

`apply` recompiles the written source and compares its hashes and intent with the plan. If application fails, it attempts to restore already written files. `NodeEditUncertainError` means restoration could not be established; retain the original plan and reconcile rather than automatically replaying the edit:

```ts
const outcome = await engine.reconcile(plan, context);
if (outcome.status === 'completed') {
  console.log(outcome.value.transaction);
} else if (outcome.status === 'not-applied') {
  // Source is at the planned baseline. Decide what to do next.
} else {
  // The observed state does not establish completion or the baseline.
  // Keep it uncertain until the host can reconcile it.
}
```

For text and property edits, planning also checks the requested value against the identified node in sampled resolved trees before and after the change. If the node is absent from those samples, planning rejects the edit. An injected compiler must provide `semanticCaptures` when `captureNodeSemantics` is requested. `verify` compares source state, compiled intent, the IR diff and a bounded list of verification frames; it does not establish pixel identity or human visual acceptance. An inverse restores the previous literal **value** through a new checked command. It can change literal formatting or quoting; it is not a byte-for-byte restoration of the original file.

## Preview before applying

`previewNodeEdit` independently plans the command and prepares two revisions. It does not write the source. Supply output targets supported by the host's Node render environment, compare the same frame, and dispose the preview:

```ts
import { previewNodeEdit } from '@foxworth/superimg-node/edit';

const preview = await previewNodeEdit(engine, command, context, {
  targets: ['1080x1080.png'],
});
try {
  console.log(preview.report.sourcePatch, preview.report.diff);
  const comparisons = await preview.compare(0, 'html');
  console.log(comparisons);
} finally {
  await preview.dispose();
}
```

Preview has its own plan; it does not reserve the source. Plan and apply with current preconditions after the host accepts the preview, and handle a stale rejection if anything changed. An injected compiler used for preview must retain an executable `programBundle` or `programCode` for each revision.

## Supported commands

All commands include `schemaVersion: 0`, `source`, and `expected: { intentHash, sourceHashes }`. Obtain target and binding IDs from the current manifest instead of constructing them from a label.

| Command | Target and value | Supported authored source |
|---|---|---|
| `set-node-text` | `target: { nodeId, textBindingId }`, `value: { text }` | Literal second argument of `Text({ id: "..." }, "...")`; the new text may be empty. The property path is `text`. |
| `set-node-property` | `target: { nodeId, property, bindingId }`, `value: { value }` | One of the literal properties in the table below. The property path is `property.<name>`. |
| `set-audio-clip-placement` | `target: { clipId, bindingId }`, `value: { atSeconds }` | Inline `video({ audio: { clips: [{ id: "...", at: "0.2s", ... }] } })`, where `...` represents other explicit properties rather than a spread. The binding path is `audio.placement.at`; its ID has the form `audio::<clipId>#placement.at`. |
| `set-node-transform` | `target: { nodeId, xBindingId, yBindingId }`, `value: { x, y }` | Literal `x` and `y` on an identified `Frame` or `Html`. |
| `trim-scene-end` | `target: { sceneId, durationBindingId }`, `mode: "ripple"`, `end: { space: "global", frame }` | A literal duration on an inline `compose()` scene; the global end is an exclusive frame and must leave at least one frame. |
| `set-phase-boundary` | `target: { sceneId, leftPhaseName, rightPhaseName, leftBindingId, rightBindingId }`, `mode: "zero-sum"`, `value: { left, right }`, `unit: "percent"` or `"seconds"` | Two adjacent literal director phases with the same unit. Both values must be positive and their total must stay unchanged. |
| `set-composition-hold` | `target: { occurrencePath, holdBindingId }`, `value: { hold }` | A literal still hold in an inline Program passed to `time()`, at its exact qualified occurrence path. Duration strings use `ms`, `s` or `f`. |

`set-node-property` is a finite set, not an arbitrary property setter:

| Constructor | Property | Value |
|---|---|---|
| `Text` | `color` | Nonempty string |
| `Text` | `size`, `weight` | Positive finite number |
| `Frame` | `fill` | Nonempty string |
| `Frame` | `width`, `height` | Positive finite number |
| `Image`, `Video` | `src` | Nonempty literal string |
| `Image`, `Video` | `width`, `height` | Positive finite number |

For example, after finding an exact `property.color` binding, pass `target: { nodeId: binding.targetId, property: 'color', bindingId: binding.bindingId }` and `value: { value: '#ff0000' }`. For an asset, use the `property.src` binding with `property: 'src'`. Expressions such as `ctx.asset('logo.png')` are not literal source bindings.

Audio placement uses a nonnegative decimal number of seconds before the video end. Planning checks that the original literal identifies one resolved audio track and that the new placement appears in the compiled track without changing the clip's source, mix or duration, another track, or the program clock. Scene-relative placement, imported or computed clip definitions, non-second literal units, and clips whose dependent transcript track would also change are not supported by this command. For media cuts and kept ranges, use [server media preparation](server-media-preparation.md).

## Inspect-only and source boundaries

The default compiler examines the selected source file; it does not provide exact bindings into imported child modules. For the text, property and audio commands, expressions, spreads, computed keys, missing or duplicate IDs and unsupported literal shapes are not offered as exact edits. Some unsupported structures have no binding at all. Generic authored keyframe edits are not supported; sampled motion observations are not editable source.

Constructor discovery recognizes named value imports from `@foxworth/superimg`, including aliases. It conservatively declines a name if a local declaration shadows it; namespace imports and foreign or unverified constructors are not exact bindings. Review the source and proposed output before applying.

## Optional interactions and CLI

Direct library use does not require a Boundary mount. A host that uses `@foxworth/superimg-interactions` can expose `media.edit.bindings`, `media.edit.set-node-text`, `media.edit.set-node-property`, and `media.edit.set-audio-clip-placement` alongside the other edit interactions. The host retains admission, persistence and reconciliation responsibility.

The CLI exposes the same operations:

```bash
superimg edit bindings scene.media.ts --json
superimg edit set-node-text --command text-command.json --json
superimg edit set-node-property --command property-command.json --json
superimg edit set-audio-clip-placement --command placement-command.json --json
```

Each command file contains the complete command, including current preconditions. The CLI also accepts JSON inline or `-` for standard input. See [interaction contracts](interactions.md) for host integration.
