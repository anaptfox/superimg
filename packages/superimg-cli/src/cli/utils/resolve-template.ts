//! Smart template path resolution for CLI commands
//!
//! Resolves bare names through *.video.ts convention:
//!   superimg dev intro        -> videos/intro.video.ts or project-wide search
//!   superimg dev intro.video.ts -> explicit or videos/intro.video.ts
//!   superimg dev ./path.video.ts -> explicit path

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
 * 1. videos/ convention (standalone .video.ts or folder with index.video.ts)
 * 2. Project-wide fallback via discoverVideos
 */
export function resolveTemplatePath(input: string, cwd = process.cwd()): string {
  const trimmed = input.trim();
  if (!trimmed) {
    throw new ValidationError({
      field: "template",
      expectedType: "non-empty path or video name",
      receivedValue: input,
      suggestion: "Pass a video name (e.g. `superimg dev intro`) or a path (e.g. `./videos/intro.video.ts`).",
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
    if (!resolved.endsWith(".video.ts") && !resolved.endsWith(".video.js")) {
      throw new ValidationError({
        field: "template",
        expectedType: ".video.ts or .video.js file",
        receivedValue: trimmed,
        suggestion: "Rename the file to end in `.video.ts` (or `.video.js`).",
      });
    }
    return resolved;
  }

  // Bare name: strip .video.ts / .video.js if present
  const baseName = trimmed
    .replace(/\.video\.ts$/, "")
    .replace(/\.video\.js$/, "")
    .replace(/\.ts$/, "")
    .replace(/\.js$/, "");

  const projectRoot = findProjectRoot(cwd);
  const videosDir = join(projectRoot, "videos");

  // 1. videos/ convention
  const candidates = [
    join(videosDir, `${baseName}.video.ts`),
    join(videosDir, `${baseName}.video.js`),
    join(videosDir, baseName, "index.video.ts"),
    join(videosDir, baseName, "index.video.js"),
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

  // Try short name match first (e.g. "hello-world" matches hello-world/hello-world.video.ts)
  const shortMatches = videos.filter((v) => v.shortName === baseName);
  if (shortMatches.length === 1) {
    return shortMatches[0].entrypoint;
  }
  if (shortMatches.length > 1) {
    throw new ValidationError({
      field: "template",
      expectedType: "unambiguous video name",
      receivedValue: baseName,
      suggestion: `Found ${shortMatches.length} matches:\n${shortMatches.map((v) => `  - ${v.relativePath}`).join("\n")}\nUse an explicit path (e.g. ./${shortMatches[0].relativePath}).`,
    });
  }

  // Fallback to full name match
  const fullMatches = videos.filter((v) => v.name === baseName);
  if (fullMatches.length > 1) {
    throw new ValidationError({
      field: "template",
      expectedType: "unambiguous video name",
      receivedValue: baseName,
      suggestion: `Found ${fullMatches.length} matches:\n${fullMatches.map((v) => `  - ${v.relativePath}`).join("\n")}\nUse an explicit path (e.g. ./${fullMatches[0].relativePath}).`,
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
    hint = "No *.video.ts files found in this project. Run `superimg init` to create one.";
  }

  throw new IOError({
    operation: "read",
    path: trimmed,
    originalError: `Video not found. Tried videos/${baseName}.video.ts, videos/${baseName}/index.video.ts, and project-wide search. ${hint}`,
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
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + cost
      );
    }
  }
  return dp[m][n];
}
