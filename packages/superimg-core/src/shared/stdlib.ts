//! Shared stdlib construction - used by wasm.ts and other runtime code
//! The static members live in `stdlib`; ctx-scoped members (`score`, `px`,
//! `scale`) are appended per-frame inside createRenderContext.

import type { Stdlib } from "@superimg/types";
import * as math from "@superimg/stdlib/math";
import * as color from "@superimg/stdlib/color";
import * as text from "@superimg/stdlib/text";
import * as date from "@superimg/stdlib/date";
import { css, fill, center, stack, row } from "@superimg/stdlib/css";
import * as responsive from "@superimg/stdlib/responsive";
import * as subtitle from "@superimg/stdlib/subtitle";
import * as presets from "@superimg/stdlib/presets";
import * as code from "@superimg/stdlib/code";
import * as cue from "@superimg/stdlib/cue";
import * as backgrounds from "@superimg/stdlib/backgrounds";
import { montage } from "@superimg/stdlib/montage";
import { spring } from "@superimg/stdlib/spring";
import { clamp01 } from "@superimg/stdlib/easing";
import { stagger } from "@superimg/stdlib/stagger";
import { interpolate, interpolateColor } from "@superimg/stdlib/interpolate";
import { path, createMotionPath } from "@superimg/stdlib/path";
import { draw, filter, morph, reveal, shape, textPath } from "@superimg/stdlib/svg";
import * as layout from "@superimg/stdlib/layout";

const mathWithoutLerp = Object.fromEntries(
  Object.entries(math).filter(([key]) => key !== "lerp")
) as Omit<typeof math, "lerp">;

/** Per-frame parts bound by createRenderContext: score, px, scale. */
export type StaticStdlib = Omit<Stdlib, "score" | "px" | "scale">;

export const stdlib: StaticStdlib = {
  math: mathWithoutLerp,
  color,
  text,
  date,
  css: Object.assign(css, { fill, center, stack, row }),
  responsive,
  subtitle,
  presets,
  code,
  cue,
  backgrounds,
  montage,
  createResponsive: responsive.createResponsive,
  spring,
  clamp01,
  stagger,
  interpolate,
  interpolateColor,
  path: Object.assign(path, { parse: createMotionPath }),
  svg: { draw, filter, morph, reveal, shape, textPath },
  layout,
};
