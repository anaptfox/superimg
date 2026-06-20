import type { RenderContext, TemplateModule } from "@superimg/types";
import { buildCompositeHtml } from "./html/html.js";
import { createRenderContext } from "./rendering/wasm.js";

export interface NativeRenderOptions {
  /** The bundled template code or compiled TemplateModule */
  template: string | TemplateModule;
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
export function renderNativeToHtml(options: NativeRenderOptions): string {
  let module: TemplateModule;

  // If a string is passed, we compile it on the fly.
  if (typeof options.template === "string") {
    // Basic IIFE compilation (Cloudflare Workers safe)
    const factory = new Function(options.template + "\nreturn __template;");
    const exports = factory();
    module = {
      kind: exports.default.kind ?? "video",
      render: exports.default.render,
      config: exports.default.config,
      data: exports.default.data,
    };
  } else {
    module = options.template;
  }

  const width = options.width ?? module.config?.width ?? 1920;
  const height = options.height ?? module.config?.height ?? 1080;
  const data = options.data ?? module.data ?? {};
  
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

  const rawOutput = module.render(ctx);

  return buildCompositeHtml(
    rawOutput,
    module.config?.background,
    module.config?.watermark,
    width,
    height
  );
}

