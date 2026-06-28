import { isAbsolute, resolve } from "node:path";
import { resolveAssetUrls, normalizeAudioInput } from "@superimg/core";
import type { AudioClip, AudioValue, ResolvedAssetDeclaration } from "@superimg/types";

interface PrepareAssetsOptions {
  autoDiscovered?: ResolvedAssetDeclaration[];
  configAssets?: ResolvedAssetDeclaration[];
  assetBaseUrl?: string;
}

export function prepareAssets(options: PrepareAssetsOptions): ResolvedAssetDeclaration[] {
  const merged = new Map<string, ResolvedAssetDeclaration>();

  for (const asset of options.autoDiscovered ?? []) {
    merged.set(asset.key, asset);
  }

  for (const asset of options.configAssets ?? []) {
    merged.set(asset.key, asset);
  }

  const resolved = Array.from(merged.values());
  return options.assetBaseUrl
    ? resolveAssetUrls(resolved, options.assetBaseUrl)
    : resolved;
}

function resolveClipSrc(
  src: string,
  templateDir: string,
  assetBaseUrl: string,
): string {
  if (src.startsWith("http") || src.startsWith("data:")) {
    return src;
  }
  const absolutePath = isAbsolute(src) ? src : resolve(templateDir, src);
  return `${assetBaseUrl}/assets?path=${encodeURIComponent(absolutePath)}`;
}

function resolveClipUrls(
  clip: AudioClip,
  templateDir: string,
  assetBaseUrl: string,
): AudioClip {
  return {
    ...clip,
    src: resolveClipSrc(clip.src, templateDir, assetBaseUrl),
  };
}

export function resolveAudioUrl(
  audio: AudioValue | undefined,
  templateDir: string,
  assetBaseUrl?: string,
): AudioValue | undefined {
  if (!audio || !assetBaseUrl) return audio;

  if (Array.isArray(audio)) {
    return audio.map((clip) => resolveClipUrls(clip, templateDir, assetBaseUrl));
  }
  if ("clips" in audio) {
    return {
      ...audio,
      clips: audio.clips.map((clip) => resolveClipUrls(clip, templateDir, assetBaseUrl)),
    };
  }
  return resolveClipUrls(audio, templateDir, assetBaseUrl);
}

/** Collect unique audio src paths from config for asset validation */
export function listAudioSrcPaths(audio: AudioValue | undefined): string[] {
  if (!audio) return [];
  const timeline = normalizeAudioInput(audio);
  return timeline.clips.map((c) => c.src);
}