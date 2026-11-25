import type { AssetDeclaration, AssetMeta, TemplateConfig } from "@foxworth/superimg";

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
  for (const [key, value] of Object.entries(assets) as [string, AssetDeclaration][]) {
    const src = "url" in value ? String(value.url) : "";
    const mimeType = "bytes" in value ? value.mimeType : mimeForSrc(src);
    const type = value.type ?? (mimeType.startsWith("video/")
      ? "video"
      : mimeType.startsWith("audio/")
        ? "audio"
        : detectAssetType(src));
    const url = "url" in value
      ? /^(?:https?:|data:|blob:)/i.test(src) ? src : playgroundAssetUrl(src)
      : bytesDataUrl(value.bytes, value.mimeType);
    const size = "bytes" in value ? value.bytes.byteLength : 0;

    if (type === "video") {
      result[key] = {
        type: "video",
        url,
        mimeType,
        size,
        width: 1920,
        height: 1080,
        duration: 30,
      };
    } else if (type === "audio") {
      result[key] = {
        type: "audio",
        url,
        mimeType,
        size,
        duration: 30,
      };
    } else {
      result[key] = {
        type: "image",
        url,
        mimeType,
        size,
        width: 1920,
        height: 1080,
      };
    }
  }
  return result;
}

function bytesDataUrl(bytes: Uint8Array, mimeType: string): string {
  let binary = "";
  for (let index = 0; index < bytes.byteLength; index += 1) {
    binary += String.fromCharCode(bytes[index]!);
  }
  return `data:${mimeType};base64,${btoa(binary)}`;
}

export function hasRelativeImports(code: string): boolean {
  return /from\s+["'][./]/.test(code) || /import\s+["'][./]/.test(code);
}

export function hasConfigAssets(code: string): boolean {
  return /\bassets\s*:\s*\{/.test(code);
}
