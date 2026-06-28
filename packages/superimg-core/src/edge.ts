import type { AnyTemplateModule } from "@superimg/types";
import { compileTemplate } from "./rendering/compiler.js";
import { renderTemplateFrame } from "./rendering/render-frame.js";

export interface NativeRenderOptions {
  /** The bundled template code or a compiled module (image/video/svg/gif) */
  template: string | AnyTemplateModule;
  /** Width of the output (default: from template config or 1920) */
  width?: number;
  /** Height of the output (default: from template config or 1080) */
  height?: number;
  /** Template data merged on top of sample */
  data?: Record<string, unknown>;
  /** Frame index for video/gif templates (default: 0) */
  frame?: number;
  /** Scene progress 0–1 — alternative to frame */
  progress?: number;
  fps?: number;
  durationSeconds?: number;
  /** Include background/watermark wrapper (default: true) */
  composite?: boolean;
  /** Optional asset resolver */
  assetResolver?: (filename: string) => string;
}

/**
 * Renders a template natively to an HTML string (single frame, no Playwright).
 * Safe to execute in Cloudflare Workers, V8 Isolates, or Deno.
 * For PNG output, use renderVideo with encoding.format png and frame.
 */
export function renderToHtml(options: NativeRenderOptions): string {
  let module: AnyTemplateModule;

  if (typeof options.template === "string") {
    const result = compileTemplate(options.template);
    if (result.error || !result.template) {
      throw result.error ?? new Error("Template compilation produced no module.");
    }
    module = result.template;
  } else {
    module = options.template;
  }

  const { compositeHtml } = renderTemplateFrame({
    template: module,
    ...(options.width !== undefined ? { width: options.width } : {}),
    ...(options.height !== undefined ? { height: options.height } : {}),
    ...(options.data !== undefined ? { data: options.data } : {}),
    ...(options.frame !== undefined ? { frame: options.frame } : {}),
    ...(options.progress !== undefined ? { progress: options.progress } : {}),
    ...(options.fps !== undefined ? { fps: options.fps } : {}),
    ...(options.durationSeconds !== undefined ? { durationSeconds: options.durationSeconds } : {}),
    ...(options.composite !== undefined ? { composite: options.composite } : {}),
    ...(options.assetResolver !== undefined ? { assetResolver: options.assetResolver } : {}),
  });

  return compositeHtml;
}

/** @deprecated Use renderToHtml instead. */
export const renderNativeToHtml = renderToHtml;