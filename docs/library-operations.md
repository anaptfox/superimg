# SuperImg library operations

Author media with `@foxworth/superimg`, then consume the authored value through `@foxworth/superimg/runtime`. The runtime checks, inspects, renders and exports values. Applications can use its byte streams or return `renderResponse()` directly from a request handler.

```ts
import card from './card.media';
import { renderResponse } from '@foxworth/superimg/runtime';

export async function GET() {
  return renderResponse(card, { as: 'png' });
}
```

For an authored value's canvas, clock, variants, and editions, call
`describeMedia(value)` from `@foxworth/superimg/runtime/describe`. It leaves
collection providers and retained Programs unevaluated. Pass
`{ probePhases: true }` to sample the director from an animated definition's
render callback using its authored sample. Neither mode starts an export runtime.

## Node project operations

The `@foxworth/superimg-node` package adds trusted project and filesystem workflows. It is optional for applications that already import authored media values. Source compilation runs trusted code and is not an untrusted-template sandbox.

| Import | Operation |
|---|---|
| `@foxworth/superimg-node/project` | Discover and resolve project media sources |
| `@foxworth/superimg-node/source` | Compile, check, inspect and load media sources |
| `@foxworth/superimg-node/source/advanced` | Prepared analysis and IR evaluation primitives |
| `@foxworth/superimg-node/review` | Capture source, value and encoded-delivery review evidence |
| `@foxworth/superimg-node/review/advanced` | Low-level packet and publication primitives |
| `@foxworth/superimg-node/plate` | Prepare a short clip's atlas and manifest |
| `@foxworth/superimg-node/narration` | Prepare speech and narration with explicit providers |
| `@foxworth/superimg-node/transcription` | Validate inspected audio and call one host-supplied transcriber |
| `@foxworth/superimg-node/media-preparation` | Extract frames and waveforms, observe silence, and export accepted cuts |
| `@foxworth/superimg-node/thumbnail` | Resize and encode thumbnail rasters |
| `@foxworth/superimg-node/cortex` | Plan and export Cortex views |
| `@foxworth/superimg-node/project-tools` | Project configuration and discovery helpers |
| `@foxworth/superimg-node/arrangement` | Prepare and export arrangement requests |
| `@foxworth/superimg-node/edit` | Plan and apply exact source edits |
| `@foxworth/superimg-node/baseline` | Read and write IR baselines under an explicit root |

Source discovery and `compileNodeMediaSource` compile trusted source without running a collection provider. `loadNodeMediaValue` can execute a collection provider once when no snapshot is supplied. Provider execution runs trusted host code in a child process with an allowlisted environment; it is not a sandbox for untrusted sources. When you already have a snapshot, pass it to `loadNodeMediaValue` and reuse it for later work; the loader validates its identity and does not rerun the provider. Inspect the source descriptor before loading if your host has not authorized provider execution. Compilation and loading do not publish artifacts.

```ts
import { init } from '@foxworth/superimg/runtime';
import { compileNodeMediaSource, checkCompiledSource } from '@foxworth/superimg-node/source';

const runtime = await init();
try {
  const compiled = await compileNodeMediaSource(projectRoot, 'card.media.ts');
  const { report } = await checkCompiledSource({ projectRoot, compiled, runtime });
  console.log(report.findings);
} finally {
  await runtime.dispose();
}
```

Use `prepareSource(projectRoot, source, { kind: "singular", overrides })` from
`@foxworth/superimg-node/source` to get canonical IR and source hashes for a
trusted singular definition. Overrides contain replacement text for existing,
project-relative JS/TS inputs and stay in memory. Compare the returned hashes
with any separately built preview before accepting them as the same revision.

`checkCompiledSource` and `inspectCompiledSource` do not invoke collection providers. Pass a previously frozen snapshot to select its entries. `checkNodeSource` and `inspectPreparedSource` operate on a source already loaded by the host and likewise do not invoke providers.

`projectRoot` is an explicit absolute directory. Source code and its imported helpers may change between compilation and loading, so use the loaded result's identity for subsequent operations. Value review defers provider collections; use a frozen collection with an explicit entry when needed. Source review uses `loadNodeMediaValue` and therefore has its provider effects; pass `load.snapshot` to reuse a frozen snapshot. Source companions are trusted code and compiled with their imported helpers.

```ts
import { init } from '@foxworth/superimg/runtime';
import { captureSourceReview } from '@foxworth/superimg-node/review';

const runtime = await init();
try {
  const evidence = await captureSourceReview(projectRoot, 'card.media.ts', { runtime });
  try {
    console.log(evidence.packet.technical, evidence.packet.visual);
    // Read packet evidence paths here, before disposal.
  } finally {
    await evidence.dispose();
  }
} finally {
  await runtime.dispose();
}
```

`captureValueReview` takes an authored value and the same options; it uses the canonical runtime program digest as a value identity, rather than claiming a source bundle. The caller supplies and owns the runtime. Returned evidence owns a temporary directory, remains available until `dispose()`, and is deleted on failure before return. `captureDeliveryReview` accepts the already loaded source, one encoded publication receipt, explicit destination and publication path; it decodes the delivered bytes, records their hash and writes project review capture and index files. Publication starts only after evidence is captured; if index publication has an uncertain outcome the capture is retained for reconciliation. This operation does not publish the original media. Human visual acceptance remains `unreviewed`.

Use `@foxworth/superimg-node/review/advanced` for low-level packet assembly and explicit review index publication. The source, narration, project, and project-tools entries retain their older helper exports. Put `observe` closures in a source review companion so SuperImg can establish their identity.

`exportNodeArrangement` prepares and exports a portable arrangement request using an explicit runtime; the returned bundle owns its artifacts and must be disposed by the caller. Publication and its destination remain host choices. The Node edit entry provides the existing edit engine and source compilation: the caller supplies project context and checks source and intent hashes before applying. Preserve an uncertain edit outcome for reconciliation rather than retrying it blindly.

Plate preparation returns atlas bytes and a manifest. The caller chooses where to publish those bytes. Review evidence distinguishes source captures from decoded export pixels, technical findings from authored observations, and evidence capture from human visual acceptance. A captured review remains visually unreviewed until a reviewer accepts it.

## Tool hosts

See [transcripts and captions](transcripts.md) for portable correction and caption
data, and [server media preparation](server-media-preparation.md) for selected-track
analysis and cut export. These calls do not require a tool host.
For trusted source changes, use the [exact source editing guide](exact-source-edits.md).

`@foxworth/superimg-interactions` supplies interaction contracts and Node mounts for hosts that admit and dispatch tools. The mount delegates media operations to the shared library. Direct trusted library callers do not need to create a tool session. Hosts own credentials, admission, durable recovery, and publication destinations.

## Comparison

`@foxworth/superimg/ir` exposes IR diffing, expected-change classification, semantic frame comparison, and comparison failure policy. CLI exit codes are presentation of those results. Consumers can apply the same rules without starting a subprocess.

Runtime capabilities vary by platform. Node encoders, Chromium, and plate preparation tools must be available where used. The default edge runtime supports documents; opt-in edge rasterization requires explicitly supplied WASM. Check the selected runtime's capabilities before requesting a format.
