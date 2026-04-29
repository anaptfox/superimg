import { isAbsolute, resolve } from "node:path";
import { resolveAssetUrls } from "@superimg/core/engine";
import type { AudioValue, ResolvedAssetDeclaration } from "@superimg/types";

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

export function resolveAudioUrl(
  audio: AudioValue | undefined,
  templateDir: string,
  assetBaseUrl?: string
): AudioValue | undefined {
  if (!audio || !assetBaseUrl) return audio;

  const config = typeof audio === "string" ? { src: audio } : audio;
  if (config.src.startsWith("http") || config.src.startsWith("data:")) {
    return audio;
  }

  const absolutePath = isAbsolute(config.src)
    ? config.src
    : resolve(templateDir, config.src);

  return {
    ...config,
    src: `${assetBaseUrl}/assets?path=${encodeURIComponent(absolutePath)}`,
  };
}
