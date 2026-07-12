//! Stdlib type definitions for template authors

import type * as math from "@superimg/stdlib/math";
import type * as color from "@superimg/stdlib/color";
import type * as text from "@superimg/stdlib/text";
import type * as date from "@superimg/stdlib/date";
import type { css, fill, center, column, row } from "@superimg/stdlib/css";
import type * as responsive from "@superimg/stdlib/responsive";
import type * as subtitle from "@superimg/stdlib/subtitle";
import type * as presets from "@superimg/stdlib/presets";
import type * as code from "@superimg/stdlib/code";
import type {
  MotionResult,
  MotionValue,
  mergeMotion,
} from "@superimg/stdlib/director";
import type { carousel, Carousel, CarouselOpts, CarouselItemState } from "@superimg/stdlib/carousel";
import type { stack, Stack, StackOpts, StackItemState } from "@superimg/stdlib/stack";
import type { layoutTimeline, LayoutTimelineResult } from "@superimg/stdlib/layout-timeline";
import type * as backgrounds from "@superimg/stdlib/backgrounds";
import type { montage } from "@superimg/stdlib/montage";
import type { spring } from "@superimg/stdlib/spring";
import type { clamp01 } from "@superimg/stdlib/easing";
import type { stagger } from "@superimg/stdlib/stagger";
import type { interpolate, interpolateColor } from "@superimg/stdlib/interpolate";
import type { path, createMotionPath } from "@superimg/stdlib/path";
import type { timing } from "@superimg/stdlib/timing";
import type { phases } from "@superimg/stdlib/phase-recipes";
import type { motion } from "@superimg/stdlib/motion-presets";
import type { getSafeArea, getSafeBox } from "@superimg/stdlib/safe-area";
import type {
  draw,
  filter,
  morph,
  shape,
  textPath,
  bezier,
  gradient as svgGradient,
  measureText,
  wrapText,
  fitText,
} from "@superimg/stdlib/svg";

import type * as layout from "@superimg/stdlib/layout";
import type { oscillate, loop, pingpong, wiggle } from "@superimg/stdlib/oscillate";
import type * as viz from "@superimg/stdlib/viz";
import type { layers, LayerStack } from "@superimg/stdlib/layers";
import type { revealFx } from "@superimg/stdlib/reveal";
import type { ready } from "@superimg/stdlib/ready";
import type { sync as videoSync, ClipSyncOptions, ClipSyncResult } from "@superimg/stdlib/video";
import type {
  MediaVideoOptions,
  MediaVideoResult,
  MediaYoutubeOptions,
  MediaYoutubeResult,
} from "@superimg/stdlib/media";

/**
 * Standard library available via `ctx.std` in render functions.
 * Phase choreography lives on `ctx.director()`, not std.
 */
export interface Stdlib {
  math: Omit<typeof math, "lerp">;
  color: typeof color;
  text: typeof text;
  date: typeof date;
  css: typeof css & {
    fill: typeof fill;
    center: typeof center;
    column: typeof column;
    row: typeof row;
  };
  responsive: typeof responsive;
  subtitle: typeof subtitle;
  presets: typeof presets;
  code: typeof code;
  carousel: typeof carousel;
  stack: typeof stack;
  /** Pure seconds → percent phases + total. Same call in resolve() and render(). */
  layoutTimeline: typeof layoutTimeline;
  video: {
    sync: (opts: ClipSyncOptions) => ClipSyncResult;
  };
  media: {
    video: (opts: MediaVideoOptions) => MediaVideoResult;
    youtube: (opts: MediaYoutubeOptions) => MediaYoutubeResult;
  };
  mergeMotion: typeof mergeMotion;
  layers: typeof layers;
  reveal: typeof revealFx;
  backgrounds: typeof backgrounds;
  montage: typeof montage;
  createResponsive: typeof responsive.createResponsive;
  spring: typeof spring;
  clamp01: typeof clamp01;
  stagger: typeof stagger;
  /** Craft timing: readTime, sceneDuration, msToFraction, … */
  timing: typeof timing;
  /** Named phase recipes + fromText → layoutTimeline */
  phases: typeof phases;
  /** Tone styles: motion.style("premium") */
  motion: typeof motion;
  /** Safe-area insets (broadcast / social / title / …) */
  safeArea: typeof getSafeArea;
  safeBox: typeof getSafeBox;
  interpolate: typeof interpolate;
  interpolateColor: typeof interpolateColor;
  path: typeof path & { parse: typeof createMotionPath };
  svg: {
    draw: typeof draw;
    drawMany: typeof import("@superimg/stdlib/svg").drawMany;
    filter: typeof filter;
    morph: typeof morph;
    arcPoint: typeof import("@superimg/stdlib/svg").arcPoint;
    shape: typeof shape;
    textPath: typeof textPath;
    bezier: typeof bezier;
    gradient: typeof svgGradient;
    measureText: typeof measureText;
    wrapText: typeof wrapText;
    fitText: typeof fitText;
    rough: typeof import("@superimg/stdlib/svg").rough;
  };
  layout: typeof layout;
  oscillate: typeof oscillate;
  loop: typeof loop;
  pingpong: typeof pingpong;
  wiggle: typeof wiggle;
  viz: typeof viz;
  /**
   * Capture readiness string helpers (Playwright). Pure builders — prefer over
   * teaching `window.__superimgReady`. Most templates need neither (fonts+images auto).
   */
  ready: typeof ready;
  px: (value: number) => string;
  scale: number;
}

export type {
  Carousel,
  CarouselOpts,
  CarouselItemState,
  Stack,
  StackOpts,
  StackItemState,
  LayoutTimelineResult,
  LayerStack,
};

export type ImageStdlib = Omit<
  Stdlib,
  "video" | "oscillate" | "loop" | "pingpong" | "wiggle" | "montage" | "backgrounds" | "mergeMotion" | "reveal" | "carousel" | "stack"
  | "media"
>;

export type SvgStdlib = ImageStdlib;

export type SvgAnimatedStdlib = ImageStdlib &
  Pick<
    Stdlib,
    "video" | "media" | "oscillate" | "loop" | "pingpong" | "wiggle" | "mergeMotion" | "carousel" | "stack"
  >;
