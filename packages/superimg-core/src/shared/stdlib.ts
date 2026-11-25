//! Shared stdlib construction - used by create-render-context and other runtime code

import type { Stdlib } from "@superimg/types";
import type * as math from "@superimg/stdlib/math";
import type * as color from "@superimg/stdlib/color";
import type * as text from "@superimg/stdlib/text";
import type * as date from "@superimg/stdlib/date";
import {
  css,
  fill,
  center,
  column,
  row,
  ditherNoise,
  appleGlass,
} from "@superimg/stdlib/css";
import type * as responsive from "@superimg/stdlib/responsive";
import type * as subtitle from "@superimg/stdlib/subtitle";
import type * as code from "@superimg/stdlib/code";
import { mergeMotion } from "@superimg/stdlib/director";
import type { carousel } from "@superimg/stdlib/carousel";
import type { stack } from "@superimg/stdlib/stack";
import type { layoutTimeline } from "@superimg/stdlib/layout-timeline";
import type { revealFx } from "@superimg/stdlib/reveal";
import type { oscillate, loop, pingpong, wiggle } from "@superimg/stdlib/oscillate";
import type * as backgrounds from "@superimg/stdlib/backgrounds";
import type { montage } from "@superimg/stdlib/montage";
import type { spring } from "@superimg/stdlib/spring";
import {
  clamp01,
  EASING_NAMES,
  type EasingFn,
} from "@superimg/stdlib/easing";
import * as easingFunctions from "@superimg/stdlib/easing";
import type { stagger } from "@superimg/stdlib/stagger";
import type { interpolate as interpolateNumber } from "@superimg/stdlib/interpolate-number";
import type { interpolateColor } from "@superimg/stdlib/interpolate";
import type { timing } from "@superimg/stdlib/timing";
import type { phases } from "@superimg/stdlib/phase-recipes";
import type { motion } from "@superimg/stdlib/motion-presets";
import type { getSafeArea, getSafeBox } from "@superimg/stdlib/safe-area";
import type { path, createMotionPath } from "@superimg/stdlib/path";
import type * as svgBase from "@superimg/stdlib/svg/base";
import type * as svgRough from "@superimg/stdlib/svg/rough";
import type * as layout from "@superimg/stdlib/layout";
import type * as viz from "@superimg/stdlib/viz";
import type { ready } from "@superimg/stdlib/ready";

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

// Keep direct compiled-template evaluation compatible without pulling the
// optional interpolate entry (and its split-chunk runtime) into every Player.
const baseInterpolate: typeof interpolateNumber = (
  progress,
  inputRange,
  outputRange,
  easing,
) => {
  if (inputRange.length < 2) throw new Error("interpolate: inputRange must have at least 2 values");
  if (inputRange.length !== outputRange.length) {
    throw new Error("interpolate: inputRange and outputRange must have the same length");
  }
  const last = inputRange.length - 1;
  if (progress <= inputRange[0]!) return outputRange[0]!;
  if (progress >= inputRange[last]!) return outputRange[last]!;
  let index = 1;
  while (index < last && progress > inputRange[index]!) index += 1;
  const start = inputRange[index - 1]!;
  const end = inputRange[index]!;
  const span = end - start;
  const segment = clamp01(span === 0 ? 0 : (progress - start) / span);
  const easingFn = typeof easing === "function"
    ? easing
    : easing === undefined
      ? undefined
      : (easingFunctions as unknown as Record<string, EasingFn>)[easing];
  if (easing !== undefined && !easingFn) {
    throw new Error(`Unknown easing "${easing}". Valid names: ${EASING_NAMES.join(", ")}`);
  }
  const amount = easingFn ? easingFn(segment) : segment;
  const from = outputRange[index - 1]!;
  return from + (outputRange[index]! - from) * amount;
};

const missingCode = {
  highlight: () => missingCapability("code"),
  getThemes: () => [],
  getLangs: () => [],
} as unknown as typeof code;

const missing = (name: string) => missingNamespace(name) as never;
/**
 * Produce a pristine stdlib for one authority boundary. Optional capability
 * loaders mutate only the returned object; sessions never share capability packs.
 */
export function createStaticStdlib(): StaticStdlib {
  const lazyViz = {
    coords: missing("viz"),
    plot: missing("viz"),
    tracker: missing("viz"),
    canvas: missing("viz"),
    reveal: missing("viz"),
    camera: missing("viz"),
    indicate: missing("viz"),
    scale: missing("viz"),
    charts: missing("viz"),
    project3d: missing("viz"),
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

  const lazySvg = {
    draw: missing("svg"),
    drawMany: missing("svg"),
    filter: missing("svg"),
    morph: missing("svg"),
    arcPoint: missing("svg"),
    shape: missing("svg"),
    textPath: missing("svg"),
    bezier: missing("svg"),
    gradient: missing("svg"),
    measureText: missing("svg"),
    wrapText: missing("svg"),
    fitText: missing("svg"),
    rough: missing("rough") as typeof svgRough,
  } as unknown as typeof svgBase & { rough: typeof svgRough };

  return {
    math: missing("math") as Omit<typeof math, "lerp">,
    color: missing("color") as typeof color,
    text: missing("text") as typeof text,
    date: missing("date") as typeof date,
    css: Object.assign(css, { fill, center, column, row, ditherNoise, appleGlass }),
    responsive: missing("responsive") as typeof responsive,
    subtitle: missing("subtitle") as typeof subtitle,
    code: missingCode,
    carousel: missing("carousel") as typeof carousel,
    stack: missing("stack") as typeof stack,
    layoutTimeline: missing("layout-timeline") as typeof layoutTimeline,
    backgrounds: missing("backgrounds") as typeof backgrounds,
    montage: missing("montage") as typeof montage,
    createResponsive: missing("responsive") as typeof responsive.createResponsive,
    spring: missing("spring") as typeof spring,
    clamp01,
    stagger: missing("stagger") as typeof stagger,
    timing: missing("timing") as typeof timing,
    phases: missing("phases") as typeof phases,
    motion: missing("motion") as typeof motion,
    safeArea: missing("safe-area") as typeof getSafeArea,
    safeBox: missing("safe-area") as typeof getSafeBox,
    // Numeric interpolation is a tiny foundational primitive used by direct
    // compiled-template evaluation as well as Player sessions.
    interpolate: baseInterpolate,
    interpolateColor: missing("color") as typeof interpolateColor,
    path: missing("path") as typeof path & { parse: typeof createMotionPath },
    svg: lazySvg,
    layout: missing("layout") as typeof layout,
    mergeMotion,
    reveal: missing("reveal") as typeof revealFx,
    oscillate: missing("oscillate") as typeof oscillate,
    loop: missing("oscillate") as typeof loop,
    pingpong: missing("oscillate") as typeof pingpong,
    wiggle: missing("oscillate") as typeof wiggle,
    viz: lazyViz,
    ready: missing("ready") as typeof ready,
  };
}
