import { preCache, snapdom, type SnapdomOptions } from "@zumer/snapdom";
import type { MediaSurface } from "@superimg/media";
import { get2DContext } from "./utils.js";

export interface BrowserCaptureOptions {
  width: number;
  height: number;
  backgroundColor?: string;
  embedFonts?: boolean;
  cache?: SnapdomOptions["cache"];
  compress?: boolean;
}

export interface BrowserCaptureBackend {
  warmup(element: HTMLElement, options: BrowserCaptureOptions): Promise<void>;
  capture(element: HTMLElement, options: BrowserCaptureOptions): Promise<ImageData>;
}

export class SnapdomCaptureBackend implements BrowserCaptureBackend {
  async warmup(element: HTMLElement): Promise<void> {
    await preCache(element, { embedFonts: true, cache: "full" });
  }

  async capture(element: HTMLElement, options: BrowserCaptureOptions): Promise<ImageData> {
    const result = await snapdom(element, {
      width: options.width,
      height: options.height,
      scale: 1,
      dpr: 1,
      embedFonts: options.embedFonts ?? true,
      backgroundColor: options.backgroundColor ?? "#000000",
      cache: options.cache ?? "auto",
      compress: options.compress ?? false,
    });
    const canvas = await result.toCanvas();
    const ctx = get2DContext(canvas);
    return ctx.getImageData(0, 0, canvas.width, canvas.height);
  }
}

export function requireSurfaceElement(surface: MediaSurface | null): HTMLElement {
  const element = surface?.getElement() ?? null;
  if (!element) {
    throw new Error("MediaSession has no mounted DOM surface to capture");
  }
  return element;
}

export async function captureSurfaceFrame(
  backend: BrowserCaptureBackend,
  surface: MediaSurface | null,
  options: BrowserCaptureOptions,
): Promise<ImageData> {
  return backend.capture(requireSurfaceElement(surface), options);
}
