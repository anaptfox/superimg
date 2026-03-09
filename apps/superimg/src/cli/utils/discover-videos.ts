//! Discover all *.video.ts and *.video.js files under the project root

import { join, relative } from "node:path";
import { readdirSync, existsSync } from "node:fs";

const EXCLUDE_DIRS = new Set([
  "node_modules",
  ".next",
  ".vercel",
  "dist",
  "out",
  ".git",
  "build",
  ".turbo",
]);

export interface DiscoveredVideo {
  /** e.g. "summer-campaign/promo" (relative path minus .video.ts) */
  name: string;
  /** Short name extracted from pattern (e.g. "hello-world" from hello-world/hello-world.video.ts) */
  shortName: string;
  /** Absolute path to the .video.ts file */
  entrypoint: string;
  /** Absolute path to the containing folder */
  directory: string;
  /** Path relative to project root */
  relativePath: string;
  /** true if folder contains its own _config.ts */
  hasLocalConfig: boolean;
}

/**
 * Extract a short name from a video file path.
 * - {folder}/{folder}.video.ts → folder name
 * - {any}/index.video.ts → parent folder name
 * - Fallback: filename without .video.ts
 */
function extractShortName(relPath: string): string {
  const parts = relPath.replace(/\\/g, "/").split("/");
  const filename = parts[parts.length - 1];
  const baseName = filename.replace(/\.video\.(ts|js)$/, "");
  const parentFolder = parts.length > 1 ? parts[parts.length - 2] : "";

  // Pattern: {folder}/{folder}.video.ts
  if (parentFolder && baseName === parentFolder) {
    return parentFolder;
  }

  // Pattern: {any}/index.video.ts
  if (baseName === "index" && parentFolder) {
    return parentFolder;
  }

  // Fallback: just the filename
  return baseName;
}

/**
 * Check for duplicate short names and return a warning message if any exist.
 * Call this after discoverVideos() to warn about collisions.
 */
export function checkDuplicateVideoNames(videos: DiscoveredVideo[]): string | null {
  const byShortName = new Map<string, DiscoveredVideo[]>();
  for (const v of videos) {
    const list = byShortName.get(v.shortName) ?? [];
    list.push(v);
    byShortName.set(v.shortName, list);
  }
  const duplicates = [...byShortName.entries()].filter(([, list]) => list.length > 1);
  if (duplicates.length === 0) return null;
  const lines = duplicates.map(
    ([name, list]) =>
      `  - "${name}" found in:\n${list.map((v) => `      ${v.relativePath}`).join("\n")}`
  );
  return `Duplicate video short names detected. Use full path to disambiguate:\n${lines.join("\n")}`;
}

/**
 * Discovers all *.video.ts and *.video.js files under the project root.
 * Excludes node_modules, .next, .vercel, dist, out, .git, build, .turbo.
 */
export function discoverVideos(projectRoot: string): DiscoveredVideo[] {
  const results: DiscoveredVideo[] = [];

  function walk(dir: string) {
    if (!existsSync(dir)) return;

    const entries = readdirSync(dir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = join(dir, entry.name);

      if (entry.isDirectory()) {
        if (!EXCLUDE_DIRS.has(entry.name)) {
          walk(fullPath);
        }
      } else if (entry.isFile()) {
        const isVideoTs = entry.name.endsWith(".video.ts");
        const isVideoJs = entry.name.endsWith(".video.js");
        if (isVideoTs || isVideoJs) {
          const relPath = relative(projectRoot, fullPath);
          const name = relPath
            .replace(/\.video\.(ts|js)$/, "")
            .replace(/\\/g, "/");
          const shortName = extractShortName(relPath);
          const directory = join(dir);
          const configPath = join(directory, "_config.ts");
          const hasLocalConfig = existsSync(configPath);

          results.push({
            name,
            shortName,
            entrypoint: fullPath,
            directory,
            relativePath: relPath.replace(/\\/g, "/"),
            hasLocalConfig,
          });
        }
      }
    }
  }

  walk(projectRoot);
  results.sort((a, b) => a.name.localeCompare(b.name));
  return results;
}
