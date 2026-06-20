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
  data?: Partial<TData>;
}

export type DefineGifInput<TData = Record<string, unknown>> =
  Omit<GifModule<TData>, "kind"> & { kind?: "gif" };

export function defineGif<TData>(m: DefineGifInput<TData>): GifModule<TData> {
  return { ...m, kind: "gif" };
}
