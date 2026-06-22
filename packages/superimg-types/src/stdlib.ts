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
import type * as cue from "@superimg/stdlib/cue";
import type {
  PhaseConfig,
  ScoreOf,
  MotionResult,
  MotionValue,
  mergeMotion,
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
import type { layers, LayerStack } from "@superimg/stdlib/layers";
import type { revealFx } from "@superimg/stdlib/reveal";

/**
 * Standard library available via `ctx.std` in render functions.
 */
export interface Stdlib {
  math: Omit<typeof math, "lerp">;
  color: typeof color;
  text: typeof text;
  date: typeof date;
  /** @core CSS helpers. Presets: fill(), center(), column(), row() */
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
  cue: typeof cue;
  /**
   * @core Scene-local phase choreography. Layer the frame with `std.layers()`;
   * score when things move.
   *
   * ```ts
   * const s = std.score({ enter: "0.6s", hold: "2.2s", exit: "1.2s" });
   * const card = s.motion();
   * ```
   */
  score: <P extends PhaseConfig | undefined = undefined>(phases?: P) => ScoreOf<P>;
  mergeMotion: typeof mergeMotion;
  layers: typeof layers;
  reveal: typeof revealFx;
  backgrounds: typeof backgrounds;
  montage: typeof montage;
  createResponsive: typeof responsive.createResponsive;
  spring: typeof spring;
  clamp01: typeof clamp01;
  stagger: typeof stagger;
  interpolate: typeof interpolate;
  interpolateColor: typeof interpolateColor;
  path: typeof path & { parse: typeof createMotionPath };
  svg: {
    draw: typeof draw;
    filter: typeof filter;
    morph: typeof morph;
    reveal: typeof reveal;
    shape: typeof shape;
    textPath: typeof textPath;
  };
  layout: typeof layout;
  oscillate: typeof oscillate;
  loop: typeof loop;
  pingpong: typeof pingpong;
  wiggle: typeof wiggle;
  viz: typeof viz;
  px: (value: number) => string;
  scale: number;
}

export type { LayerStack };

export type ImageStdlib = Omit<
  Stdlib,
  "score" | "oscillate" | "loop" | "pingpong" | "wiggle" | "montage" | "backgrounds" | "cue" | "mergeMotion" | "reveal"
>;

export type SvgStdlib = ImageStdlib;