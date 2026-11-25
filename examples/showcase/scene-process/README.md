# Connected process scene

A short stamping-machine demonstration proves that the spatial scene API works
outside a game. The rail, press, stamp and workpiece are reusable typed vector
definitions. The stamp attaches to the press's sampled `chuck` anchor. One
workpiece retains its identity while its accepted appearance changes.

`scene.ts` supplies the same scene to four wrappers:

- `scene-process.media.ts`: five-second, 640×360, 12 fps video.
- `scene-process-poster.media.ts`: static image.
- `scene-process-vector.media.ts`: static SVG.
- `scene-process-live.media.ts`: interactive media driven by host data.

The host owns `ProcessData`: explicit progress and an accepted `stamped` result.
`sampleProcess()` is a pure presentation sampler; it does not simulate a press
or mark a real part finished. The film wrapper supplies authored demonstration
inputs from its clock. Static and interactive wrappers use their data directly.

```sh
just cli check examples/showcase/scene-process/scene-process.media.ts
just cli inspect examples/showcase/scene-process/scene-process.media.ts --at 2.4s --png
just cli export examples/showcase/scene-process/scene-process.media.ts --for 640x360.mp4
just cli export examples/showcase/scene-process/scene-process-poster.media.ts --for 640x360.png
just cli export examples/showcase/scene-process/scene-process-vector.media.ts --for 640x360.svg
```

Review the initial hold, tool contact at 2.4 seconds, and finished-part hold at
4.5 seconds. The tool must stay centered on the moving chuck; the workpiece must
appear once, retain `batch-01.part-01`, and never change position merely because
its accepted appearance changes. Interactive selection emits intent only.

## Recorded acceptance

On 2026-10-08, all nine focused tests and the example TypeScript check passed.
CLI `check` passed for all four wrappers. MP4, PNG and native SVG exports
completed using the assembled render stack with Node 26.5.1. The MP4 contains
60 H.264 frames at 12 fps, 640×360, with a five-second duration.

The contact inspection PNG, decoded MP4 start and finished frames, and exported
poster were visually reviewed. They show one part, a centered attached tool,
connected piston and legible stationary labels. SVG output contains native
vector shapes and text without a `foreignObject`.

Generated artifacts use the default project output locations:

- `output/examples/showcase/scene-process/scene-process.export/media/640x360.mp4`
- `output/examples/showcase/scene-process/scene-process-poster.export/media/640x360.png`
- `output/examples/showcase/scene-process/scene-process-vector.export/media/640x360.svg`

This establishes authored sampling, export and selected-beat appearance.
DOM-emulator integration also verifies that selecting the workpiece emits an
action carrying the accepted presentation identity without changing host data.
Only a new host publication changes its accepted appearance. A rejected NaN
candidate retains prior accepted pixels, scene snapshot and action revision.
Real-browser delivery and physical-device acceptance remain separate checks.

Additional retained-projection regressions in `retained.test.ts` exercise the
same live definition twice, then select each occurrence and publish different
host data to each. All 12 example tests pass, including action routing, data
isolation, occurrence-qualified portable scene identities, and semantic
annotations on typed visual parts. The portable schedule contains clock and
placement fields; live child handlers stay in the host runtime.

The independent source review found further cases outside these fixtures:
single-leaf live composition without inspection, semantic preservation through
boxing, nested scene coordinates, fitted-to-explicit camera reconstruction,
overlapping hit ordering, and mutable host metadata ownership. Selection of
painted artwork currently reports the clicked part identity; the tests do not
establish a uniform instance-level action identity. The current example is a
bounded implementation baseline while those corrections and Lemon's actual
renderer/art-parity qualification remain follow-up work.

## Local resolver measurement

`benchmark.ts` builds 100 and 500 independent workpiece instances sharing one
visual definition. After three warmups it resolves nine samples in repeated,
out-of-order input/contact/output order and checks every packet digest against
the corresponding warmup result. Timing covers `resolveSceneTree()` and
`collectSceneSnapshots()`; authored construction and digest calculation are
excluded. This workload has one typed vector part per instance and no socket
attachments, camera fitting, browser paint, or encoding.

Measured 2026-10-08 at 05:06:56 UTC: Node 26.5.1, macOS arm64, Apple M3 Max,
16 logical CPUs, assembled development package build.

| Instances | Samples | Median | Observed range | Packet repeatability |
| --- | --- | --- | --- | --- |
| 100 | 9 | 1.93 ms | 1.66–2.37 ms | All repeated samples identical |
| 500 | 9 | 22.28 ms | 19.21–23.80 ms | All repeated samples identical |

These are one-machine resolver observations, not a browser frame budget or a
general performance guarantee. Raw values are generated in
`examples/showcase/scene-process/output/resolver-benchmark.json`.

```sh
node --import tsx examples/showcase/scene-process/benchmark.ts
pnpm exec vitest run --config examples/showcase/scene-process/vitest.config.ts
```
