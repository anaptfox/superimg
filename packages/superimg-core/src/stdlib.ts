//! Shared stdlib construction - used by wasm.ts and other runtime code

import type { Stdlib } from "@superimg/types";
import * as easing from "@superimg/stdlib/easing";
import * as math from "@superimg/stdlib/math";
import * as color from "@superimg/stdlib/color";
import * as text from "@superimg/stdlib/text";
import * as date from "@superimg/stdlib/date";
import * as timing from "@superimg/stdlib/timing";
import * as responsive from "@superimg/stdlib/responsive";
import * as subtitle from "@superimg/stdlib/subtitle";
import * as presets from "@superimg/stdlib/presets";

export const stdlib: Stdlib = {
  easing,
  math,
  color,
  text,
  date,
  timing,
  responsive,
  subtitle,
  presets,
};
