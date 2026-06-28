import type { AssetMeta, TemplateConfig } from "superimg/react";

const MIME_BY_EXT: Record<string, string> = {
  mp4: "video/mp4",
  webm: "video/webm",
  mp3: "audio/mpeg",
  wav: "audio/wav",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif",
  webp: "image/webp",
  svg: "image/svg+xml",
};

/** Map a template-relative asset path to a playground-served URL. */
export function playgroundAssetUrl(relativePath: string): string {
  const normalized = relativePath.replace(/\\/g, "/").replace(/^(\.\.\/)+/, "");
  return `/playground-assets/${normalized}`;
}

export function playgroundAssetResolver(path: string): string {
  return playgroundAssetUrl(path);
}

function detectAssetType(src: string): "image" | "video" | "audio" {
  const ext = src.split(".").pop()?.toLowerCase() ?? "";
  if (["mp4", "webm", "mov"].includes(ext)) return "video";
  if (["mp3", "wav", "ogg", "m4a"].includes(ext)) return "audio";
  return "image";
}

function mimeForSrc(src: string): string {
  const ext = src.split(".").pop()?.toLowerCase() ?? "";
  return MIME_BY_EXT[ext] ?? "application/octet-stream";
}

/** Build ctx.assets metadata from template config.assets declarations. */
export function resolvePlaygroundAssets(
  assets: TemplateConfig["assets"] | undefined,
): Record<string, AssetMeta> {
  if (!assets) return {};

  const result: Record<string, AssetMeta> = {};
  for (const [key, value] of Object.entries(assets) as [
    string,
    string | { src: string; type?: "image" | "video" | "audio" },
  ][]) {
    const src = typeof value === "string" ? value : value.src;
    const type =
      typeof value === "string"
        ? detectAssetType(src)
        : (value.type ?? detectAssetType(src));
    const url = playgroundAssetUrl(src);
    const mimeType = mimeForSrc(src);

    if (type === "video") {
      result[key] = {
        type: "video",
        url,
        mimeType,
        size: 0,
        width: 1920,
        height: 1080,
        duration: 30,
      };
    } else if (type === "audio") {
      result[key] = {
        type: "audio",
        url,
        mimeType,
        size: 0,
        duration: 30,
      };
    } else {
      result[key] = {
        type: "image",
        url,
        mimeType,
        size: 0,
        width: 1920,
        height: 1080,
      };
    }
  }
  return result;
}

export function hasRelativeImports(code: string): boolean {
  return /from\s+["'][./]/.test(code) || /import\s+["'][./]/.test(code);
}

export function hasConfigAssets(code: string): boolean {
  return /\bassets\s*:\s*\{/.test(code);
}