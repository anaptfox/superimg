import { Buffer } from "node:buffer";
import { isAbsolute, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { isGoogleFontDeclaration, type AssetDeclaration } from "@superimg/types";
import { fontBytesDataUrl, fontFaceCss, googleFontSpecs, resolveRuntimeFonts } from "@superimg/core";

export function resolveDevAssetUrls(
  assets: Record<string, AssetDeclaration> | undefined,
  sourceDir: string,
  registerAsset: (path: string) => string,
): Record<string, string> {
  const urls: Record<string, string> = {};
  for (const [key, declaration] of Object.entries(assets ?? {})) {
    if ("bytes" in declaration) {
      urls[key] = `data:${declaration.mimeType};base64,${Buffer.from(declaration.bytes).toString("base64")}`;
      continue;
    }
    const source = String(declaration.url);
    let resolved = source;
    if (source.startsWith("file:")) {
      resolved = registerAsset(fileURLToPath(new URL(source)));
    } else if (!/^(?:[a-z][a-z\d+.-]*:|\/\/)/i.test(source)) {
      const absolutePath = isAbsolute(source) ? source : resolve(sourceDir, source);
      resolved = registerAsset(absolutePath);
    }
    urls[key] = resolved;
    urls[source] = resolved;
  }
  return urls;
}

export function addDiscoveredDevAssetUrls(
  urls: Record<string, string>,
  assets: readonly { src: string; sourceDir: string; key: string }[],
  registerAsset: (path: string) => string,
): void {
  for (const asset of assets) {
    const path = isAbsolute(asset.src) ? asset.src : resolve(asset.sourceDir, asset.src);
    const url = registerAsset(path);
    if (!Object.hasOwn(urls, asset.src.split(/[\\/]/).at(-1) ?? asset.src)) {
      urls[asset.src.split(/[\\/]/).at(-1) ?? asset.src] = url;
    }
    if (!Object.hasOwn(urls, asset.key)) urls[asset.key] = url;
  }
}

export async function resolveDevFonts(
  fonts: readonly unknown[] | undefined,
  sourceDir: string,
): Promise<{ css?: string; stylesheets?: string[] } | undefined> {
  const googleSpecs = googleFontSpecs(fonts);
  const localFonts = fonts?.filter((font) => !isGoogleFontDeclaration(font));
  const resolution = await resolveRuntimeFonts(localFonts, {
    sourceDir,
    format: "web",
    ...(googleSpecs.some((spec) => spec.split(":", 1)[0]?.trim().toLowerCase() === "inter") ? { defaultFonts: false } : {}),
  });
  if (resolution.errors.length > 0) throw new Error(resolution.errors.map((issue) => issue.message).join("; "));
  const css = resolution.faces
    .map((face) => fontFaceCss(face, fontBytesDataUrl(face.data, face.mimeType ?? "font/ttf")))
    .join("\n");
  const stylesheets = googleSpecs.map((spec) => `https://fonts.googleapis.com/css2?family=${encodeURIComponent(spec)}&display=swap`);
  return css || stylesheets.length > 0 ? { ...(css ? { css } : {}), ...(stylesheets.length > 0 ? { stylesheets } : {}) } : undefined;
}
