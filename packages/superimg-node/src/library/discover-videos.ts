//! Discover all *.media.ts / *.media.js template files under the project root.
//! (The medium — html vs svg — and animated-ness are read from each file's
//! config at parse time, not inferred from the filename.)

import { join } from "node:path";
import { existsSync } from "node:fs";
import { discoverMediaSources } from "./project.js";

export interface DiscoveredVideo {
  /** e.g. "summer-campaign/promo" (relative path minus .media.ts) */
  name: string;
  /** Short name extracted from pattern (e.g. "hello-world" from hello-world/hello-world.media.ts) */
  shortName: string;
  /** Absolute path to the template file */
  entrypoint: string;
  /** Absolute path to the containing folder */
  directory: string;
  /** Path relative to project root */
  relativePath: string;
  /** true if folder contains its own _config.ts */
  hasLocalConfig: boolean;
}

function stripTemplateExtension(filename: string): string {
  return filename.replace(/\.media\.(ts|js)$/, "");
}

/** True for the single `*.media.ts` / `*.media.js` template extension. */
export function isTemplateFile(filename: string): boolean {
  return filename.endsWith(".media.ts") || filename.endsWith(".media.js");
}

/**
 * Extract a short name from a template file path.
 * - {folder}/{folder}.media.ts → folder name
 * - {any}/index.media.ts → parent folder name
 * - Fallback: filename without extension
 */
export function extractShortName(relPath: string): string {
  const parts = relPath.replace(/\\/g, "/").split("/");
  const filename = parts[parts.length - 1] ?? "";
  const baseName = stripTemplateExtension(filename);
  const parentFolder = parts.length > 1 ? parts[parts.length - 2] : "";

  // Pattern: {folder}/{folder}.media.ts
  if (parentFolder && baseName === parentFolder) {
    return parentFolder;
  }

  // Pattern: {any}/index.media.ts
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
 * Discovers all *.media.ts and *.media.js files under the project root.
 * Excludes node_modules, .next, .vercel, dist, out, .git, build, .turbo.
 */
export function discoverVideos(projectRoot: string): DiscoveredVideo[] {
  if (!existsSync(projectRoot)) return [];
  return discoverMediaSources(projectRoot).map((source) => {
    const directory = join(projectRoot, ...source.relativePath.split("/").slice(0, -1));
    return { ...source, directory, hasLocalConfig: existsSync(join(directory, "_config.ts")) };
  });
}
