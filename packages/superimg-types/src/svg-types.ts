//! SVG template types — defineSvg factory. render() must return real SVG markup.

import type { AssetMeta, AssetDeclaration, OutputInfo } from "./types.js";
import type { SvgStdlib } from "./stdlib.js";

export interface SvgOutputPreset {
  width?: number;
  height?: number;
  outDir?: string;
  outFile?: string;
}

export interface SvgConfig {
  width?: number;
  height?: number;
  /** Exposed as ctx.duration for CSS animation-duration */
  duration?: number;
  fonts?: string[];
  assets?: Record<string, string | AssetDeclaration>;
  outputs?: Record<string, SvgOutputPreset>;
}

export interface SvgRenderContext<TData = Record<string, unknown>> {
  std: SvgStdlib;
  width: number;
  height: number;
  aspectRatio: number;
  isPortrait: boolean;
  isLandscape: boolean;
  isSquare: boolean;
  /** Declared duration in seconds — use for CSS animation-duration. */
  duration?: number;
  data: TData;
  assets: Record<string, AssetMeta>;
  asset: (filename: string) => string;
  output: OutputInfo;
}

export interface SvgModule<TData = Record<string, unknown>> {
  readonly kind: "svg";
  render: (ctx: SvgRenderContext<TData>) => string;
  config?: SvgConfig;
  data?: Partial<TData>;
}

export type DefineSvgInput<TData = Record<string, unknown>> =
  Omit<SvgModule<TData>, "kind"> & { kind?: "svg" };

export function defineSvg<TData>(m: DefineSvgInput<TData>): SvgModule<TData> {
  return { ...m, kind: "svg" };
}
