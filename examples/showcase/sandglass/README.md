# Sandglass Queue

A smoked-glass instrument makes queue capacity visible. One rigid twelve-grain
cluster is one request. Two systems receive identical arrivals; their workers
serve requests in FIFO order for two seconds each.

The 40-second film is authored at 3840×2160 and 30 fps. The `teaching` data
variant adds captions without changing model time, camera, or soundtrack.
Both cuts retain clocks, simulation speeds, worker counts, and request legends.
The live definition is silent and initially paused with two workers and
comparison disabled. The gallery owns its clock and controls.

## Model and controls

`scheduleRequests(workers, arrivalRate)` computes the complete 48-request FIFO
schedule. `sampleSandglass(data, clock)` produces immutable request poses and
exclusive supply/waiting/processing/completed states. `renderSandglass` paints
that snapshot; `observeSandglass` exposes the same facts to review and live
presentation semantics. No frame history, random draw, or collision simulation
is involved.

Worker counts are 1–6; arrival rates are 0.5–6 requests/second in increments of
0.5. Parameter changes restart host time at zero. The host can play, pause,
scrub, replay, compare another worker count, and select request 1–48. Preserve
the selected request when settings change. At the final completion, pause.

Supply is outside the vessel. Waiting requests fill the upper chamber, each
worker owns one discrete channel, and completions occupy fixed lower-pile
positions ordered by completion. Pearl-to-chartreuse color shows elapsed wait,
then freezes at service start. It never predicts a future wait. The pile is an
authored spatial arrangement, not a histogram or simulated granular material.

Full and Reduced both draw all 1,152 logical grains in comparison mode. Every
request is protected; this example has no disposable decorative population.
The live host must load `MATERIAL_FONT_CSS`, matching the film's portable Inter
bytes. Host `logicalSeconds` is authoritative; guide time is independent.

## Film clock and score

Film 0–3 holds model time 0; 3–15 advances 0→12 at 1×; 15–19 holds 12;
19–25 advances 12→24 at 2×; 25–27 holds 24; 27–35 advances 24→49 at
3.125×; 35–40 holds the completed pair. The four-worker vessel finishes at
film time 27.64 seconds.

`canonicalAudioEvents()` exports 288 unique arrival/start/completion events.
Each has a stable `system/request/event` identity, simulation time, and the
first film time reaching it. Synthesis should use event sample offsets
`round(filmSeconds * 48000)`; held frames do not emit repeated cues. The score
asset is integrated by the portfolio's offline synthesis step.

## Validation and capture

`model.test.ts` checks all settings, inclusive boundaries, exact canonical
counts, conserved states, exclusive channels, frozen wait color, shuffled
seeking, reduced fidelity, and rejected faulty fixtures. Canonical facts:
two workers finish at 49 seconds with mean wait 11.5 seconds; four workers
finish at 26 seconds with zero wait. Request 17 arrives at 8.5, starts at
16.5, and ends at 18.5 in the slower system.

The co-located review plan captures supply, service, waiting, both comparison
holds, the fast completion, drain, pile detail, and final rest. Its eight
seconds of clips supplement 4K still evidence. Probe facts establish model
acceptance; captured frames establish visible readability.

Before a live capture, suspend the host clock, freeze input/time, await data
acceptance and inspection readiness, then verify that the accepted revision and
`inputVersion` remain unchanged. Do not infer model time from guide frame zero.

No benchmark or visual acceptance is claimed by this source file. The
portfolio's acceptance manifest records actual check, capture, export, audio,
and hardware-specific measurement results.
