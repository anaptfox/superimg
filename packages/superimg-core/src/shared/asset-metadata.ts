//! Asset metadata loading - orchestrates loading via a pluggable loader
//! The actual extraction runs in the renderer's context (e.g. browser via Playwright)

import type { AssetMeta, FrozenAssetMetadata } from "@superimg/types";
import type { ResolvedAssetDeclaration } from "./assets.js";

export type { ResolvedAssetDeclaration };

/** Project a frozen resource into the author-facing `ctx.assets` contract. */
export function assetMetadataFromFrozen(metadata: FrozenAssetMetadata, url: string): AssetMeta {
  const common = { url, mimeType: metadata.mimeType, size: metadata.byteLength };
  if (metadata.kind === "video") return { ...common, type: "video", width: 0, height: 0, duration: 0 };
  if (metadata.kind === "audio") return { ...common, type: "audio", duration: 0 };
  return { ...common, type: "image", width: 0, height: 0 };
}

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
