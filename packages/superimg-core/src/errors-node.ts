//! Node-only error helpers. Imports node:fs — must NOT be pulled into browser bundles.
//!
//! Pair with `@superimg/core/errors` for browser-safe primitives.

import { readFileSync } from "node:fs";

/**
 * Read source text from disk for a stack-frame file path.
 *
 * Wraps `fs.readFileSync` with try/catch so the caller can populate a
 * sourceCache without worrying about missing files (deleted between bundle
 * and error, virtual paths, etc.).
 */
export function readSourceForFrame(file: string): string | null {
  try {
    return readFileSync(file, "utf-8");
  } catch {
    return null;
  }
}

/**
 * Build a Map of file path → source text from a list of paths.
 * Used to seed `EnrichContext.sourceCache` when the sourcemap lacks
 * `sourcesContent` (rare with esbuild — it embeds by default).
 */
export function buildSourceCache(files: readonly string[]): Map<string, string> {
  const cache = new Map<string, string>();
  for (const file of files) {
    const src = readSourceForFrame(file);
    if (src != null) cache.set(file, src);
  }
  return cache;
}
