//! Pure TypeScript implementations (no WASM)

import type { RenderContext, AssetMeta } from "@superimg/types";
import { stdlib } from "../shared/stdlib.js";

/**
 * Compute orientation flags from dimensions
 */
function computeOrientationFlags(width: number, height: number) {
  const aspectRatio = width / height;
  const isPortrait = aspectRatio < 1.0;
  const isLandscape = aspectRatio > 1.0;
  const isSquare = aspectRatio > 0.9 && aspectRatio < 1.1;
  return { aspectRatio, isPortrait, isLandscape, isSquare };
}

/**
 * Create a RenderContext from parameters
 */
export function createRenderContext(
  frame: number,
  fps: number,
  totalFrames: number,
  width: number,
  height: number,
  data: Record<string, unknown> = {},
  outputName: string = "default",
  assets: Record<string, AssetMeta> = {},
  assetResolver?: (filename: string) => string,
  designWidth?: number
): RenderContext {
  const timeSeconds = frame / fps;
  const progress =
    totalFrames > 1
      ? Math.min(frame / (totalFrames - 1), 1.0)
      : totalFrames === 1
        ? 1.0
        : 0.0;
  const durationSeconds = totalFrames / fps;
  const { aspectRatio, isPortrait, isLandscape, isSquare } =
    computeOrientationFlags(width, height);

  const scale = designWidth ? width / designWidth : 1;

  return {
    // Standard library (augmented with per-render scale helpers)
    std: {
      ...stdlib,
      px: (value: number) => `${value * scale}px`,
      scale,
    },

    // Global position
    globalFrame: frame,
    globalTimeSeconds: timeSeconds,
    globalProgress: progress,
    totalFrames,
    totalDurationSeconds: durationSeconds,

    // Scene position (equals global for single-template)
    sceneFrame: frame,
    sceneTimeSeconds: timeSeconds,
    sceneProgress: progress,
    sceneTotalFrames: totalFrames,
    sceneDurationSeconds: durationSeconds,

    // Scene metadata
    sceneIndex: 0,
    sceneId: "default",

    // Video info
    fps,
    isFinite: true,

    // Dimensions
    width,
    height,
    aspectRatio,
    isPortrait,
    isLandscape,
    isSquare,

    // Output info
    output: {
      name: outputName,
      width,
      height,
      fit: "stretch",
    },

    // Data
    data,

    // Assets
    assets,

    // Asset resolver
    asset: assetResolver ?? ((filename) => filename),

    // CSS viewport
    cssViewport: {
      width,
      height,
      devicePixelRatio: 1,
    },
  };
}
