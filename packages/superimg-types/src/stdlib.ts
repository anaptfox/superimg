//! Stdlib type definitions for template authors

import type * as math from "@superimg/stdlib/math";
import type * as color from "@superimg/stdlib/color";
import type * as text from "@superimg/stdlib/text";
import type * as date from "@superimg/stdlib/date";
import type { css, fill, center, stack, row } from "@superimg/stdlib/css";
import type { tween } from "@superimg/stdlib/tween";
import type * as responsive from "@superimg/stdlib/responsive";
import type * as subtitle from "@superimg/stdlib/subtitle";
import type * as presets from "@superimg/stdlib/presets";
import type * as code from "@superimg/stdlib/code";
import type {
  timeline,
  transcript,
  fromElevenLabs,
  fromWhisper,
  markers,
  script,
} from "@superimg/stdlib/timeline";
import type * as motion from "@superimg/stdlib/motion";
import type * as phases from "@superimg/stdlib/phases";
import type * as backgrounds from "@superimg/stdlib/backgrounds";
import type { montage } from "@superimg/stdlib/montage";
import type { spring, springTween, createSpring } from "@superimg/stdlib/spring";
import type { stagger } from "@superimg/stdlib/stagger";
import type { interpolate, interpolateColor } from "@superimg/stdlib/interpolate";
import type { path, createMotionPath } from "@superimg/stdlib/path";
import type { draw, filter, morph, reveal, shape, textPath } from "@superimg/stdlib/svg";

/**
 * Standard library available via `ctx.std` in render functions.
 *
 * @example
 * ```typescript
 * import { defineScene } from 'superimg';
 *
 * export default defineScene({
 *   render(ctx) {
 *     const { std, sceneProgress } = ctx;
 *     const x = std.tween(0, 1920, sceneProgress, 'easeOutCubic');
 *     const bg = std.color.alpha('#FF0000', 0.5);
 *     return `<div style="left: ${x}px; background: ${bg}">Hello</div>`;
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
  /** @core Tween: eased interpolation. std.tween(from, to, progress, easing?) */
  tween: typeof tween;
  /** @extended Responsive layout helper based on canvas aspect ratio */
  responsive: typeof responsive;
  /** @extended Subtitle parsing and display for SRT/VTT formats */
  subtitle: typeof subtitle;
  /** @extended Platform presets for social media dimensions (instagram, youtube, tiktok, etc.) */
  presets: typeof presets;
  /** @extended Syntax highlighting for code blocks (Shiki-powered) */
  code: typeof code;
  /** @core Declarative timing: std.timeline(time, duration), transcript(), markers(), script() */
  timeline: typeof timeline & {
    transcript: typeof transcript;
    fromElevenLabs: typeof fromElevenLabs;
    fromWhisper: typeof fromWhisper;
    markers: typeof markers;
    script: typeof script;
  };
  /** @core Motion helpers: enter(), exit(), enterExit() for fade+slide animations */
  motion: typeof motion;
  /** @core Phase splitting: std.phases(progress, { enter: 1, hold: 2, exit: 1 }) */
  phases: typeof phases.phases;
  /** @core Ken Burns background effects: std.backgrounds.kenBurns({ src, progress }) */
  backgrounds: typeof backgrounds;
  /** @core Image montage with crossfades: std.montage({ images, progress }) */
  montage: typeof montage;
  /** @core Factory for responsive sizing: const r = std.createResponsive(ctx) */
  createResponsive: typeof responsive.createResponsive;
  /** @core Spring curve: std.spring(progress, config?) returns 0→1 with overshoot */
  spring: typeof spring;
  /** @core Spring interpolation: std.springTween(from, to, progress, config?) */
  springTween: typeof springTween;
  /** @core Create spring easing for tween(): std.createSpring({ stiffness: 200, damping: 8 }) */
  createSpring: typeof createSpring;
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
}

