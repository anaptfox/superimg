import { isAbsolute, resolve } from "node:path";
import { resolveAssetUrls, normalizeAudioInput } from "@superimg/core";
import type { AudioClip, AudioValue, ResolvedAssetDeclaration } from "@superimg/types";

interface PrepareAssetsOptions {
  autoDiscovered?: ResolvedAssetDeclaration[];
  configAssets?: ResolvedAssetDeclaration[];
  assetUrlResolver?: (absolutePath: string) => string;
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
  return options.assetUrlResolver
    ? resolveAssetUrls(resolved, options.assetUrlResolver)
    : resolved;
}

function resolveClipSrc(
  src: string,
  templateDir: string,
): string {
  if (src.startsWith("http") || src.startsWith("data:")) {
    return src;
  }
  const absolutePath = isAbsolute(src) ? src : resolve(templateDir, src);
  return absolutePath;
}

function resolveClipUrls(
  clip: AudioClip,
  templateDir: string,
): AudioClip {
  return {
    ...clip,
    src: resolveClipSrc(clip.src, templateDir),
  };
}

export function resolveAudioUrl(
  audio: AudioValue | undefined,
  templateDir: string,
): AudioValue | undefined {
  if (!audio) return audio;

  if (Array.isArray(audio)) {
    return audio.map((clip) => resolveClipUrls(clip, templateDir));
  }
  if ("clips" in audio) {
    return {
      ...audio,
      clips: audio.clips.map((clip) => resolveClipUrls(clip, templateDir)),
    };
  }
  return resolveClipUrls(audio, templateDir);
}

/** Collect unique audio src paths from config for asset validation */
export function listAudioSrcPaths(audio: AudioValue | undefined): string[] {
  if (!audio) return [];
  const timeline = normalizeAudioInput(audio);
  return timeline.clips.map((c) => c.src);
}
