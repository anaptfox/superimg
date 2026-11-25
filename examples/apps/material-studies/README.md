# Material Studies

Five original scenes share an interactive gallery and deterministic film models. The gallery mounts one study at a time, renders a 1280×720 preview, and starts silent. Landscape portfolio films are authored separately at 3840×2160 / 30 fps.

The portfolio export contract includes sixteen movies, Cleft's square poster, and its flat 64-pixel SVG. Tide Ledger reuses Aster Basin's model for an overhead atlas film pair. Generate and inspect the outputs for the current source before treating that portfolio as accepted. Listening and physical-device acceptance require separate verification.

From this directory:

```bash
../../../node_modules/.bin/vite --host 127.0.0.1
../../../node_modules/.bin/vitest run
node ../../../scripts/typecheck-native.mjs --noEmit
../../../node_modules/.bin/vite build
node tools/browser-smoke.mjs
```

The local URL is `http://127.0.0.1:4193/`. The Vite app imports authored values directly; it does not import a SuperImg compiler. Inter CSS and export declarations use the same bundled font bytes. There are no remote providers, Google font requests, audio autoplay, or required credentials.

## Studies and controls

| Study | Live contract | Controls |
| --- | --- | --- |
| Sandglass Queue | Interactive definition; the host owns queue time | Workers, arrivals, compare, selected request, play/pause, scrub |
| Cleft | Eight-second pointer-driven Player | Pointer, slider, reveal/ink/mineral/graphite presets |
| The Returning Shore | Interactive definition; the host owns brush time | Captured pointer strokes, native X/Y sliders, keyboard brush, replay, restore |
| Borrowed Shapes | Thirty-second host-driven InteractivePlayer | Bidirectional scrub, form holds, frame steps, twelve followed IDs |
| Aster Basin | Interactive definition; the host owns world input | Era, future, route, landmark focus, unmake/restore, scripted choreography |

Native buttons and inputs provide keyboard equivalents. Cleft presets and the slider retain a `suspendDrive()` lease so pointer movement cannot replace a chosen state. Reduced-motion preference suspends drive, starts at a settled state, and leaves state changes explicit.

The Returning Shore's replay clock extends through four seconds after the final recorded brush sample. A stroke at the initial 120-second boundary can therefore complete its restoration at 124 seconds.

Full and Reduced are named, selectable render profiles. Every sampler keeps its logical population. Reduced thins decorative drawing only, preserving requests, landmarks, route grains, followed identities, and silhouette structure. Exact drawn counts come from model observations, not a blanket half-count assumption.

## Host lifecycle and acceptance

Lazy import tickets are checked before constructing a player. Study selection disposes the prior surface, listeners, clock, inspection attachment, and pending pump. A newer import never mounts after its selection is obsolete.

`LatestPump` submits complete immutable data states, with one render in flight and at most one latest pending input. Replaced pending inputs are recorded as coalesced. Host clocks run at a target 30 updates/second; held scenes have no rendering requests. Brush sampling uses normalized viewport coordinates after letterboxing, at most 30 samples/second and six reference pixels of travel. Ordered 64-point chunks preserve all retained timed impulses rather than retroactively decimating an active gesture.

The host records input version, request and acceptance timestamps, generation, revision, and frame after awaited acceptance. A sidecar is available only when its bound record matches the exact accepted generation/revision/frame. The sidecar records accepted model state; browser captures are needed to verify visible pixel coverage.

## Browser inspection

The app exposes `window.materialStudies` and `window.superimgInspection`. The inspection surface is `material-study`.

```js
await window.materialStudies.select('sandglass');
const frozen = await window.materialStudies.freeze({
  logicalSeconds: 12,
  frame: 0,
  data: { compare: true },
});
// Capture the current browser surface here.
const unchanged = await window.materialStudies.verify(frozen);
await window.materialStudies.release();
```

`freeze()` enters persistent inspection mode, suspends host input and custom time, drains already-started work, fixes logical time and the immutable data record, awaits data acceptance, seeks the requested frame, and awaits resources. A raw inspection seek does **not** change host logical time. Use the wrapper for reproducible custom-clock captures. `verify()` checks the same generation, accepted revision/frame, input version/identity, and ready resources after capture.

For Cleft and Borrowed Shapes, `logicalSeconds` selects authored inclusive timeline time; encoded frame time is still `frame / fps`. Borrowed Shapes uses an example-local interactive adapter so each complete host input needs one presentation request. Custom-clock definitions keep their guide time separate from logical model time.

```js
window.materialStudies.available();
window.materialStudies.state();
await window.materialStudies.update({ fidelity: 'reduced' });
```

## Performance measurement

Run a complete ten-profile matrix against the current source to qualify preview defaults. Local reports belong to the browser, hardware, and source fingerprints recorded by that run; this example does not establish a portable performance guarantee.

For reproduction, run Full and Reduced separately. A complete profile benchmark includes three 60-second repetitions for each of hold, auto, and interaction, after ten seconds of warm-up per run. It takes about 10½ minutes; the ten-profile matrix takes about 105 minutes. The UI can stop a run; selection disposes and aborts it.

```js
const result = await window.materialStudies.benchmark({
  onProgress: message => console.info(message),
});
```

Short diagnostic runs can use `repetitions`, `warmupMs`, and `durationMs`. They are labeled `measured:false` and never select a default profile. Full and Reduced results contain accepted input versions, raw latency samples, interval distributions, missed frame deadlines, coalesced inputs, failures, runtime diagnostic snapshots, user agent, viewport, DPR, canvas and logical/drawn populations. Runtime stages are reported individually rather than summed where they overlap.

The live budget targets 30 updates/second and records a 29 accepted updates/second acceptance floor, p95 input-to-accepted latency ≤100 ms, zero render failures, and no hold rendering. Defaults come from a published, complete Full/Reduced qualification matrix whose source fingerprint still matches the study, shared helpers, host, and built browser runtime. Full is chosen when it qualifies; otherwise Reduced is chosen only if it qualifies. Missing, incomplete, stale, or failing results leave an explicitly provisional Full preview. A manual selection is retained separately and never changes silently during playback. Measurement targets are not achieved results until a full run is recorded.

Download session JSON for the latest input, capture record, accepted timestamps and benchmark results. Browser measurements describe that browser and machine; device emulation does not certify a physical device. Film and audio acceptance remain in the portfolio export workflow.

The changing benchmark cases repeat an eight-second coverage cycle: 49 logical simulation seconds for Sandglass, eight live seconds for Shore and Cleft, 30 authored seconds for Forms, and 50 for Atlas. They measure synthetic update throughput and host latency, rather than playback at each film's authored speed. Input latency begins when the browser host captures an input; it does not include earlier physical-device delivery.

An isolated headless harness records machine configuration and source file hashes without touching the visible gallery tab:

```bash
node tools/benchmark-browser.mjs --study cleft --profile full,reduced --isolated
```

Run it after exports finish so they do not contend for CPU. `--isolated` records the operator's assertion that exports and other rendering loads finished; it is required for a profile to qualify as a default. Ordinary UI runs retain actual measurements but do not qualify a default from an unverified environment. This is browser evidence, not physical device acceptance. The default output is this app's `output/benchmarks/`; `--output` selects an explicit artifact directory. The harness records all study and shared material sources plus app code/styles before and after each profile; source changes prevent default qualification. Run the complete matrix with comma-separated study IDs and both profiles; profiles execute sequentially.

## Rendered roughs

`node tools/refresh-roughs.mjs` copies completed review clips and generates 1280×720 poster previews from `output/material-studies/roughs/`. Its public manifest retains each artifact's SHA-256, captured source identity, original screenshot pixel dimensions, authored clock and fonts. Review clips are silent, bounded motion excerpts. Poster previews and review clips do not qualify 4K film fidelity.

`window.materialStudies.refreshRoughs()` refreshes the manifest without changing the selected study. The gallery shows actual rendered poster tiles and keeps earlier stills and motion revisions in their pickers. A separate film picker opens completed clean, teaching, and Cleft special editions in the native video dialog, pausing the live model first. Movies start muted; their sound control enables the original score. The refresh button discovers newly published artifacts without changing the scene or its fidelity. Development availability checks discover a new study module as soon as it exists; production uses the modules included by Vite at build time.

## Publish measured defaults

After the full ten-profile matrix finishes against unchanged source, run `node tools/publish-qualification.mjs --reports ../../../output/material-studies/benchmarks`. The publisher rechecks all nine scenarios per profile, the full durations, held-scene idling, failures, actual accepted rates, latency, isolation, and current source fingerprints. Qualification is consulted on fresh study selection. It never changes an already-playing study.
