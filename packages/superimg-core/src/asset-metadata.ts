//! Asset metadata loading - orchestrates loading via a pluggable loader
//! The actual extraction runs in the renderer's context (e.g. browser via Playwright)

import type { AssetMeta } from "@superimg/types";
import type { ResolvedAssetDeclaration } from "./assets.js";

export type { ResolvedAssetDeclaration };

/**
 * Loader function - extracts metadata for a single asset.
 * Implemented by the renderer (e.g. Playwright runs this in browser via page.evaluate).
 */
export type AssetMetadataLoader = (
  decl: ResolvedAssetDeclaration
) => Promise<AssetMeta>;

/**
 * Load all assets in parallel via the provided loader.
 * Returns metadata map for ctx.assets.
 *
 * The loader typically runs in a browser context (e.g. Playwright page.evaluate)
 * to extract dimensions, duration, size, and mimeType.
 */
export async function loadAllAssets(
  declarations: ResolvedAssetDeclaration[],
  loader: AssetMetadataLoader
): Promise<Record<string, AssetMeta>> {
  if (declarations.length === 0) return {};

  const results = await Promise.all(
    declarations.map(async (decl) => ({
      key: decl.key,
      meta: await loader(decl),
    }))
  );

  return Object.fromEntries(results.map(({ key, meta }) => [key, meta]));
}
