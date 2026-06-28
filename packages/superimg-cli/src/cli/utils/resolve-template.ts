//! Smart template path resolution for CLI commands
//!
//! Resolves bare names through *.media.ts convention:
//!   superimg dev intro        -> videos/intro.media.ts or project-wide search
//!   superimg dev intro.media.ts -> explicit or videos/intro.media.ts
//!   superimg dev ./path.media.ts -> explicit path

import { resolve, join } from "node:path";
import { existsSync } from "node:fs";
import { IOError, ValidationError } from "@superimg/types";
import { findProjectRoot } from "./find-project-root.js";
import {
  discoverVideos,
  checkDuplicateVideoNames,
  type DiscoveredVideo,
} from "./discover-videos.js";

/**
 * Resolve template path. Bare names are resolved through:
 * 1. videos/ convention (standalone .media.ts or folder with index.media.ts)
 * 2. Project-wide fallback via discoverVideos
 */
export function resolveTemplatePath(input: string, cwd = process.cwd()): string {
  const trimmed = input.trim();
  if (!trimmed) {
    throw new ValidationError({
      field: "template",
      expectedType: "non-empty path or template name",
      receivedValue: input,
      suggestion: "Pass a template name (e.g. `superimg dev intro`) or a path (e.g. `./videos/intro.media.ts`).",
    });
  }

  // Explicit path: starts with ./, /, or contains path separator
  if (trimmed.startsWith("./") || trimmed.startsWith("/") || trimmed.includes("/")) {
    const resolved = resolve(cwd, trimmed);
    if (!existsSync(resolved)) {
      throw new IOError({
        operation: "read",
        path: resolved,
        originalError: "ENOENT",
      });
    }
    const validExt =
      resolved.endsWith(".media.ts") || resolved.endsWith(".media.js");
    if (!validExt) {
      throw new ValidationError({
        field: "template",
        expectedType: ".media.ts or .media.js file",
        receivedValue: trimmed,
        suggestion: "Rename the file to end in `.media.ts`.",
      });
    }
    return resolved;
  }

  // Bare name: strip the template extension if present
  const baseName = trimmed
    .replace(/\.media\.(ts|js)$/, "")
    .replace(/\.ts$/, "")
    .replace(/\.js$/, "");

  const projectRoot = findProjectRoot(cwd);
  const videosDir = join(projectRoot, "videos");

  // 1. videos/ convention
  const candidates = [
    join(videosDir, `${baseName}.media.ts`),
    join(videosDir, `${baseName}.media.js`),
    join(videosDir, baseName, "index.media.ts"),
    join(videosDir, baseName, "index.media.js"),
  ];

  for (const p of candidates) {
    if (existsSync(p)) return p;
  }

  // 2. Project-wide fallback
  const videos = discoverVideos(projectRoot);

  // Warn on duplicate short names
  const dupWarning = checkDuplicateVideoNames(videos);
  if (dupWarning) {
    console.warn(`Warning: ${dupWarning}`);
  }

  // Try short name match first (e.g. "hello-world" matches hello-world/hello-world.media.ts)
  const shortMatches = videos.filter((v) => v.shortName === baseName);
  if (shortMatches.length === 1) {
    const match = shortMatches[0];
    if (match) return match.entrypoint;
  }
  if (shortMatches.length > 1) {
    throw new ValidationError({
      field: "template",
      expectedType: "unambiguous template name",
      receivedValue: baseName,
      suggestion: `Found ${shortMatches.length} matches:\n${shortMatches.map((v) => `  - ${v.relativePath}`).join("\n")}\nUse an explicit path (e.g. ./${shortMatches[0]?.relativePath ?? baseName}).`,
    });
  }

  // Fallback to full name match
  const fullMatches = videos.filter((v) => v.name === baseName);
  if (fullMatches.length > 1) {
    throw new ValidationError({
      field: "template",
      expectedType: "unambiguous template name",
      receivedValue: baseName,
      suggestion: `Found ${fullMatches.length} matches:\n${fullMatches.map((v) => `  - ${v.relativePath}`).join("\n")}\nUse an explicit path (e.g. ./${fullMatches[0]?.relativePath ?? baseName}).`,
    });
  }
  const match = fullMatches[0];
  if (match) {
    return match.entrypoint;
  }

  // Not found: fuzzy match and list available
  const suggestion = findClosestVideoName(baseName, videos);
  let hint: string;
  if (videos.length > 0) {
    const list = `Available: ${videos.map((v) => v.name).join(", ")}.`;
    if (suggestion) {
      const match = videos.find((v) => v.name === suggestion);
      hint = `Did you mean "${suggestion}" (${match?.relativePath})? ${list}`;
    } else {
      hint = list;
    }
  } else {
    hint = "No *.media.ts files found in this project. Run `superimg init` to create one.";
  }

  throw new IOError({
    operation: "read",
    path: trimmed,
    originalError: `Template not found. Tried videos/${baseName}.media.ts, videos/${baseName}/index.media.ts, and project-wide search. ${hint}`,
  });
}

/**
 * Simple Levenshtein-based fuzzy match for typo suggestions.
 */
function findClosestVideoName(input: string, videos: DiscoveredVideo[]): string | null {
  if (videos.length === 0 || input.length < 2) return null;
  const inputLower = input.toLowerCase();
  let best: { name: string; dist: number } | null = null;
  const maxDist = Math.max(3, Math.floor(input.length * 0.5));
  for (const v of videos) {
    const dist = levenshtein(inputLower, v.name.toLowerCase());
    if (dist <= maxDist && (!best || dist < best.dist)) {
      best = { name: v.name, dist };
    }
  }
  return best?.name ?? null;
}

function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i]![0] = i;
  for (let j = 0; j <= n; j++) dp[0]![j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i]![j] = Math.min(
        (dp[i - 1]?.[j] ?? 0) + 1,
        (dp[i]?.[j - 1] ?? 0) + 1,
        (dp[i - 1]?.[j - 1] ?? 0) + cost
      );
    }
  }
  return dp[m]?.[n] ?? 0;
}
