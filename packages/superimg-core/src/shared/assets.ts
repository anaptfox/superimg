//! Asset resolution and type detection

import type {
  BackgroundValue,
  AudioValue,
  FitMode,
  AssetDeclaration,
  ResolvedAssetDeclaration,
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

export interface ResolvedAudio {
  type: "audio";
  src: string;
  loop: boolean;
  volume: number;
  fadeIn?: number;
  fadeOut?: number;
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
      loop: type === "video" ? true : undefined,
      opacity: 1,
    };
  }

  // Object form
  const type = detectBackgroundType(value.src);
  return {
    type,
    src: value.src,
    fit: value.fit ?? "cover",
    loop: value.loop ?? (type === "video" ? true : undefined),
    opacity: value.opacity ?? 1,
  };
}

/**
 * Resolve audio value to ResolvedAudio
 */
export function resolveAudio(value: AudioValue): ResolvedAudio {
  if (typeof value === "string") {
    return {
      type: "audio",
      src: value,
      loop: true,
      volume: 1,
    };
  }

  return {
    type: "audio",
    src: value.src,
    loop: value.loop ?? true,
    volume: value.volume ?? 1,
    fadeIn: value.fadeIn,
    fadeOut: value.fadeOut,
  };
}

/**
 * Resolve config.assets to normalized declarations for loading.
 * Supports shorthand (string) and explicit (AssetDeclaration) forms.
 */
export function resolveConfigAssets(
  assets: Record<string, string | AssetDeclaration> | undefined,
  defaultSourceDir: string = process.cwd()
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
