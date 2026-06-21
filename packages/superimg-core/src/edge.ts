import type { AnyTemplateModule, TemplateConfig } from "@superimg/types";
import { buildCompositeHtml } from "./html/html.js";
import { createRenderContext } from "./rendering/wasm.js";
import { compileTemplate } from "./rendering/compiler.js";

export interface NativeRenderOptions {
  /** The bundled template code or a compiled module (image/video/svg/gif) */
  template: string | AnyTemplateModule;
  /** Width of the output SVG (default: 1920) */
  width?: number;
  /** Height of the output SVG (default: 1080) */
  height?: number;
  /** The data to pass into the render context */
  data?: Record<string, unknown>;
  /** Optional asset resolver */
  assetResolver?: (filename: string) => string;
}

/**
 * Renders a template natively to an HTML string (single frame, no Playwright).
 * Safe to execute in Cloudflare Workers, V8 Isolates, or Deno.
 * For PNG/SVG encoding from the output, pipe into an image WASM (e.g. resvg-wasm, sharp-wasm).
 */
export function renderToHtml(options: NativeRenderOptions): string {
  let module: AnyTemplateModule;

  // If a string is passed, it must be IIFE-bundled template code (the bundler's
  // `__template` global). Reuse the canonical compiler so we get the same
  // error handling and migration guards as the Playwright path.
  if (typeof options.template === "string") {
    const result = compileTemplate(options.template);
    if (result.error || !result.template) {
      throw result.error ?? new Error("Template compilation produced no module.");
    }
    module = result.template;
  } else {
    module = options.template;
  }

  // Config shapes differ per kind; only the video config carries background/
  // watermark, so read through TemplateConfig (absent fields resolve to undefined).
  const config = module.config as TemplateConfig | undefined;
  const width = options.width ?? config?.width ?? 1920;
  const height = options.height ?? config?.height ?? 1080;
  const data = options.data ?? module.sample ?? {};
  
  // Single frame context for image generation
  const ctx = createRenderContext(
    0, // frame 0
    1, // fps 1
    1, // durationFrames 1
    width,
    height,
    data,
    "native_edge_render",
    {},
    options.assetResolver
  );

  // The edge path builds one render context that serves every template kind
  // (image/video/svg/gif share width/height/data/assets); the union's render
  // signatures differ only in their ctx subtype, so cast to invoke.
  const rawOutput = (module.render as (ctx: unknown) => string)(ctx);

  return buildCompositeHtml(
    rawOutput,
    config?.background,
    config?.watermark,
    width,
    height
  );
}

/** @deprecated Use renderToHtml instead. */
export const renderNativeToHtml = renderToHtml;

