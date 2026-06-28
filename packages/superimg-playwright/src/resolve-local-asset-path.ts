//! Resolve asset src strings to local absolute file paths.

/**
 * Extract a local absolute file path from an asset src.
 * Handles:
 *  1. localhost asset URL: http://localhost:PORT/assets?path=<encodedAbsolutePath>
 *  2. Already an absolute path: /path/to/file.mp4
 */
export function resolveLocalAssetPath(src: string): string | null {
  try {
    const url = new URL(src);
    if (url.hostname === "localhost" || url.hostname === "127.0.0.1") {
      return url.searchParams.get("path");
    }
    return null;
  } catch {
    return src.startsWith("/") ? src : null;
  }
}