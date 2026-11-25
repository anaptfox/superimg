//! Pure TypeScript implementations (no WASM)

import type {
  RenderContext,
  AssetMeta,
  ImageRenderContext,
  SvgRenderContext,
  ImageStdlib,
  SvgStdlib,
  JsonObject,
} from "@superimg/types";
import { createStaticStdlib as createBaseStdlib, type StaticStdlib } from "../shared/stdlib.js";
import { bindStdTiming } from "../shared/bind-std-timing.js";
import { createTimeline } from "../shared/create-timeline.js";
import { createDirector, type DirectorContext, type DirectorInstrument } from "@superimg/stdlib/director";
import { createTrack, type TrackInstrument } from "@superimg/stdlib/track";
import type { TrackSource } from "@superimg/types";
import type { IrInstrumentSink } from "../ir/instrument.js";

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

function createImageStdlib(baseStdlib: StaticStdlib, scale: number): ImageStdlib {
  const {
    backgrounds: _backgrounds,
    montage: _montage,
    oscillate: _oscillate,
    loop: _loop,
    pingpong: _pingpong,
    wiggle: _wiggle,
    ...still
  } = baseStdlib;

  return {
    ...still,
    px: (value: number) => `${value * scale}px`,
    scale,
  } as ImageStdlib;
}

export interface CreateRenderContextOptions {
  data?: Record<string, unknown>;
  assets?: Record<string, AssetMeta>;
  assetResolver?: (filename: string) => string;
  designWidth?: number;
  /** Internal IR instrumentation (not author-facing). */
  instrument?: IrInstrumentSink;
  sceneId?: string;
  sceneIndex?: number;
  sceneStartFrame?: number;
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
  assets: Record<string, AssetMeta> = {},
  assetResolver?: (filename: string) => string,
  designWidth?: number,
  instrument?: IrInstrumentSink,
  sceneMeta?: { sceneId?: string; sceneIndex?: number; sceneStartFrame?: number },
  baseStdlib: StaticStdlib = createBaseStdlib(),
): RenderContext {
  const timeline = createTimeline(frame, fps, totalFrames);
  const timeSeconds = timeline.seconds;
  const { aspectRatio, isPortrait, isLandscape, isSquare } =
    computeOrientationFlags(width, height);

  const scale = designWidth ? width / designWidth : 1;
  const sceneId = sceneMeta?.sceneId ?? instrument?.sceneId ?? "default";
  const sceneStartFrame = sceneMeta?.sceneStartFrame ?? instrument?.sceneStartFrame ?? 0;

  const directorInstrument: DirectorInstrument | undefined = instrument
    ? {
        strictIds: instrument.strictIds === true,
        sceneId,
        frame,
        sceneStartFrame,
        totalFrames,
        ...(instrument.onDirector ? { onDirector: instrument.onDirector } : {}),
        ...(instrument.onMotion ? { onMotion: instrument.onMotion } : {}),
        ...(instrument.onIssue ? { onIssue: instrument.onIssue } : {}),
      }
    : undefined;

  const trackInstrument: TrackInstrument | undefined = instrument
    ? {
        strictIds: instrument.strictIds === true,
        sceneId,
        frame,
        sceneStartFrame,
        totalFrames,
        ...(instrument.onTrack ? { onTrack: instrument.onTrack } : {}),
        ...(instrument.onIssue ? { onIssue: instrument.onIssue } : {}),
      }
    : undefined;

  const directorCtx: DirectorContext = {
    timeline,
    fps,
    ...(directorInstrument ? { instrument: directorInstrument } : {}),
  };
  const timedStdlib = bindStdTiming(
    baseStdlib,
    {
      fps,
      frame,
      totalFrames,
      progress: timeline.progress,
      timeSeconds: timeline.seconds,
      durationSeconds: timeline.durationSeconds,
    },
    scale,
    instrument,
  );

  return {
    std: timedStdlib,

    timeline,
    director: (phases, opts) => createDirector(directorCtx, phases, opts),
    track: (source: TrackSource) => createTrack(timeline, source, trackInstrument),

    // Global position
    globalFrame: frame,
    globalTimeSeconds: timeSeconds,
    totalFrames,
    totalDurationSeconds: timeline.durationSeconds,

    // Scene metadata
    sceneIndex: sceneMeta?.sceneIndex ?? 0,
    sceneId,

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

    // Data
    data: data as JsonObject,

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
  const scale = options.designWidth ? width / options.designWidth : 1;

  return {
    std: createImageStdlib(createBaseStdlib(), scale),
    width,
    height,
    aspectRatio,
    isPortrait,
    isLandscape,
    isSquare,
    data: (options.data ?? {}) as JsonObject,
    assets: options.assets ?? {},
    asset: options.assetResolver ?? ((filename) => filename),
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
