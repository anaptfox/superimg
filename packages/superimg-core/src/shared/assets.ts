//! Asset resolution and type detection

import type {
  AudioClip,
  AudioTimeline,
  AudioValue,
  BackgroundValue,
  FitMode,
  AssetDeclaration,
  ResolvedAssetDeclaration,
  SceneDefinition,
} from "@superimg/types";

export type AssetType = "solid" | "image" | "video" | "audio";

export type { ResolvedAssetDeclaration };

export interface ResolvedBackground {
  type: AssetType;
  src: string;
  fit: FitMode;
  loop?: boolean;
  opacity: number;
}

/**
 * Detect asset type from file extension (image, video, or audio)
 */
export function detectAssetType(src: string): "image" | "video" | "audio" {
  if (/\.(mp4|webm|mov|avi|mkv|flv|wmv)$/i.test(src)) return "video";
  if (/\.(mp3|wav|ogg|aac|m4a|flac|opus)$/i.test(src)) return "audio";
  return "image";
}

/**
 * Detect background type from file extension or color format (adds "solid" detection)
 */
function detectBackgroundType(src: string): AssetType {
  if (src.startsWith("#") || src.startsWith("rgb") || src.startsWith("hsl") || src.startsWith("rgba") || src.startsWith("hsla")) {
    return "solid";
  }
  return detectAssetType(src);
}

/**
 * Resolve background value to ResolvedBackground
 */
export function resolveBackground(value: BackgroundValue): ResolvedBackground {
  if (typeof value === "string") {
    const type = detectBackgroundType(value);
    return {
      type,
      src: value,
      fit: "cover",
      ...(type === "video" ? { loop: true } : {}),
      opacity: 1,
    };
  }

  // Object form
  const type = detectBackgroundType(value.src);
  const loop = value.loop ?? (type === "video" ? true : undefined);
  return {
    type,
    src: value.src,
    fit: value.fit ?? "cover",
    ...(loop !== undefined ? { loop } : {}),
    opacity: value.opacity ?? 1,
  };
}

export {
  normalizeAudioInput,
  resolveAudioTimeline,
  ensureClipIds,
  inferAudioRole,
  sceneBoundariesFromResolved,

  type SceneBoundary,
  type ResolveAudioContext,
} from "./audio-resolve.js";

export {
  mixAudioClips,
  resampleChannels,
  interleaveStereo,
  TARGET_SAMPLE_RATE,
  TARGET_CHANNELS,
  type DecodedAudioClip,
  type MixClipInput,
} from "./audio-dsp.js";

export { buildTimelineModel } from "./timeline-model.js";

function flattenClips(value: AudioValue | undefined): AudioClip[] {
  if (!value) return [];
  if (Array.isArray(value)) return value;
  if ("clips" in value) return value.clips;
  return [value];
}

/**
 * Merge compose-level config.audio with per-scene clips.
 * Scene clips without at/atScene get atScene = scene.id.
 */
export function collectComposeAudio(
  scenes: SceneDefinition[],
  globalAudio?: AudioValue,
): AudioTimeline | undefined {
  const clips: AudioClip[] = [...flattenClips(globalAudio)];

  for (const def of scenes) {
    if (!def.audio) continue;
    const sceneId = def.id;
    const sceneClips = Array.isArray(def.audio) ? def.audio : [def.audio];
    for (const clip of sceneClips) {
      clips.push({
        ...clip,
        ...(clip.at === undefined && clip.atScene === undefined && sceneId
          ? { atScene: sceneId }
          : {}),
      });
    }
  }

  if (clips.length === 0) return undefined;

  const mix =
    globalAudio && "clips" in globalAudio && globalAudio.mix
      ? globalAudio.mix
      : undefined;

  return { clips, ...(mix ? { mix } : {}) };
}

/**
 * Resolve config.assets to normalized declarations for loading.
 * Supports shorthand (string) and explicit (AssetDeclaration) forms.
 */
export function resolveConfigAssets(
  assets: Record<string, string | AssetDeclaration> | undefined,
  defaultSourceDir: string = (typeof process !== "undefined" && process.cwd ? process.cwd() : ".")
): ResolvedAssetDeclaration[] {
  if (!assets || Object.keys(assets).length === 0) return [];

  return Object.entries(assets).map(([key, value]) => {
    const sourceDir = defaultSourceDir;
    if (typeof value === "string") {
      return {
        key,
        type: detectAssetType(value),
        src: value,
        sourceDir,
      };
    }
    const type = value.type ?? detectAssetType(value.src);
    return {
      key,
      type,
      src: value.src,
      sourceDir,
    };
  });
}
