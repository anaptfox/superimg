# Building a Timeline

SuperImg treats the timeline as **data in config**, not UI state. This guide covers the read-model API agents and future dev tools use to inspect placement.

## Source of truth

| Layer | Location |
|-------|----------|
| Authoring | `config.audio`, `scene(..., { audio })` in `*.media.ts` |
| Resolution | `resolveAudioTimeline()` in `@superimg/core` |
| Read-model | `buildTimelineModel()` |
| Encode | Node/browser encoders consume `ResolvedAudioTimeline` |

## Resolve then model

```typescript
import {
  resolveAudioTimeline,
  buildTimelineModel,
  sceneBoundariesFromResolved,
} from "@superimg/core";

const resolved = resolveAudioTimeline(template.config?.audio, {
  fps: 30,
  videoDurationSeconds: 60,
  scenes: [
    { id: "hook", startSeconds: 0, endSeconds: 8 },
    { id: "ch1", startSeconds: 8, endSeconds: 53 },
    { id: "outro", startSeconds: 53, endSeconds: 60 },
  ],
});

const model = buildTimelineModel(template, resolved);
```

For composed templates, pass scene boundaries from the composed template's resolved scenes (or `sceneBoundariesFromResolved` after resolution).

## TimelineModel shape

```typescript
interface TimelineModel {
  durationSeconds: number;
  fps: number;
  tracks: TimelineTrack[];
}

interface TimelineTrack {
  id: string;           // e.g. "video", "audio-music", "audio-voice"
  kind: "video" | "audio";
  label: string;
  items: TimelineItem[];
}
```

**Video lane** — one item per `compose()` scene:

| Field | Meaning |
|-------|---------|
| `sceneId` | Scene id from `scene(..., { id })` |
| `startSeconds` / `endSeconds` | Placement on the full video |

**Audio lanes** — one track per role (`music`, `voice`, `sfx`, `ambient`):

| Field | Meaning |
|-------|---------|
| `clipId` | Clip `id` from config |
| `src` | Resolved asset path |
| `startSeconds` / `endSeconds` | Mixed placement |
| `volume`, `loop` | Mix parameters |

Clips with `showInTimeline: false` are omitted from the model (they still render).

## Clip metadata for editors

```typescript
interface AudioClip {
  id?: string;
  label?: string;        // Human label in future UI
  showInTimeline?: boolean;
  // ...
}
```

`ensureClipIds()` fills missing ids (`clip-0`, `clip-1`, …) and emits dev warnings.

## Documentary pattern

See `examples/composed/documentary-reel/`:

- Global music bed in `config.audio.clips`
- Per-chapter voice in `scene(chapter, { audio: { ... } })`
- `transcript` on voice clips for caption sync
- `mix.ducking` lowers music under voice

## Out of scope (this release)

- Dev UI timeline panel
- `GET /api/timeline` endpoint
- Drag-edit / save-back to config
- `duration: "voice"` (auto-length from TTS)

These build on the same `TimelineModel` without schema changes.