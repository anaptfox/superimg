//! Shared stdlib construction - used by wasm.ts and other runtime code

import type { Stdlib } from "@superimg/types";
import * as math from "@superimg/stdlib/math";
import * as color from "@superimg/stdlib/color";
import * as text from "@superimg/stdlib/text";
import * as date from "@superimg/stdlib/date";
import * as timing from "@superimg/stdlib/timing";
import { css, fill, center, stack } from "@superimg/stdlib/css";
import { tween } from "@superimg/stdlib/tween";
import * as responsive from "@superimg/stdlib/responsive";
import * as subtitle from "@superimg/stdlib/subtitle";
import * as presets from "@superimg/stdlib/presets";

const mathWithoutLerp = Object.fromEntries(
  Object.entries(math).filter(([key]) => key !== "lerp")
) as Omit<typeof math, "lerp">;

export const stdlib: Stdlib = {
  math: mathWithoutLerp,
  color,
  text,
  date,
  timing,
  css: Object.assign(css, { fill, center, stack }),
  tween,
  responsive,
  subtitle,
  presets,
};
