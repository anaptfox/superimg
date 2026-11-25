//! Browser-free SVG rasterizer backed by @resvg/resvg-wasm.
//!
//! Platform-specific `ensureInit` is bound at module load via
//! `resvg-rasterizer.edge.ts` or `resvg-rasterizer.node.ts`.

import { Resvg } from "@resvg/resvg-wasm";
import { SuperImgError } from "@superimg/types";
import { assertNativeFont } from "./font-format.js";
import type {
  Medium,
  Rasterizer,
  RasterizerCapabilities,
  RasterizerConfig,
} from "@superimg/types";

/** Anything `@resvg/resvg-wasm`'s `initWasm` accepts. */
export type WasmSource =
  | ArrayBuffer
  | Uint8Array
  | Response
  | URL
  | WebAssembly.Module;

type EnsureInitFn = (source?: WasmSource | Promise<WasmSource>) => Promise<void>;

let boundEnsureInit: EnsureInitFn | null = null;

/** Called once by platform entry modules (edge vs node). */
export function bindEnsureInit(fn: EnsureInitFn): void {
  boundEnsureInit = fn;
}

function getEnsureInit(): EnsureInitFn {
  if (!boundEnsureInit) {
    throw new Error(
      "resvg ensureInit is not bound — import from resvg-rasterizer.edge or resvg-rasterizer.node",
    );
  }
  return boundEnsureInit;
}

/**
 * Initialise the resvg WASM module exactly once (idempotent, concurrency-safe).
 *
 * In Node the WASM binary is resolved automatically from the installed
 * package. In environments without filesystem access (Cloudflare Workers),
 * pass an explicit `source` — typically the bound `.wasm` asset/module.
 */
export function ensureInit(source?: WasmSource | Promise<WasmSource>): Promise<void> {
  return getEnsureInit()(source);
}

export interface RasterizeSvgOptions {
  /** Target width in pixels. The SVG is scaled to this width (aspect preserved). */
  width: number;
  /** Target height (used by the Rasterizer adapter; informational for fitTo:width). */
  height?: number;
  /** Raw font buffers (TTF/OTF). Required for any text to render. */
  fontBuffers?: Uint8Array[];
  /** Background CSS color (e.g. "white", "rgba(0,0,0,0)"). Default: transparent. */
  background?: string;
  /** Fallback family when an element specifies none. */
  defaultFontFamily?: string;
  /**
   * DPI for physical SVG units (default 96). Higher values improve print-style
   * units without changing `fitTo: width` pixel target when width is set.
   */
  dpi?: number;
  /**
   * Optional zoom supersample before width fit. Prefer increasing `width` for
   * Retina masters so the size contract stays explicit.
   */
  zoom?: number;
}

import { countSvgTextElements } from "./svg-text-scan.js";
export { countSvgTextElements } from "./svg-text-scan.js";

/**
 * Rasterize an SVG string to PNG bytes. `ensureInit()` must have resolved
 * first (the async `rasterize()` wrapper does this for you).
 *
 * System fonts are never loaded (determinism + build⟷edge parity); supply
 * `fontBuffers` for any text. Text with no font buffers throws
 * `SVG_TEXT_NO_FONT` instead of rasterizing a PNG that silently drops glyphs.
 *
 * Size contract: default `fitTo: { mode: "width", value: opts.width }` is
 * preserved. Quality flags (shape/text/image rendering) apply without
 * changing the width fit semantics.
 */
export function rasterizeSvgSync(svg: string, opts: RasterizeSvgOptions): Uint8Array {
  const fontBuffers = opts.fontBuffers ?? [];
  for (const font of fontBuffers) assertNativeFont(font);
  const textElements = countSvgTextElements(svg);
  if (textElements > 0 && fontBuffers.length === 0) {
    throw new SuperImgError(
      `SVG contains ${textElements} text element${textElements === 1 ? "" : "s"} but no font buffers were provided, so resvg would drop every glyph`,
      "SVG_TEXT_NO_FONT",
      { textElements },
      "Pass font bytes (fontBuffers) or declare fonts on the media definition.",
    );
  }
  const fitTo =
    opts.zoom !== undefined && opts.zoom > 0
      ? { mode: "zoom" as const, value: opts.zoom }
      : { mode: "width" as const, value: opts.width };
  const resvg = new Resvg(svg, {
    dpi: opts.dpi ?? 96,
    fitTo,
    // geometricPrecision / optimizeQuality (resvg-wasm enum ints)
    shapeRendering: 2,
    textRendering: 1,
    imageRendering: 0,
    ...(opts.background !== undefined ? { background: opts.background } : {}),
    font: {
      loadSystemFonts: false,
      fontBuffers,
      ...(opts.defaultFontFamily !== undefined
        ? { defaultFontFamily: opts.defaultFontFamily }
        : {}),
    },
  });
  const rendered = resvg.render();
  const png = rendered.asPng();
  rendered.free();
  resvg.free();
  return png;
}

/** Ensure-init + rasterize convenience for one-shot edge/build calls. */
export async function rasterize(
  svg: string,
  opts: RasterizeSvgOptions & { wasm?: WasmSource | Promise<WasmSource> },
): Promise<Uint8Array> {
  await ensureInit(opts.wasm);
  return rasterizeSvgSync(svg, opts);
}

const RESVG_CAPABILITIES: RasterizerCapabilities = {
  media: ["svg"],
  browserFree: true,
  workerSafe: true,
};

/**
 * The `Rasterizer` contract implementation for the SVG medium. Selected by the
 * rasterizer registry whenever `medium === "svg"` — at build time and edge.
 */
export class ResvgRasterizer implements Rasterizer<Uint8Array> {
  readonly capabilities = RESVG_CAPABILITIES;

  private width = 0;
  private height = 0;
  private fontBuffers: Uint8Array[] = [];
  private readonly wasm?: WasmSource | Promise<WasmSource>;
  private readonly background?: string;
  private readonly defaultFontFamily?: string;

  constructor(opts?: {
    wasm?: WasmSource | Promise<WasmSource>;
    background?: string;
    defaultFontFamily?: string;
  }) {
    if (opts?.wasm !== undefined) this.wasm = opts.wasm;
    if (opts?.background !== undefined) this.background = opts.background;
    if (opts?.defaultFontFamily !== undefined) this.defaultFontFamily = opts.defaultFontFamily;
  }

  accepts(medium: Medium): boolean {
    return medium === "svg";
  }

  async init(config: RasterizerConfig): Promise<void> {
    this.width = config.width;
    this.height = config.height;
    this.fontBuffers = config.fontBuffers ?? [];
    await ensureInit(this.wasm);
  }

  async rasterize(markup: string): Promise<Uint8Array> {
    return rasterizeSvgSync(markup, {
      width: this.width,
      height: this.height,
      fontBuffers: this.fontBuffers,
      ...(this.background !== undefined ? { background: this.background } : {}),
      ...(this.defaultFontFamily !== undefined
        ? { defaultFontFamily: this.defaultFontFamily }
        : {}),
    });
  }

  async dispose(): Promise<void> {
    // Per-render Resvg instances are freed in rasterizeSvgSync; nothing to hold.
  }
}
