import {
  edgeEnsureInit,
  rasterizeSvgSync,
  type WasmSource,
} from "@superimg/core/rendering/resvg-rasterizer.edge";
import {
  createEdgeRuntimeAdapterBase,
  type EdgeRuntimeAdapterOptions as EdgeRuntimeAdapterBaseOptions,
  type EdgeSvgRasterizer,
} from "./adapter-base.js";

export interface EdgeRuntimeAdapterOptions {
  readonly fetch?: EdgeRuntimeAdapterBaseOptions["fetch"];
  readonly wasm?: WasmSource | Promise<WasmSource>;
  readonly defaultFonts?: EdgeRuntimeAdapterBaseOptions["defaultFonts"];
}

/** Create the optional resvg-backed private edge adapter. */
export function createEdgeRuntimeAdapter(options: EdgeRuntimeAdapterOptions = {}) {
  const svgRasterizer = options.wasm === undefined
    ? undefined
    : createResvgRasterizer(options.wasm);
  return createEdgeRuntimeAdapterBase({
    ...(options.fetch !== undefined ? { fetch: options.fetch } : {}),
    ...(options.defaultFonts !== undefined ? { defaultFonts: options.defaultFonts } : {}),
    ...(svgRasterizer !== undefined ? { svgRasterizer } : {}),
  });
}

function createResvgRasterizer(
  wasm: WasmSource | Promise<WasmSource>,
): EdgeSvgRasterizer {
  return Object.freeze({
    prepare: () => edgeEnsureInit(wasm),
    async rasterize(svg, options) {
      await edgeEnsureInit(wasm);
      return rasterizeSvgSync(svg, {
        width: options.width,
        height: options.height,
        fontBuffers: [...options.fontBuffers],
        defaultFontFamily: "Inter",
      });
    },
  });
}
