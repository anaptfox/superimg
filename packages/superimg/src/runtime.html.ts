//! Pure, synchronous HTML rendering for worker and request-time hosts.
//!
//! This surface intentionally excludes runtime initialization, provider
//! execution, font fetching, rasterization, publication, and host authority.

import { renderTemplateFrame } from "@superimg/core/edge";
import type { AnyTemplateModule, CanvasSize } from "@superimg/types";

export interface NativeRenderOptions {
  /** A realized media module (image/video/svg/gif). */
  media: AnyTemplateModule;
  /** Canvas dimensions override (alternative to separate `width` / `height`). */
  size?: CanvasSize;
  /** Width of the output (default: from template config or 1920). */
  width?: number;
  /** Height of the output (default: from template config or 1080). */
  height?: number;
  /** Template data merged on top of sample. */
  data?: Record<string, unknown>;
  /** Frame index for video/gif templates (default: 0). */
  frame?: number;
  /** Time offset in seconds for video/gif templates (alternative to `frame` / `progress`). */
  seconds?: number;
  /** Scene progress 0–1 — alternative to frame. */
  progress?: number;
  fps?: number;
  durationSeconds?: number;
  /** Include the background/watermark wrapper (default: true). */
  composite?: boolean;
  /** Optional asset resolver. */
  assetResolver?: (filename: string) => string;
}

/**
 * Render one frame from an already-realized media module to HTML.
 *
 * This entry deliberately does not accept source strings: compiling author
 * source belongs to a compiler-enabled host, while request-time hosts can keep
 * this renderer synchronous and capability-free.
 */
export function renderToHtml(options: NativeRenderOptions): string {
  if (
    typeof options.media !== "object" ||
    options.media === null ||
    typeof options.media.render !== "function"
  ) {
    throw new TypeError(
      "@foxworth/superimg/runtime/html requires an already-realized media module; " +
        "it does not compile source strings.",
    );
  }

  const width = options.width ?? options.size?.width;
  const height = options.height ?? options.size?.height;

  const { compositeHtml } = renderTemplateFrame({
    template: options.media,
    ...(width !== undefined ? { width } : {}),
    ...(height !== undefined ? { height } : {}),
    ...(options.data !== undefined ? { data: options.data } : {}),
    ...(options.frame !== undefined ? { frame: options.frame } : {}),
    ...(options.seconds !== undefined ? { seconds: options.seconds } : {}),
    ...(options.progress !== undefined ? { progress: options.progress } : {}),
    ...(options.fps !== undefined ? { fps: options.fps } : {}),
    ...(options.durationSeconds !== undefined
      ? { durationSeconds: options.durationSeconds }
      : {}),
    ...(options.composite !== undefined ? { composite: options.composite } : {}),
    ...(options.assetResolver !== undefined
      ? { assetResolver: options.assetResolver }
      : {}),
  });

  return compositeHtml;
}

/**
 * Media-first stateless still HTML renderer for instant contact sheets and
 * browser/SSR previews without mounting a live DOM `Player`.
 */
export function renderStillHtml(
  media: AnyTemplateModule,
  options: Omit<NativeRenderOptions, "media"> = {},
): string {
  return renderToHtml({ ...options, media });
}
