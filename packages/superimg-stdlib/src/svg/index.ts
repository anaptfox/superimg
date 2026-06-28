/**
 * SVG utilities for SuperImg templates.
 *
 * Available via `ctx.std.svg` in render functions:
 * - draw: stroke drawing reveal animation
 * - filter: composable SVG filter builder
 * - morph: path morphing/interpolation
 * - shape: shape generators (return d strings)
 * - textPath: text on curved path
 */

export { draw } from "./draw";
export type { DrawResult, DrawOptions } from "./draw";
export { filter } from "./filter";
export type { FilterEffect, FilterResult } from "./filter";
export { morph } from "./morph";
export { shape } from "./shape";
export { textPath } from "./textPath";
export type { TextPathOptions } from "./textPath";
export * as bezier from "./bezier";
export * as gradient from "./gradient";
export type { SvgGradientResult, SvgLinearGradientOpts, SvgRadialGradientOpts } from "./gradient";
export { measureText, wrapText, fitText } from "./measure";
export type { MeasureOptions, TextMetrics, LineBox } from "./measure";
