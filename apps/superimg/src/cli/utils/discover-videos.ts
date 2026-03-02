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
 * Check for duplicate video names and return a warning message if any exist.
 * Call this after discoverVideos() to warn about collisions.
 */
export function checkDuplicateVideoNames(videos: DiscoveredVideo[]): string | null {
  const byName = new Map<string, DiscoveredVideo[]>();
  for (const v of videos) {
    const list = byName.get(v.name) ?? [];
    list.push(v);
    byName.set(v.name, list);
  }
  const duplicates = [...byName.entries()].filter(([, list]) => list.length > 1);
  if (duplicates.length === 0) return null;
  const lines = duplicates.map(
    ([name, list]) =>
      `  - "${name}" found in:\n${list.map((v) => `      ${v.relativePath}`).join("\n")}`
  );
  return `Duplicate video names detected. Only the first match will be used:\n${lines.join("\n")}`;
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
          const directory = join(dir);
          const configPath = join(directory, "_config.ts");
          const hasLocalConfig = existsSync(configPath);

          results.push({
            name,
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
