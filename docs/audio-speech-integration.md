# Audio Speech Integration (Boundary)

This document defines the **integration boundary** for future text-to-speech (TTS) — e.g. ElevenLabs — without implementing a provider in the core framework.

## Design principle

Timeline clips are JSON-round-trippable. Speech is a **source kind** on a clip, not a separate pipeline.

```typescript
type AudioSource =
  | { kind: "file"; src: string }
  | { kind: "recording"; id: string }
  | {
      kind: "speech";
      provider: "elevenlabs";
      text: string;
      voiceId: string;
      modelId?: string;
    };
```

At render time today, only `kind: "file"` (or clips with a resolved `src` path) are supported. Non-file sources throw a clear error until a synth adapter exists.

## DocumentaryScript (type only)

```typescript
interface DocumentaryScript {
  voiceId: string;
  modelId?: string;
  scenes: Array<{ sceneId: string; text: string }>;
}
```

Reserved for batch pipelines: script JSON → generated MP3 per scene → `scene(..., { audio: { src, transcript } })`.

## Planned data flow

```mermaid
flowchart LR
  script["DocumentaryScript JSON"]
  synth["@superimg/speech-synth"]
  clips["AudioClip[] with file src"]
  render["superimg render"]
  script --> synth --> clips --> render
```

1. Agent or author writes `DocumentaryScript` + scene templates.
2. `superimg synth-speech` (future CLI) calls TTS, writes `assets/ch1-vo.mp3`, attaches `transcript` word timings.
3. Compose template references generated files — same clip schema as hand-authored VO.

## Adapter gap today

| Capability | Status |
|------------|--------|
| `AudioSource` type with `speech` kind | Shipped (types only) |
| `transcript` on `AudioClip` | Shipped |
| `std.cue.transcript()` in templates | Shipped |
| ElevenLabs TTS client | Not implemented |
| `fromElevenLabsTTS` adapter | Not implemented |
| `superimg synth-speech` CLI | Not implemented |
| `duration: "voice"` auto-length | Not implemented |

STT today: `fromElevenLabs` in `@superimg/stdlib` converts existing audio to word timings (karaoke), not TTS.

## Error behavior

When a clip has `source: { kind: "speech", ... }` and no resolvable `src` file:

```
Speech audio source requires synthesis. Run `superimg synth-speech` or provide a file src.
```

## Future package sketch

`@superimg/speech-synth` (optional peer):

- `synthesizeClip(clip, options)` → `{ src, transcript, durationSeconds }`
- Provider plugins: `elevenlabs`, later `openai`, local models
- No changes to `AudioClip` schema when added

## Example target

`examples/composed/documentary-reel/` demonstrates compose + multi-track mix + transcript sync with file-based VO placeholders. Swap `src` paths after TTS without changing scene structure.