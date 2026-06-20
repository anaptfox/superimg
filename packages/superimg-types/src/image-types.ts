//! Still image template types — narrowed defineImage factory with no temporal fields.

import type { AssetMeta, AssetDeclaration, OutputInfo, TailwindConfig } from "./types.js";
import type { ImageStdlib } from "./stdlib.js";

export type StillOutputFormat = "png" | "webp" | "jpeg";

export interface ImageOutputPreset {
  width?: number;
  height?: number;
  format?: StillOutputFormat;
  outDir?: string;
  outFile?: string;
}

export interface ImageConfig {
  width?: number;
  height?: number;
  fonts?: string[];
  inlineCss?: string[];
  stylesheets?: string[];
  tailwind?: boolean | TailwindConfig;
  assets?: Record<string, string | AssetDeclaration>;
  outputs?: Record<string, ImageOutputPreset>;
}

export interface ImageRenderContext<TData = Record<string, unknown>> {
  std: ImageStdlib;
  width: number;
  height: number;
  aspectRatio: number;
  isPortrait: boolean;
  isLandscape: boolean;
  isSquare: boolean;
  data: TData;
  assets: Record<string, AssetMeta>;
  asset: (filename: string) => string;
  output: OutputInfo;
}

export interface ImageModule<TData = Record<string, unknown>> {
  readonly kind: "image";
  render: (ctx: ImageRenderContext<TData>) => string;
  config?: ImageConfig;
  data?: Partial<TData>;
}

export type DefineImageInput<TData = Record<string, unknown>> =
  Omit<ImageModule<TData>, "kind"> & { kind?: "image" };

export function defineImage<TData>(m: DefineImageInput<TData>): ImageModule<TData> {
  return { ...m, kind: "image" };
}
