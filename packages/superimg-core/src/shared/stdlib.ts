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
import type * as code from "@superimg/stdlib/code";
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
} from "@superimg/stdlib/svg/base";
import type * as svgRough from "@superimg/stdlib/svg/rough";
import * as layout from "@superimg/stdlib/layout";
import * as vizBase from "@superimg/stdlib/viz/base";
import type * as viz from "@superimg/stdlib/viz";
import { ready } from "@superimg/stdlib/ready";

const mathWithoutLerp = Object.fromEntries(
  Object.entries(math).filter(([key]) => key !== "lerp")
) as Omit<typeof math, "lerp">;

export type StaticStdlib = Omit<Stdlib, "video" | "media" | "px" | "scale">;

function missingCapability(name: string): never {
  throw new Error(
    `SuperImg stdlib capability "${name}" was not prepared. Load templates through Player/createRenderPlan before rendering.`,
  );
}

function missingNamespace(name: string): unknown {
  const callable = () => missingCapability(name);
  return new Proxy(callable, {
    get: () => missingNamespace(name),
    apply: () => missingCapability(name),
  });
}

const missingCode = {
  highlight: () => missingCapability("code"),
  getThemes: () => [],
  getLangs: () => [],
} as unknown as typeof code;

const missing = (name: string) => missingNamespace(name) as never;
const lazyViz = {
  ...vizBase,
  three: missing("three"),
  lottie: missing("lottie"),
  lottieApi: missing("lottie"),
  lottieDurationFrames: missing("lottie"),
  lottieDurationSeconds: missing("lottie"),
  LOTTIE_VERSION: "",
  LOTTIE_MODULE_LIGHT: "",
  LOTTIE_MODULE_FULL: "",
  mermaid: missing("mermaid"),
  equation: missing("katex"),
  equationSteps: missing("katex"),
  equationMatch: missing("katex"),
  parseEquationSteps: missing("katex"),
  katexCss: "",
  katex: missing("katex"),
} as unknown as typeof viz;

export const stdlib: StaticStdlib = {
  math: mathWithoutLerp,
  color,
  text,
  date,
  css: Object.assign(css, { fill, center, column, row }),
  responsive,
  subtitle,
  presets,
  code: missingCode,
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
    rough: missing("rough") as typeof svgRough,
  },
  layout,
  mergeMotion,
  layers,
  reveal: revealFx,
  oscillate,
  loop,
  pingpong,
  wiggle,
  viz: lazyViz,
  ready,
};
