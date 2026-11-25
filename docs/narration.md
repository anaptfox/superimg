# Prepared narration

Speech runs on the host and produces frozen audio files. Templates consume those files and their measured timing plan. Export does not call a speech provider.

Provider adapters have tests. Native speech acceptance requires the corresponding host runtime and credentials.

## Prepare a local draft

Save `narration.json`:

```json
{
  "schemaVersion": 1,
  "provider": "macos-say",
  "voice": "Samantha",
  "settings": { "rateWpm": 183 },
  "mode": "natural",
  "fps": 30,
  "segments": [
    {
      "id": "predict",
      "text": "What happens when everyone chooses the shortcut?",
      "displayText": "Predict the result",
      "beforeSeconds": 0.3,
      "afterSeconds": 1
    },
    {
      "id": "reveal",
      "text": "The whole network becomes slower.",
      "afterSeconds": 0.5
    }
  ]
}
```

Once the render stack builds, the CLI entry points are:

```sh
superimg speech voices --provider macos-say --json
superimg narrate narration.json --preview --json
superimg narrate narration.json --json
```

The result lives at `output/narration.narration/narration.json`, alongside content-addressed WAV files. `--preview` validates intent without discovery, credentials, synthesis, or output writes. It reports a request upper bound, not a measured duration or an account billing quote. `--refresh` explicitly generates new speech.

System Voice output is marked `local-draft`; Apple's standard license restricts public sharing. Replacing the API with another Apple speech API does not establish different content rights. See the [original proposal](interactions.md) and its license source.

## Consume the prepared plan

For a media file at the project root:

```ts
import { video, Text, preparedNarrationAudio, type NarrationPlan } from "@foxworth/superimg";
import prepared from "./output/narration.narration/narration.json";

const plan = prepared.plan as NarrationPlan;

export default video({
  duration: `${plan.durationSeconds}s`,
  fps: plan.fps,
  audio: preparedNarrationAudio(plan, "output/narration.narration"),
  render(ctx) {
    const director = ctx.director(plan.phases);
    return Text(
      { variant: "display" },
      director.active("predict") ? "Predict the result" : "The network slows down",
    );
  },
});
```

The helper's directory is relative to the authored media file. It refuses a plan with unresolved overflow. The host normalizes local audio into runtime-owned bytes. Copy the prepared directory with the media project; the cache, original engine, and credentials are not required for export.

The manifest stores its recipe and recipe hash. Review checks their consistency. External edits to the original recipe are not automatically detected by ordinary export: rerun preparation after editing the recipe.

## Linux / Omarchy

Select `provider: "piper"`, a logical voice ID, and an explicitly installed engine/model:

```sh
superimg narrate narration.json --piper-model /path/to/voice.onnx --piper-executable /path/to/piper
```

The adjacent `voice.onnx.json` must exist. The adapter records and checks model/config hashes and passes both files to Piper. It does not install packages or download voices. `SUPERIMG_PIPER_MODEL` and `SUPERIMG_PIPER_EXECUTABLE` are alternative host configuration variables. Engine/model distribution and publication rights need their own review. Native model and pronunciation overrides are rejected; configure the actual Piper model on the host.

## ElevenLabs

Select `provider: "elevenlabs"`, a provider voice ID, and optionally `model`. The host reads `ELEVENLABS_API_KEY`; the key never enters the recipe or prepared artifact. CLI output uses mono PCM at 24 kHz, wrapped as WAV. Unsupported formats/account capabilities produce provider errors.

An explicit generation may incur provider usage. Requests are sequential and limited to 100 segments per preparation by default. There is no automatic paid retry after an uncertain dispatch. The SDK lets hosts configure another segment limit and inject their own provider/fetch implementation.

Returned character timing is preserved in provenance. When present, normalized character alignment supplies whitespace-delimited caption tokens with the provider's start/end times. Languages without whitespace can remain a longer token; no linguistic word segmentation or forced alignment is claimed. Invalid alignment is rejected. Native providers currently produce no word timestamps.

The implementation follows the [ElevenLabs timing response](https://elevenlabs.io/docs/api-reference/text-to-speech/convert-with-timestamps). Provider output and seed behavior must not be treated as reproducible; frozen byte hashes are authoritative.

## Timing and review

Natural mode reserves measured speech, before/after pauses, and explicitly recorded padding to whole video frames. Fixed mode requires `budgetSeconds` on every segment, keeps cumulative absolute frame boundaries, and reports overflow. Neither mode truncates audio or silently adjusts speaking rate. For `macos-say` in fixed mode, opt in with `rateAdjustment: { "maxAttempts": 2, "maxRateWpm": 220 }` and an explicit integer `settings.rateWpm`. Preparation retries only overflowing segments, never exceeds the rate or attempt limit, and records the effective request per clip. Remaining overflow still fails the plan. Preview includes the retry upper bound; other providers reject this option before synthesis.

```sh
superimg narration-review narration.narration --json
superimg narration-review narration.narration --encoded-artifact lesson.export/media/lesson.mp4
```

Encoded IDs resolve under the same `output/` target root. The reviewer copies verified encoded bytes into the review bundle, binds them by hash, and writes `review.json` and offline `review.html`. It checks WAV hashes/metadata and peak/RMS/clipping; encoded inspection checks track presence and duration tolerance and reports dimensions/codecs. Encoded decoded-audio levels and LUFS remain explicitly unmeasured. Scene navigation seeks within the copied encoded clip.

The viewer does not yet include representative rendered frames, font measurement findings, or continuous collision checks. The new `--rendered-layout` option is preparatory wiring: Node currently returns `RENDERED_LAYOUT_UNAVAILABLE`, rather than claiming a measured result. Browser export still rejects authored audio timelines; use Node export and browser playback.

## Host integration

`createNodeMediaInteractionMount({ ..., narration: { cacheDirectory, providers, maxSegments, maxRequests } })` exposes:

- `media.speech.voices`
- `media.speech.synthesize`
- `media.narration.prepare`
- `media.narration.review`

Hosts configure providers and credentials privately and use their existing logical artifact target registry. Portable interaction results contain target IDs and relative paths. A browser host can dispatch these interactions through its own authenticated bridge; this change does not install a new browser RPC server.

## Validation evidence

Tests cover relative audio references, cache reuse, malformed WAVs, cancellation and subprocess termination, provider failures, plan overflow and frame rounding, honest alignment, bundle portability, interaction dispatch, review hashes, and encoded findings.

The optional `packages/superimg-interactions/src/node/narration.native.test.ts` test runs only with `SUPERIMG_RUN_NARRATION_SMOKE=1`. It generates a local draft, deletes the synthesis cache, exports an MP4, and inspects both tracks. It passed on macOS with access to speech services and Chromium. A sandboxed native probe produced empty output; empty WAVs now fail validation.
