//! Pure TypeScript implementations (no WASM)

import type {
  RenderContext,
  AssetMeta,
  ImageRenderContext,
  SvgRenderContext,
  ImageStdlib,
  SvgStdlib,
} from "@superimg/types";
import { stdlib } from "../shared/stdlib.js";
import { createScore } from "@superimg/stdlib/score";
import type { PhaseConfig } from "@superimg/stdlib/score";

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

function createStaticStdlib(scale: number): ImageStdlib {
  const {
    backgrounds: _backgrounds,
    montage: _montage,
    cue: _cue,
    compose: _compose,
    oscillate: _oscillate,
    loop: _loop,
    pingpong: _pingpong,
    wiggle: _wiggle,
    ...still
  } = stdlib;

  return {
    ...still,
    px: (value: number) => `${value * scale}px`,
    scale,
  } as ImageStdlib;
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
    // Standard library (augmented with per-render scale helpers + score).
    std: {
      ...stdlib,
      px: (value: number) => `${value * scale}px`,
      scale,
      score: <P extends PhaseConfig | undefined = undefined>(phases?: P) =>
        createScore(
          { sceneProgress: progress, sceneTimeSeconds: timeSeconds, sceneDurationSeconds: durationSeconds },
          phases,
        ),
    },

    // Global position
    globalFrame: frame,
    globalTimeSeconds: timeSeconds,
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

export interface StaticContextOptions {
  data?: Record<string, unknown>;
  outputName?: string;
  assets?: Record<string, AssetMeta>;
  assetResolver?: (filename: string) => string;
  designWidth?: number;
}

export function createImageRenderContext(
  width: number,
  height: number,
  options: StaticContextOptions = {}
): ImageRenderContext {
  const { aspectRatio, isPortrait, isLandscape, isSquare } =
    computeOrientationFlags(width, height);
  const outputName = options.outputName ?? "default";
  const scale = options.designWidth ? width / options.designWidth : 1;

  return {
    std: createStaticStdlib(scale),
    width,
    height,
    aspectRatio,
    isPortrait,
    isLandscape,
    isSquare,
    data: options.data ?? {},
    assets: options.assets ?? {},
    asset: options.assetResolver ?? ((filename) => filename),
    output: {
      name: outputName,
      width,
      height,
      fit: "stretch",
    },
  };
}

export interface SvgContextOptions extends StaticContextOptions {
  duration?: number;
}

export function createSvgRenderContext(
  width: number,
  height: number,
  options: SvgContextOptions = {}
): SvgRenderContext {
  const base = createImageRenderContext(width, height, options);
  return {
    ...base,
    std: base.std as SvgStdlib,
    duration: options.duration,
  };
}
