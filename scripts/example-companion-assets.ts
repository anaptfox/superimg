import * as fs from "node:fs";
import * as path from "node:path";

export interface CompanionAsset {
  readonly source: string;
  readonly relative: string;
}

const SKIP_DIRECTORIES = new Set([
  ".next", ".output", ".superimg", ".turbo", ".vinxi",
  "build", "dist", "node_modules", "output",
]);

const MEDIA_EXTENSIONS = new Set([
  ".avif", ".gif", ".jpeg", ".jpg", ".png", ".svg", ".webp",
  ".m4a", ".mp3", ".ogg", ".wav", ".webm", ".mov", ".mp4",
  ".glb", ".gltf", ".otf", ".ttf", ".woff", ".woff2",
]);

const ASSET_DIRECTORY_EXTENSIONS = new Set([
  ".css", ".csv", ".json", ".mmd", ".txt", ".vtt",
]);

/** Collect public companion files without publishing source or server modules. */
export function collectCompanionAssets(sourceDirectory: string): readonly CompanionAsset[] {
  const assets: CompanionAsset[] = [];

  function visit(directory: string, relativeDirectory: string, inAssetDirectory: boolean): void {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      if (entry.name.startsWith(".")) continue;
      const relative = relativeDirectory
        ? path.join(relativeDirectory, entry.name)
        : entry.name;
      const source = path.join(directory, entry.name);

      if (entry.isDirectory()) {
        if (SKIP_DIRECTORIES.has(entry.name)) continue;
        visit(source, relative, inAssetDirectory || entry.name === "assets");
        continue;
      }
      if (!entry.isFile()) continue;

      const extension = path.extname(entry.name).toLowerCase();
      if (MEDIA_EXTENSIONS.has(extension) ||
          (inAssetDirectory && ASSET_DIRECTORY_EXTENSIONS.has(extension))) {
        assets.push({ source, relative });
      }
    }
  }

  visit(sourceDirectory, "", false);
  return assets.sort((left, right) => left.relative.localeCompare(right.relative));
}
