# Audio Timelines

SuperImg mixes multiple audio clips into the final MP4/WebM. Timeline config is **serializable data** — plain JSON clips, not code.

## Clip model

```typescript
import type { AudioClip, AudioTimeline } from "superimg";

// Single bed (shorthand)
audio: {
  id: "bed",
  src: "assets/music.mp3",
  role: "music",
  volume: 0.4,
  fadeIn: "0.5s",
  fadeOut: "2s",
  loop: true,
}

// Multi-track
audio: {
  clips: [
    { id: "bed", src: "assets/bed.mp3", role: "music", loop: true },
    { id: "vo", src: "assets/voice.mp3", role: "voice", at: "3s" },
  ],
  mix: { ducking: true, duckingLevel: 0.25 },
}
```

| Field | Purpose |
|-------|---------|
| `id` | Stable clip identity (auto-generated with dev warning if omitted) |
| `at` | Start time on the video timeline (`"8s"`, `240` seconds, `"90f"`) |
| `atScene` | Start at a `compose()` scene id (resolved after scene boundaries) |
| `trim.in` / `trim.out` | Source window inside the file |
| `duration` | How long the clip plays on the timeline |
| `role` | `music` \| `voice` \| `sfx` \| `ambient` — drives defaults and ducking |
| `transcript` | Word timings on voice clips for `std.cue.transcript()` |

`config.audio` accepts `AudioClip`, `AudioClip[]`, or `AudioTimeline`.

## Order of operations

At render time, SuperImg resolves clips in this order:

```
normalize → ensureClipIds → inferRole → resolve atScene
→ trim → place → volume/fade → duck → master → encode
```

Resolved output is passed to the encoder as `ResolvedAudioTimeline` (48 kHz stereo mix).

## Compose + per-scene audio

Use global `config.audio` for beds and `scene(..., { audio })` for chapter narration:

```typescript
import { compose, scene } from "superimg";

export default compose(
  [
    scene(hook, { id: "hook", duration: "8s" }),
    scene(chapter, {
      id: "ch1",
      duration: "45s",
      audio: {
        id: "ch1-vo",
        src: "assets/ch1-vo.mp3",
        role: "voice",
        transcript: ch1Words,
      },
    }),
    scene(outro, { id: "outro", duration: "6s" }),
  ],
  {
    config: {
      audio: {
        clips: [{ id: "bed", src: "assets/bed.mp3", role: "music", loop: true }],
        mix: { ducking: true },
      },
    },
  },
);
```

Scene clips without `at` or `atScene` default to `atScene: scene.id`.

## Syncing visuals to audio

Use `std.cue.transcript()` with word timings from the same clip (or your `sample` data):

```typescript
const transcript = std.cue.transcript(data.words, ctx.timeline.seconds);
const word = transcript.current();
```

For compose scenes, `timeline.seconds` is local to the chapter — match transcript offsets to scene-local time, or offset globally when resolving `atScene`.

## Read-model API

`buildTimelineModel(template, resolvedAudio)` returns a `TimelineModel` with video and per-role audio lanes. Intended for dev tooling and agents inspecting placement — not required for rendering.

See [Building a Timeline](./building-a-timeline.md) for the full read-model shape.

## Breaking change (0.0.21+)

The legacy `AudioOptions` shape (`audio: { src, volume, fadeIn: 0.5 }` with numeric fades and bare path strings) is removed. Migrate to `AudioClip` with `id`, `role`, and duration strings (`"0.5s"`).