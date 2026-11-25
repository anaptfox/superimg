# Measurements and retained evidence

The quick, catalog, regular browser, build-cache, render-fidelity and upgrade-review
scripts share an evidence runner. They create a **new** directory under
`.results/<kind>/` by default; `--output NEW_DIRECTORY` selects an explicit location.
An existing directory is rejected. `result.json` records source, built-artifact,
lockfile, harness and machine identities before work begins. Failures preserve the
receipt, collected raw observations and available diagnostics. A source/build change
during timing rejects the result. The build-cache experiment allows its own build
outputs to change and records both inventories.
Final fingerprints and process elapsed time remain in failed receipts. Quick and
regular browser receipts report correctness separately from timing, process-memory
and structural ceilings; a budget rejection keeps the successful observations.

```sh
node tooling/benchmarks/scripts/measure-quick.mjs --output /tmp/superimg-quick-first
node tooling/benchmarks/scripts/measure-quick.mjs --output /tmp/superimg-quick-next \
  --baseline /tmp/superimg-quick-first
node --test tooling/benchmarks/scripts/run-support.test.mjs \
  tooling/benchmarks/scripts/hmr-acceptance.test.mjs
```

`--baseline` validates completed baseline status, workload, harness, dependency
lockfile and environment before comparison. Source/build fingerprints may differ
for the intended patch. Regular browser comparison also requires the same actual
browser version. The runner retains both identities; it does not turn one run into
a statistically supported improvement claim. Freeze source, pause other builds,
use matching conditions and alternate at least three fresh processes per variant.
Compare process medians and their range rather than pooling inner-frame batches.

Timing summaries retain raw samples, median, minimum and maximum. **p95 is omitted
below 100 samples.** The existing `*P95Ms` budget names remain compatible, but quick
runs explicitly evaluate their maximum against those legacy ceilings. This is a
quick regression ceiling, not an estimated p95. Structural catalog size percentiles
describe the complete artifact population and remain separate from machine latency.
The build-cache run is one forced-build/cache-reuse pair; its first run does not
claim empty OS/compiler caches. The historical upgrade-review script retains its
explicit old compiler/log paths and reports individual execution failures.

Regular browser HMR now ends at the real preview's accepted source and visible
marker inside its committed iframe. It verifies matching compiler input/output
identities, authored frame zero and resource readiness through `@foxworth/superimg/inspection`.
A syntax-error phase must retain the previous accepted artwork while marking
compilation failed, then recover to new accepted output. Fetching generated code
alone cannot finish its timing, and the benchmark never writes its marker into
the preview DOM. That latency ends at accepted DOM, without claiming GPU paint.
Each accepted edit also saves one guarded viewport PNG and a media crop derived
from the same bytes under `hmr/`, with paired source/frame facts and hashes.
Screenshot duration and edit-to-captured duration are separate raw observations;
their encoding/transport cost is not silently added to edit-to-accepted latency.
The failed-edit capture is labeled stale diagnostic evidence, and recovery must
produce both a new accepted revision and changed media bytes. Capturing never
scrolls or writes a presentation marker.

# Browser measurements

`node tooling/benchmarks/scripts/measure-browser.mjs --check` runs the existing player/capture budget suite.

`--runtime --review-focused` selects the ten typed/interactive/shared pipeline
cases without the semantic/history microbenchmarks. Prepare once as below, then
run three fresh processes; use `--diagnostic` separately for stage/CPU attribution.
`scripts/review-loading-dx.mjs` supports `--graph`, `--prepare`, `--bundle` and
the explicitly opt-in `--dx --media PATH`; each requires `--output NEW_DIRECTORY`.

The same entry point has a focused runtime mode. Freeze the source tree first,
including uncommitted source used by the workload. Prepare each variant with the
same fixture and installed locked dependencies:

```sh
node tooling/benchmarks/scripts/measure-browser.mjs --runtime \
  --source /absolute/frozen/source --prepare-only --output /tmp/runtime-baseline-bundle
node tooling/benchmarks/scripts/measure-browser.mjs --runtime \
  --source /absolute/candidate/source --prepare-only --output /tmp/runtime-candidate-bundle
```

Both output directories must be new. Each contains the browser bundle, source
map, and an identity manifest with source/dependency/harness hashes. Package
imports resolve to the selected source tree; external dependencies come from the
installed checkout and are fingerprinted. Compare normalized input manifests to
confirm the intended patch is the only source difference.

Pause other builds and measurements, then run one variant per fresh process:

```sh
node tooling/benchmarks/scripts/measure-browser.mjs --runtime \
  --bundle /tmp/runtime-baseline-bundle --output /tmp/runtime-baseline-run-1
node tooling/benchmarks/scripts/measure-browser.mjs --runtime \
  --bundle /tmp/runtime-candidate-bundle --output /tmp/runtime-candidate-run-1
```

Run at least three processes per variant, alternating which variant goes first.
Use `--reverse` on matched pairs to reverse pipeline workload ordering. Report
the median and range of process medians; do not pool batches into independent
process trials. Run directories are exclusive and must never replace a prior
result. `completed: true`, empty browser errors, identical result hashes, and
matching fixture/harness identities are prerequisites for a comparison.

The runtime fixture measures shallow/deep semantic snapshots, retained host
operation history, and complete accepted presentations for raw, typed,
interactive, and shared spatial media. Mount, first repeat, command setup, and
steady samples are separate. Every process uses normal and 4× CPU settings, a
440×763 viewport at DPR 3, and a new browser. It verifies requested accepted
frames, visible labels, shared instance counts, and iframe disposal. Timed
presentation acceptance is not a measurement of GPU paint or field INP.

`--diagnostic` records a separate 4× run with runtime instrumentation and a CPU
profile. Do not include diagnostic timings in the ordinary comparison. Source
bundles are unminified and source-linked; qualify packed public entries
separately before making claims about a shipped consumer. Runtime mode currently
records evidence without setting hardware-independent pass/fail timing budgets.

Resource diagnostics use the same entry point with `--resources`. Prepare both
sources with `--prepare-only --source SOURCE --output NEW_DIRECTORY`, then run
with `--bundle PREPARED_DIRECTORY --output NEW_RUN_DIRECTORY`. This mode freezes
the three font files alongside the source bundle and verifies their hashes and
the runner hash. It requires local `ffprobe` for decoded frame/timestamp checks.

It records 60/600 exact HTML frames at 1×/4× CPU, then 60/600-frame real WebM
exports at normal CPU. HTML frame evaluation includes document encoding; full
export includes raster capture and video encoding. Parsing caches are warm after
the first workload within a process. Repeat three fresh processes per variant,
compare every text width and decoded observation, and keep process summaries
separate. `--fonts-only`, `--memory-only`, `--export-only`, and `--skip-export` restrict experiments. Export observations wait for seek completion and a matching presented video frame; external cancellation is exercised after three captured frames.

The memory workloads retain jobs, bundles, and artifact handles after disposal.
Live artifacts and retained caller-owned reads are positive controls. Chromium
backing-storage measurements use forced GC between phases. `--heap-snapshots`
captures separate diagnostic retaining-path evidence; do not mix that overhead
with ordinary timings or turn GC collection deadlines into unit assertions.
