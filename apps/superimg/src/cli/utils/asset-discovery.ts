import { existsSync, readdirSync } from "node:fs";
import { resolve, extname, basename } from "node:path";
import type { ResolvedAssetDeclaration } from "@superimg/types";
import { detectAssetType } from "@superimg/core";

export function discoverAssetsFolder(assetsDir: string, sourceDir: string): ResolvedAssetDeclaration[] {
  if (!existsSync(assetsDir)) return [];
  const result: ResolvedAssetDeclaration[] = [];
  for (const file of readdirSync(assetsDir)) {
    const ext = extname(file);
    if (!/\.(mp4|webm|mov|avi|mkv|flv|wmv|mp3|wav|ogg|aac|m4a|flac|opus|png|jpg|jpeg|gif|webp|svg)$/i.test(file)) {
      continue;
    }
    const type = detectAssetType(file);
    const stem = basename(file, ext);
    result.push({
      key: stem,
      type,
      src: `./assets/${file}`,
      sourceDir,
    });
  }
  return result;
}

export function discoverTemplateAssets(templateDir: string): ResolvedAssetDeclaration[] {
  return discoverAssetsFolder(resolve(templateDir, "assets"), templateDir);
}
