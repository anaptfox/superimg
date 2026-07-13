//! Resolve asset src strings to local absolute file paths.

import { isAbsolute } from "node:path";

/** Accept direct local paths. Opaque HTTP asset URLs are resolved by the owning registry. */
export function resolveLocalAssetPath(src: string): string | null {
  return isAbsolute(src) ? src : null;
}
