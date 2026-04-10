/**
 * SVG utilities for SuperImg templates.
 *
 * Available via `ctx.std.svg` in render functions:
 * - draw: stroke drawing reveal animation
 * - filter: composable SVG filter builder
 * - morph: path morphing/interpolation
 * - reveal: clip-path reveal helpers
 * - shape: shape generators (return d strings)
 * - textPath: text on curved path
 */

export { draw } from "./draw";
export type { DrawResult, DrawOptions } from "./draw";
export { filter } from "./filter";
export type { FilterEffect, FilterResult } from "./filter";
export { morph } from "./morph";
export { reveal } from "./reveal";
export type { CircleRevealOptions, WipeDirection, InsetRevealOptions } from "./reveal";
export { shape } from "./shape";
export { textPath } from "./textPath";
export type { TextPathOptions } from "./textPath";
