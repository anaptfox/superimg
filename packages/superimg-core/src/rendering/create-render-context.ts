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
import { bindStdTiming } from "../shared/bind-std-timing.js";
import { createTimeline } from "../shared/create-timeline.js";
import { createDirector, type DirectorContext } from "@superimg/stdlib/director";
import { createTrack } from "@superimg/stdlib/track";
import type { TrackSource } from "@superimg/types";

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
  const timeline = createTimeline(frame, fps, totalFrames);
  const timeSeconds = timeline.seconds;
  const { aspectRatio, isPortrait, isLandscape, isSquare } =
    computeOrientationFlags(width, height);

  const scale = designWidth ? width / designWidth : 1;

  const directorCtx: DirectorContext = { timeline, fps };

  return {
    std: bindStdTiming(
      stdlib,
      {
        fps,
        frame,
        totalFrames,
        progress: timeline,         timeSeconds: timeline,         durationSeconds: timeline.durationSeconds,
      },
      scale,
    ),

    timeline,
    director: (phases) => createDirector(directorCtx, phases),
    track: (source: TrackSource) => createTrack(timeline, source),

    // Global position
    globalFrame: frame,
    globalTimeSeconds: timeSeconds,
    totalFrames,
    totalDurationSeconds: timeline.durationSeconds,

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
    ...(options.duration !== undefined ? { duration: options.duration } : {}),
  };
}
