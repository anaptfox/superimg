//! Build canonical timeline read-model from template + resolved audio

import type {
  AudioRole,
  ComposedTemplate,
  TemplateModule,
  TimelineModel,
  TimelineTrack,
  VideoTimelineItem,
  AudioTimelineItem,
} from "@superimg/types";
import type { ResolvedAudioTimeline } from "@superimg/types";
import { sceneBoundariesFromResolved } from "./audio-resolve.js";
import { parseDuration } from "./utils.js";

const AUDIO_ROLE_LABELS: Record<AudioRole, string> = {
  music: "Music",
  voice: "Voice",
  sfx: "SFX",
  ambient: "Ambient",
};

const AUDIO_ROLES: AudioRole[] = ["music", "voice", "sfx", "ambient"];

export function buildTimelineModel(
  template: TemplateModule | ComposedTemplate,
  resolvedAudio: ResolvedAudioTimeline | null,
): TimelineModel | null {
  const config = template.config;
  const fps = config?.fps ?? 30;
  const isComposed = "type" in template && template.type === "composed";

  if (!isComposed && !resolvedAudio?.clips.length) {
    return null;
  }

  const durationSeconds = isComposed
    ? template.duration
    : config?.duration !== undefined
      ? parseDuration(config.duration, "duration", fps)
      : (resolvedAudio?.videoDurationSeconds ?? 0);

  const tracks: TimelineTrack[] = [];

  if (isComposed) {
    const composed = template as ComposedTemplate;
    const videoItems: VideoTimelineItem[] = composed.scenes
      .map((s) => ({
        type: "scene" as const,
        id: s.id,
        ...(s.label !== undefined ? { label: s.label } : {}),
        startSeconds: s.startFrame / fps,
        endSeconds: s.endFrame / fps,
        showInTimeline: true,
        sceneId: s.id,
        sceneIndex: s.index,
      }));

    tracks.push({
      id: "video",
      kind: "video",
      label: "Video",
      items: videoItems,
    });
  }

  if (resolvedAudio) {
    for (const role of AUDIO_ROLES) {
      const roleClips = resolvedAudio.clips.filter(
        (c) => c.role === role && c.showInTimeline,
      );
      if (roleClips.length === 0) continue;

      const items: AudioTimelineItem[] = roleClips.map((c) => ({
        type: "audio" as const,
        id: c.id,
        ...(c.label !== undefined ? { label: c.label } : {}),
        startSeconds: c.atSeconds,
        endSeconds: c.atSeconds + c.placementDurationSeconds,
        showInTimeline: c.showInTimeline,
        role: c.role,
        src: c.src,
        clipId: c.id,
        loop: c.loop,
        volume: c.volume,
      }));

      tracks.push({
        id: `audio-${role}`,
        kind: "audio",
        label: AUDIO_ROLE_LABELS[role],
        items,
      });
    }
  }

  if (tracks.length === 0) return null;

  return {
    durationSeconds,
    fps,
    tracks,
  };
}

export { sceneBoundariesFromResolved };