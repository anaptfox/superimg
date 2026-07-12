//! Shared stdlib construction - used by create-render-context and other runtime code

import type { Stdlib } from "@superimg/types";
import * as math from "@superimg/stdlib/math";
import * as color from "@superimg/stdlib/color";
import * as text from "@superimg/stdlib/text";
import * as date from "@superimg/stdlib/date";
import { css, fill, center, column, row } from "@superimg/stdlib/css";
import * as responsive from "@superimg/stdlib/responsive";
import * as subtitle from "@superimg/stdlib/subtitle";
import * as presets from "@superimg/stdlib/presets";
import * as code from "@superimg/stdlib/code";
import { mergeMotion } from "@superimg/stdlib/director";
import { carousel } from "@superimg/stdlib/carousel";
import { stack } from "@superimg/stdlib/stack";
import { layoutTimeline } from "@superimg/stdlib/layout-timeline";
import { layers } from "@superimg/stdlib/layers";
import { revealFx } from "@superimg/stdlib/reveal";
import { oscillate, loop, pingpong, wiggle } from "@superimg/stdlib/oscillate";
import * as backgrounds from "@superimg/stdlib/backgrounds";
import { montage } from "@superimg/stdlib/montage";
import { spring } from "@superimg/stdlib/spring";
import { clamp01 } from "@superimg/stdlib/easing";
import { stagger } from "@superimg/stdlib/stagger";
import { interpolate, interpolateColor } from "@superimg/stdlib/interpolate";
import { timing } from "@superimg/stdlib/timing";
import { phases } from "@superimg/stdlib/phase-recipes";
import { motion } from "@superimg/stdlib/motion-presets";
import { getSafeArea, getSafeBox } from "@superimg/stdlib/safe-area";
import { path, createMotionPath } from "@superimg/stdlib/path";
import {
  draw,
  drawMany,
  filter,
  morph,
  arcPoint,
  shape,
  textPath,
  bezier,
  gradient as svgGradient,
  measureText,
  wrapText,
  fitText,
  rough as svgRough,
} from "@superimg/stdlib/svg";
import * as layout from "@superimg/stdlib/layout";
import * as viz from "@superimg/stdlib/viz";
import { ready } from "@superimg/stdlib/ready";

const mathWithoutLerp = Object.fromEntries(
  Object.entries(math).filter(([key]) => key !== "lerp")
) as Omit<typeof math, "lerp">;

export type StaticStdlib = Omit<Stdlib, "video" | "media" | "px" | "scale">;

export const stdlib: StaticStdlib = {
  math: mathWithoutLerp,
  color,
  text,
  date,
  css: Object.assign(css, { fill, center, column, row }),
  responsive,
  subtitle,
  presets,
  code,
  carousel,
  stack,
  layoutTimeline,
  backgrounds,
  montage,
  createResponsive: responsive.createResponsive,
  spring,
  clamp01,
  stagger,
  timing,
  phases,
  motion,
  safeArea: getSafeArea,
  safeBox: getSafeBox,
  interpolate,
  interpolateColor,
  path: Object.assign(path, { parse: createMotionPath }),
  svg: {
    draw,
    drawMany,
    filter,
    morph,
    arcPoint,
    shape,
    textPath,
    bezier,
    gradient: svgGradient,
    measureText,
    wrapText,
    fitText,
    rough: svgRough,
  },
  layout,
  mergeMotion,
  layers,
  reveal: revealFx,
  oscillate,
  loop,
  pingpong,
  wiggle,
  viz,
  ready,
};
