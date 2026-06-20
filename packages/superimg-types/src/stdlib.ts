//! Stdlib type definitions for template authors

import type * as math from "@superimg/stdlib/math";
import type * as color from "@superimg/stdlib/color";
import type * as text from "@superimg/stdlib/text";
import type * as date from "@superimg/stdlib/date";
import type { css, fill, center, stack, row } from "@superimg/stdlib/css";
import type * as responsive from "@superimg/stdlib/responsive";
import type * as subtitle from "@superimg/stdlib/subtitle";
import type * as presets from "@superimg/stdlib/presets";
import type * as code from "@superimg/stdlib/code";
import type * as cue from "@superimg/stdlib/cue";
import type {
  PhaseConfig,
  TimelineOf,
  MotionResult,
  MotionValue,
  compose,
} from "@superimg/stdlib/score";
import type * as backgrounds from "@superimg/stdlib/backgrounds";
import type { montage } from "@superimg/stdlib/montage";
import type { spring } from "@superimg/stdlib/spring";
import type { clamp01 } from "@superimg/stdlib/easing";
import type { stagger } from "@superimg/stdlib/stagger";
import type { interpolate, interpolateColor } from "@superimg/stdlib/interpolate";
import type { path, createMotionPath } from "@superimg/stdlib/path";
import type { draw, filter, morph, reveal, shape, textPath } from "@superimg/stdlib/svg";
import type * as layout from "@superimg/stdlib/layout";
import type { oscillate, loop, pingpong, wiggle } from "@superimg/stdlib/oscillate";
import type * as viz from "@superimg/stdlib/viz";

/**
 * Standard library available via `ctx.std` in render functions.
 *
 * @example
 * ```typescript
 * import { defineScene } from 'superimg';
 *
 * export default defineScene({
 *   render(ctx) {
 *     const { std } = ctx;
 *     const t = std.score();
 *     const card = t.motion({ y: 30 });
 *     const bg = std.color.alpha('#667eea', 0.8 * card.opacity);
 *     return `<div style="${card.style}; background: ${bg}">Hello</div>`;
 *   },
 * });
 * ```
 */
export interface Stdlib {
  /** @core Math utilities (no lerp on ctx.std). Start here: clamp, map, inverseLerp, mapClamp, random */
  math: Omit<typeof math, "lerp">;
  /** @core Color manipulation. Start here: alpha, mix, lighten, darken, hexToRgb */
  color: typeof color;
  /** @extended Text formatting (truncate, pluralize, formatNumber, escapeHtml) */
  text: typeof text;
  /** @extended Date formatting and manipulation (formatDate, relativeTime, parseISO) */
  date: typeof date;
  /** @core CSS style helpers. Callable: std.css({ width: 100 }, std.css.center()). Presets: std.css.fill(), std.css.center(), std.css.stack(), std.css.row() */
  css: typeof css & {
    fill: typeof fill;
    center: typeof center;
    stack: typeof stack;
    row: typeof row;
  };
  /** @extended Responsive layout helper based on canvas aspect ratio */
  responsive: typeof responsive;
  /** @extended Subtitle parsing and display for SRT/VTT formats */
  subtitle: typeof subtitle;
  /** @extended Platform presets for social media dimensions (instagram, youtube, tiktok, etc.) */
  presets: typeof presets;
  /** @extended Syntax highlighting for code blocks (Shiki-powered) */
  code: typeof code;
  /** @core Absolute-time cue helpers: transcript(), markers(), script(), fromElevenLabs(), fromWhisper() */
  cue: typeof cue;
  /**
   * @core Unified scene-local timing primitive. Pass a phase layout in seconds
   * or percentages; returns an object for declaring motions, tweens, and values
   * scoped to those phases with auto enter + auto exit and stagger.
   *
   * ```ts
   * const t = std.timeline({ enter: "0.6s", hold: "2.2s", exit: "1.2s" });
   * const card = t.motion();                           // auto enter + auto exit
   * const val  = t.motion({ y: 15, at: "0.1s" });      // stagger 0.1s into enter
   * const cnt  = t.tween(0, target, { during: "enter" });
   * const bar  = t.value(value / target, { fadeOn: "exit" });
   * ```
   */
  timeline: <P extends PhaseConfig | undefined = undefined>(phases?: P) => TimelineOf<P>;
  /**
   * @core Merge multiple motion values into a single MotionResult.
   * Last-wins per property; transforms combine into one `transform:` string.
   *
   * ```ts
   * const card = t.motion({ y: 20 });
   * const idle = { scale: std.oscillate(time, { period: "1s", from: 0.98, to: 1.02 }) };
   * return `<div style="${std.css(std.compose(card, idle))}">`;
   * ```
   */
  compose: typeof compose;
  /** @core Ken Burns background effects: std.backgrounds.kenBurns({ src, progress }) */
  backgrounds: typeof backgrounds;
  /** @core Image montage with crossfades: std.montage({ images, progress }) */
  montage: typeof montage;
  /** @core Factory for responsive sizing: const r = std.createResponsive(ctx) */
  createResponsive: typeof responsive.createResponsive;
  /** @core Spring interpolation: std.spring(from, to, progress, config?) */
  spring: typeof spring;
  /** @core Clamp a value into [0, 1]. Shortcut for std.math.clamp(v, 0, 1). */
  clamp01: typeof clamp01;
  /** @core Stagger progress across items: std.stagger(items, progress, opts?) */
  stagger: typeof stagger;
  /** @core Multi-keyframe interpolation: std.interpolate(progress, inputRange, outputRange) */
  interpolate: typeof interpolate;
  /** @core Multi-keyframe color interpolation: std.interpolateColor(progress, inputRange, colors) */
  interpolateColor: typeof interpolateColor;
  /** @core Motion along SVG path: std.path(d, progress) → { x, y, angle, transform } */
  path: typeof path & { parse: typeof createMotionPath };
  /** @core SVG utilities: draw, filter, morph, reveal, shape, textPath */
  svg: {
    draw: typeof draw;
    filter: typeof filter;
    morph: typeof morph;
    reveal: typeof reveal;
    shape: typeof shape;
    textPath: typeof textPath;
  };
  /** @core Box-math layout primitives: std.layout.stack(area, rows, opts?) returns Box[]; std.layout.inset(area, pad) returns Box. No HTML — pair with std.css. */
  layout: typeof layout;
  /** @core Smooth sine oscillation between from/to over a period. `std.oscillate(time, { period: "1s", from: 0.98, to: 1.02 })` */
  oscillate: typeof oscillate;
  /** @core Sawtooth 0→1 that resets each period. `std.loop(time, { period: "2s" })` */
  loop: typeof loop;
  /** @core Triangle 0→1→0 that bounces each period. `std.pingpong(time, { period: "2s" })` */
  pingpong: typeof pingpong;
  /** @core Seeded smooth noise — deterministic. `std.wiggle(time, seed, { freq: 2, amp: 8 })` */
  wiggle: typeof wiggle;
  /** @extended Math visualization: coordinate systems, function plots, vectors, LaTeX, canvas */
  viz: typeof viz;
  /** @core Scale a design-resolution pixel value to the actual render size. Returns CSS string e.g. "60px". Scale = renderWidth / config.width. */
  px: (value: number) => string;
  /** @core Raw scale factor (renderWidth / config.width). Use for JS math (animation offsets), not CSS strings. */
  scale: number;
}

/** Stdlib for still images — temporal primitives removed (timeline, oscillate, loop, etc.). */
export type ImageStdlib = Omit<Stdlib, "timeline" | "oscillate" | "loop" | "pingpong" | "wiggle" | "montage" | "backgrounds" | "cue" | "compose">;

/** Stdlib for SVG templates — same as ImageStdlib; std.svg and std.viz are the value-adds. */
export type SvgStdlib = ImageStdlib;
