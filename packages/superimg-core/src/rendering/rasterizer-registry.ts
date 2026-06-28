//! Selects a Rasterizer by medium.
//!
//! Prefers a browser-free rasterizer (resvg) when one accepts the medium;
//! otherwise uses the host-provided HTML rasterizer factory (Playwright,
//! supplied by the node CLI — omitted at the edge where only SVG renders).

import type { Medium, Rasterizer } from "@superimg/types";
import { ResvgRasterizer } from "./resvg-rasterizer.js";

export interface RasterizerRegistryOptions {
  /** Factory for the HTML rasterizer (Playwright). Node-only; absent at the edge. */
  htmlRasterizer?: () => Rasterizer;
  /** Override the SVG rasterizer factory (defaults to ResvgRasterizer). */
  svgRasterizer?: () => Rasterizer;
}

/**
 * Resolve the rasterizer for a given medium. Throws if the medium has no
 * registered rasterizer (e.g. requesting "html" at the edge).
 */
export function selectRasterizer(
  medium: Medium,
  opts: RasterizerRegistryOptions = {},
): Rasterizer {
  if (medium === "svg") {
    return (opts.svgRasterizer ?? (() => new ResvgRasterizer()))();
  }
  if (!opts.htmlRasterizer) {
    throw new Error(
      `No rasterizer registered for medium "html". ` +
        `Provide htmlRasterizer (Playwright) — it is unavailable at the edge.`,
    );
  }
  return opts.htmlRasterizer();
}
