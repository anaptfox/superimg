//! Browser-free SVG rasterizer backed by @resvg/resvg-wasm.
//!
//! The same renderer runs at build time (Node) and at the edge (Cloudflare
//! Worker / V8 isolate), producing byte-identical PNGs. The hot path uses no
//! node builtins; the optional default WASM loader lazily imports `node:fs`
//! and is never reached in a Worker — there the caller passes its own bound
//! `.wasm` module via `ensureInit()` / the `wasm` constructor option.

import { initWasm, Resvg } from "@resvg/resvg-wasm";
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

let initPromise: Promise<void> | null = null;

/**
 * Initialise the resvg WASM module exactly once (idempotent, concurrency-safe).
 *
 * In Node the WASM binary is resolved automatically from the installed
 * package. In environments without filesystem access (Cloudflare Workers),
 * pass an explicit `source` — typically the bound `.wasm` asset/module.
 */
export function ensureInit(source?: WasmSource | Promise<WasmSource>): Promise<void> {
  if (initPromise) return initPromise;
  initPromise = (async () => {
    const input = (await source) ?? (await loadDefaultWasm());
    await initWasm(input as never);
  })();
  // Allow a retry if init fails (e.g. a transient bound-asset fetch).
  initPromise.catch(() => {
    initPromise = null;
  });
  return initPromise;
}

/** Node-only fallback: resolve and read the packaged `index_bg.wasm`. */
async function loadDefaultWasm(): Promise<Uint8Array> {
  const specifier = "@resvg/resvg-wasm/index_bg.wasm";
  const resolved =
    typeof import.meta.resolve === "function"
      ? import.meta.resolve(specifier)
      : new URL(`../../node_modules/${specifier}`, import.meta.url).href;
  const [{ readFile }, { fileURLToPath }] = await Promise.all([
    import("node:fs/promises"),
    import("node:url"),
  ]);
  return new Uint8Array(await readFile(fileURLToPath(resolved)));
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
}

/**
 * Rasterize an SVG string to PNG bytes. `ensureInit()` must have resolved
 * first (the async `rasterize()` wrapper does this for you).
 *
 * System fonts are never loaded (determinism + build⟷edge parity); supply
 * `fontBuffers` for any text. Without them, text is dropped.
 */
export function rasterizeSvgSync(svg: string, opts: RasterizeSvgOptions): Uint8Array {
  const resvg = new Resvg(svg, {
    fitTo: { mode: "width", value: opts.width },
    ...(opts.background !== undefined ? { background: opts.background } : {}),
    font: {
      loadSystemFonts: false,
      fontBuffers: opts.fontBuffers ?? [],
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
