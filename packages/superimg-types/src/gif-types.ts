//! GIF template types — narrowed defineGif factory (no audio, mode, thumbnailAt).

import type { AssetDeclaration, Duration, TailwindConfig, OutputPreset, RenderContext } from "./types.js";

export interface GifConfig {
  width?: number;
  height?: number;
  fps?: number;
  duration?: Duration;
  fonts?: string[];
  inlineCss?: string[];
  stylesheets?: string[];
  tailwind?: boolean | TailwindConfig;
  assets?: Record<string, string | AssetDeclaration>;
  outputs?: Record<string, OutputPreset>;
  gif?: {
    loop?: number;
    maxColors?: number;
    dither?: string;
  };
}

export interface GifModule<TData = Record<string, unknown>> {
  readonly kind: "gif";
  render: (ctx: RenderContext<TData>) => string;
  config?: GifConfig;
  /** Sample/preview data — the template renders from this when no external data is provided. */
  sample?: TData;
}

export type DefineGifInput<TData = Record<string, unknown>> =
  Omit<GifModule<TData>, "kind" | "sample"> & { kind?: "gif"; sample?: TData };

export function defineGif<TData>(m: DefineGifInput<TData>): GifModule<TData> {
  return { ...m, kind: "gif" };
}
