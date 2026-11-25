# Material study verification

The gallery uses 1280×720 live media and keeps Full and Reduced selectable.
Benchmarks qualify a default only for the measured source and browser. Drawing
pool counts preserve protected grains; they are not counts of projected pixels.

Use Node 26. After all rendering jobs finish and the source is frozen, run the full matrix:

```sh
node tools/benchmark-browser.mjs --study sandglass,cleft,returning-shore,borrowed-shapes,aster-basin --profile full,reduced --isolated --output ../../../output/material-studies/benchmarks
node tools/publish-qualification.mjs --reports ../../../output/material-studies/benchmarks
```

Each study/profile takes three 60-second runs for hold, autoplay, and interaction,
with ten seconds of warm-up before each run. Progress is printed at each phase.
`--isolated` is an operator assertion that exports and other rendering loads have
finished. It cannot prove that other applications are idle. The harness is
headless Chromium; these records do not establish physical-device acceptance.

The publisher requires all ten reports, rechecks the protocol and nine runs,
and compares hashes of artwork, host, benchmark harness, and built browser
runtime. It publishes `/portfolio/qualification.json` without changing source
fingerprints. A fresh study load compares the report with current source hashes.
Full wins when qualified; otherwise Reduced wins when qualified. If neither
qualifies, the gallery labels its preview provisional. User profile choices
remain explicit and playback never changes fidelity by itself.

The production verifier preserves each original SuperImg bundle. It copies its
H264 video packets into a delivery MP4 and muxes the frozen PCM WAV at the exact
authored duration. This workaround records raw and final hashes and probes; it
does not change SuperImg's encoder. Check and authored review must pass and the
review's media value digest must equal the raw receipt's program digest.

```sh
python3 examples/apps/material-studies/tools/verify-production.py --study sandglass --receipt output/material-studies/acceptance/sandglass-export.raw.json --review /private/tmp/material-sandglass-current-review.json --check output/material-studies/acceptance/sandglass-current-check.json --export-measurements output/material-studies/acceptance/sandglass-export-measurements.json
python3 examples/apps/material-studies/tools/verify-production.py --study returning-shore --receipt output/material-studies/acceptance/returning-shore-export.raw.json --review output/material-studies/acceptance/returning-shore-mask-fixed-review.json --check output/material-studies/acceptance/returning-shore-current-check.json --export-measurements output/material-studies/acceptance/returning-shore-export-measurements.json --shore-mask-compatibility output/material-studies/acceptance/returning-shore/mask-compatibility.json
python3 examples/apps/material-studies/tools/test-production.py
```

Run production commands from the repository root. Benchmark commands above run
from `examples/apps/material-studies/`. The verifier uses FFmpeg/FFprobe from PATH and writes
masters under `output/material-studies/films/`, manifests under
`output/material-studies/acceptance/`, and decoded native 4K PNGs alongside them.
Audio tests check sample extent, waveform alignment, and identical sound across
clean and teaching cuts. Listening and visual review remain separate acceptance
steps. Uninstrumented export timing and peak memory are recorded as null.

The optional original-export monitor records wall time and samples the process
family resident-set sum once per second. Shared pages may be counted repeatedly,
and this sampled maximum is not an exact or unique-memory peak. Manifests retain
those definitions and null fields for any unmeasured quantity. Raw exports,
first cuts, and current delivery masters have separate hashes and paths.

Returning Shore's current source omits an inactive empty alpha mask and its
fully masked underpainting group. Its delivery movie uses the source-frozen
export before that correction. The narrowly scoped compatibility record compares
all 1,440 typed cut/frame trees and eight native 4K before/after PNG pairs. The
verifier rejects missing frames, changed active poses, different pixels, changed
identities, or another source change; this is not a general source-change waiver.
