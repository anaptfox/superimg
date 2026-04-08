//! Shared stdlib construction - used by wasm.ts and other runtime code

import type { Stdlib } from "@superimg/types";
import * as math from "@superimg/stdlib/math";
import * as color from "@superimg/stdlib/color";
import * as text from "@superimg/stdlib/text";
import * as date from "@superimg/stdlib/date";
import { css, fill, center, stack } from "@superimg/stdlib/css";
import { tween } from "@superimg/stdlib/tween";
import * as responsive from "@superimg/stdlib/responsive";
import * as subtitle from "@superimg/stdlib/subtitle";
import * as presets from "@superimg/stdlib/presets";
import * as code from "@superimg/stdlib/code";
import {
  timeline,
  transcript,
  fromElevenLabs,
  fromWhisper,
  markers,
  script,
} from "@superimg/stdlib/timeline";
import * as motion from "@superimg/stdlib/motion";
import { phases } from "@superimg/stdlib/phases";
import * as backgrounds from "@superimg/stdlib/backgrounds";
import { montage } from "@superimg/stdlib/montage";
import { spring, springTween, createSpring } from "@superimg/stdlib/spring";
import { stagger } from "@superimg/stdlib/stagger";
import { interpolate, interpolateColor } from "@superimg/stdlib/interpolate";

const mathWithoutLerp = Object.fromEntries(
  Object.entries(math).filter(([key]) => key !== "lerp")
) as Omit<typeof math, "lerp">;

export const stdlib: Stdlib = {
  math: mathWithoutLerp,
  color,
  text,
  date,
  css: Object.assign(css, { fill, center, stack }),
  tween,
  responsive,
  subtitle,
  presets,
  code,
  timeline: Object.assign(timeline, {
    transcript,
    fromElevenLabs,
    fromWhisper,
    markers,
    script,
  }),
  motion,
  phases,
  backgrounds,
  montage,
  createResponsive: responsive.createResponsive,
  spring,
  springTween,
  createSpring,
  stagger,
  interpolate,
  interpolateColor,
};
