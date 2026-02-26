//! Stdlib type definitions for template authors

import type * as easing from "@superimg/stdlib/easing";
import type * as math from "@superimg/stdlib/math";
import type * as color from "@superimg/stdlib/color";
import type * as text from "@superimg/stdlib/text";
import type * as date from "@superimg/stdlib/date";
import type * as timing from "@superimg/stdlib/timing";
import type * as responsive from "@superimg/stdlib/responsive";
import type * as subtitle from "@superimg/stdlib/subtitle";
import type * as presets from "@superimg/stdlib/presets";

/**
 * Standard library available via `ctx.std` in render functions.
 *
 * @example
 * ```typescript
 * import { defineTemplate } from 'superimg';
 *
 * export default defineTemplate({
 *   render(ctx) {
 *     const { std, sceneProgress } = ctx;
 *     const eased = std.easing.easeOutCubic(sceneProgress);
 *     const x = std.math.lerp(0, 1920, eased);
 *     const bg = std.color.alpha('#FF0000', 0.5);
 *     return `<div style="left: ${x}px; background: ${bg}">Hello</div>`;
 *   },
 * });
 * ```
 */
export interface Stdlib {
  /** @core Animation easing. Start here: easeOutCubic, easeInCubic, easeInOutCubic, linear */
  easing: typeof easing;
  /** @core Math utilities. Start here: lerp, clamp, map, random */
  math: typeof math;
  /** @core Color manipulation. Start here: alpha, mix, lighten, darken, hexToRgb */
  color: typeof color;
  /** @extended Text formatting (truncate, pluralize, formatNumber, escapeHtml) */
  text: typeof text;
  /** @extended Date formatting and manipulation (formatDate, relativeTime, parseISO) */
  date: typeof date;
  /** @extended Timing/phase management (createPhaseManager, getPhase, phaseProgress) */
  timing: typeof timing;
  /** @extended Responsive layout helper based on canvas aspect ratio */
  responsive: typeof responsive;
  /** @extended Subtitle parsing and display for SRT/VTT formats */
  subtitle: typeof subtitle;
  /** @extended Platform presets for social media dimensions (instagram, youtube, tiktok, etc.) */
  presets: typeof presets;
}

