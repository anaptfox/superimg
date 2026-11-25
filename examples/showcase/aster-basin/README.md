# Aster Basin

An original, fictional tidal city with three eras, two imagined futures, and
one continuous route. A 50-second film and a silent interactive example use
one deterministic model. No captured city geometry or Foundation asset is used.

`aster-basin.media.ts` exports the 4K hero by default and `live` as a
`defineInteractive` value. `INITIAL_ATLAS` supplies the live host data.
The host owns logical time, input revisions, controls, pause, and disposal.
Guide navigation does not advance or change the world.

## Model and controls

`sampleAtlas(data)` consumes live controls when `live:true`. Set `focus:'route'`
and update `routeProgress` for the nine-second journey. Other focus values are
`overview`, `causeway`, `cistern`, and `archive`. Changing `era` or `future`
should pause travel and return to overview; era changes clear the future to
`present`. `unmake` ranges from zero to one. Restore and reset are explicit.

Set `live:false` and `logicalSeconds` to sample the film choreography through
the same InteractivePlayer. The standalone film supplies its authored clock
directly. Reduced motion uses explicit settled controls and pauses travel.

The rounded route, camera orientation, ground route grains, map position, and
navigation instructions share `routeSampler`. Corners round by 24 units inside
a 48-unit corridor. Coordinates are illustrative meters in this fictional
city. The camera eye begins 32 units high and rises to 128 near bends while
a wider lens keeps neighboring masses in view. A broad, smooth distance
envelope prevents four abrupt height changes. A 22-unit route sample supplies
an unwrapped gaze direction, averaged over a deterministic 3.2-second window.
Its reach extends to approximately 66 units on straight streets and 35 near
corners. Measured maximum yaw at encoded 30 fps is 56.29 degrees/second,
compared with 205.51 before smoothing. The eye and route clock are unchanged.
A smooth distance-based gaze change retains the ground
curve during turns and the facades between them. The vertical rise clears roofs before lateral
travel. Geometry tests measure clearance, not collision physics.

The world contains 12 low-rise masses and three protected landmarks. Every
pose retains 20,000 architectural, 2,000 bed, and 2,000 route grain ids. Reduced
draws 17,000, preserving all 8,000 landmark and 2,000 route grains while halving
only ordinary architecture and bed grains. Report logical and drawn counts
separately. CPU clipping, coarse occlusion, and stable depth/color batches cap
the material at 400 paths plus shore and footprint outlines. Matte underpainting
is restricted to roofs at 0.22 opacity. Vertical façade matte area is exactly
zero; grains carry the walls. The geometric coverage test also rejects a
fixture that underpaints every façade.

`atlasHeroPose` owns the film timeline. The camera is exactly identical at
35 and 41 seconds. At 37 seconds both future weights are zero; one complete
encoded frame holds that baseline before Open Shore follows. Speculative
outlines dissolve during 42–42.6 seconds, then the present
erodes through 47 seconds. Cyan route and landmark footprint grains persist.
The authored coastal contour separates warm land from cool water. Its 2,000
bed grains comprise 800 pale tide grains, 1,000 land grains, and 200 water
grains; no extra population is introduced. The south causeway crosses this
contour. Raised Shore expands the tide ridge by 30 world units and Open Shore
retreats by 24, both from the same present edge. Present footprints remain
under both alternatives, and the slate Raised coast persists through the
comparison. Four present-era masses have one upper setback tier.
`tide-ledger.media.ts` uses `atlasOverhead(snapshot)` for an 18-second salt-paper
atlas, retaining the same population, route, and landmarks. Its original
Atlas WAV is remapped offline to the shorter model schedule; the modal buoy
tail starts at arrival. Both cuts share one frozen 48 kHz stereo PCM WAV.

## Capture and acceptance

Freeze host data and its logical clock, await the accepted data update, seek,
then await resources before capture. Bind `inputVersion`, fidelity, counts,
source identity, and logical time to the accepted presentation; verify that
revision after capture. Live font CSS and film font declarations use identical
portable Inter bytes from the shared material resources.

```sh
env npm_config_manage_package_manager_versions=false pnpm exec vitest run examples/showcase/aster-basin/model.test.ts
just cli check examples/showcase/aster-basin/aster-basin.media.ts --craft --json
just cli inspect examples/showcase/aster-basin/aster-basin.media.ts --review --review-clips --json
just cli inspect examples/showcase/aster-basin/aster-basin.media.ts --at 23.894s --png
just cli export examples/showcase/aster-basin/aster-basin.media.ts --for 3840x2160.mp4
```

The review companion includes all four turns, arrival, rise, both futures,
their baseline, erosion, and final traces. Its 21 beats use eight seconds of
review clips. Probes report geometry and projected point counts; they do not
claim captured pixel coverage, material quality, or a soundtrack verdict.

Measure Full and Reduced separately on named hardware/browser/viewport/DPR.
No live frame rate or 4K visual acceptance is claimed by passing model tests.
Original audio cue intentions are in `ATLAS_SOUND_CUES`; baked score and final
mux require their own hashes, stream inspection, timing checks, and listening.
