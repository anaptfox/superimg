//! Edge/workerd-safe resvg WASM init — explicit source required.

import { initWasm } from "@resvg/resvg-wasm";
import type { WasmSource } from "./resvg-rasterizer.js";

let initPromise: Promise<void> | null = null;

export function edgeEnsureInit(
  source?: WasmSource | Promise<WasmSource>,
): Promise<void> {
  if (initPromise) return initPromise;
  initPromise = (async () => {
    if (source === undefined) {
      throw new Error(
        "ensureInit requires an explicit WASM source in workerd/edge environments. " +
          "Pass resvg WASM bytes or a bound module via ensureInit(wasm) or ResvgRasterizer({ wasm }).",
      );
    }
    const input = await source;
    await initWasm(input as never);
  })();
  initPromise.catch(() => {
    initPromise = null;
  });
  return initPromise;
}