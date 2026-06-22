//! Type narrowing tests for Image/Gif/Svg modules
//! These tests verify that type constraints are enforced at compile time.

import type {
  ImageModule, ImageConfig, ImageRenderContext, ImageStdlib,
  GifModule, GifConfig,
  SvgModule, SvgConfig, SvgRenderContext, SvgStdlib,
} from "../index.js";
import { defineImage, defineGif, defineSvg } from "../index.js";

// ============================================================================
// IMAGE TYPE TESTS
// ============================================================================

const imageConfig: ImageConfig = {
  width: 1200,
  height: 630,
  fonts: ["Roboto"],
  outputs: {
    default: { format: "png" },
    thumb: { format: "webp" },
  },
};

// @ts-expect-error duration not allowed in ImageConfig
const imageBad1: ImageConfig = { duration: 5 };

// @ts-expect-error fps not allowed in ImageConfig
const imageBad2: ImageConfig = { fps: 30 };

// @ts-expect-error audio not allowed in ImageConfig
const imageBad3: ImageConfig = { audio: "track.mp3" };

const imageModule: ImageModule = {
  kind: "image",
  config: imageConfig,
  render(ctx: ImageRenderContext) {
    // ImageRenderContext should NOT have temporal properties
    // @ts-expect-error - no ctx.time
    const t = ctx.time;

    // @ts-expect-error - no ctx.globalFrame
    const f = ctx.globalFrame;

    // @ts-expect-error - no ctx.fps
    const fps = ctx.fps;

    // ImageStdlib should NOT have score, oscillate, loop, etc.
    // @ts-expect-error - no score
    const tl = ctx.std.score;

    // @ts-expect-error - no oscillate
    const osc = ctx.std.oscillate;

    // These SHOULD be allowed in ImageStdlib
    const math = ctx.std.math.clamp(0.5, 0, 1);
    const color = ctx.std.color.alpha("#fff", 0.5);
    const responsive = ctx.std.responsive;

    return `<div style="width:${ctx.width}px;height:${ctx.height}px;"/>`;
  },
};

const img = defineImage({
  config: { width: 800, height: 600 },
  render(ctx) {
    // Returned type should be ImageRenderContext
    type C = typeof ctx;
    type HasWidth = C extends { width: number } ? true : false;
    const _: HasWidth = true;

    return "<div/>";
  },
});
const imgKind: "image" = img.kind;

// ============================================================================
// GIF TYPE TESTS
// ============================================================================

const gifConfig: GifConfig = {
  width: 1920,
  height: 1080,
  fps: 15,
  duration: 5,
  gif: {
    loop: 0,
    maxColors: 256,
    dither: "floyd-steinberg",
  },
};

// @ts-expect-error audio not allowed in GifConfig
const gifBad1: GifConfig = { audio: "track.mp3" };

// @ts-expect-error mode not allowed in GifConfig
const gifBad2: GifConfig = { mode: "animation" };

// @ts-expect-error thumbnailAt not allowed in GifConfig
const gifBad3: GifConfig = { thumbnailAt: 0.5 };

const gifModule: GifModule = {
  kind: "gif",
  config: gifConfig,
  render(ctx) {
    // GifModule uses full RenderContext, so temporal properties ARE allowed
    const frame = ctx.globalFrame;
    const time = ctx.globalTimeSeconds;
    const fps = ctx.fps;

    // But GIF should use score (video context)
    const tl = ctx.std.score({ hold: "3s", exit: "1s" });

    return `<div>${frame}</div>`;
  },
};

const gif = defineGif({
  config: { width: 1280, height: 720, fps: 12 },
  render(ctx) {
    // Full RenderContext, temporal features available
    type HasFrame = typeof ctx extends { globalFrame: number } ? true : false;
    const _: HasFrame = true;
    return "<div/>";
  },
});
const gifKind: "gif" = gif.kind;

// ============================================================================
// SVG TYPE TESTS
// ============================================================================

const svgConfig: SvgConfig = {
  width: 800,
  height: 400,
  duration: 2,
  fonts: ["Roboto"],
  outputs: {
    default: { width: 800, height: 400 },
  },
};

// @ts-expect-error duration should be a number, not Duration
const svgBad1: SvgConfig = { duration: "2s" };

// @ts-expect-error fps not allowed in SvgConfig
const svgBad2: SvgConfig = { fps: 30 };

// @ts-expect-error audio not allowed in SvgConfig
const svgBad3: SvgConfig = { audio: "track.mp3" };

const svgModule: SvgModule = {
  kind: "svg",
  config: svgConfig,
  render(ctx: SvgRenderContext) {
    // SvgRenderContext has duration but NOT temporal context
    const duration = ctx.duration;

    // @ts-expect-error - no ctx.globalFrame
    const frame = ctx.globalFrame;

    // @ts-expect-error - no ctx.fps
    const fps = ctx.fps;

    // SvgStdlib should NOT have score, oscillate, etc.
    // @ts-expect-error - no score
    const tl = ctx.std.score;

    // But CAN have viz (for math visualization)
    const coords = ctx.std.viz.createCoords({
      width: ctx.width,
      height: ctx.height,
    });

    // render() should return SVG markup
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${ctx.width}" height="${ctx.height}"/>`;
  },
};

const svg = defineSvg({
  config: { width: 600, height: 600, duration: 3 },
  render(ctx) {
    // Returned type should be SvgRenderContext
    type C = typeof ctx;
    type HasDuration = C extends { duration?: number } ? true : false;
    const _: HasDuration = true;

    return "<svg/>";
  },
});
const svgKind: "svg" = svg.kind;

// ============================================================================
// STDLIB TESTS
// ============================================================================

// ImageStdlib should be a subset of full Stdlib
const imageStdlibTest: ImageStdlib = {
  math: {} as any,
  color: {} as any,
  text: {} as any,
  css: {} as any,
  // Missing: timeline, oscillate, loop, pingpong, wiggle, montage, backgrounds, cue, compose
} as any;

// SvgStdlib should equal ImageStdlib
const svgStdlibTest: SvgStdlib = imageStdlibTest;

export const typesVerified = true;
