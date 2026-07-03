//! Node resvg WASM init — auto-loads packaged WASM when source is omitted.

import { initWasm } from "@resvg/resvg-wasm";
import { loadDefaultWasm } from "./resvg-wasm-loader.node.js";
import type { WasmSource } from "./resvg-rasterizer.js";

let initPromise: Promise<void> | null = null;

export function nodeEnsureInit(
  source?: WasmSource | Promise<WasmSource>,
): Promise<void> {
  if (initPromise) return initPromise;
  initPromise = (async () => {
    const input = (await source) ?? (await loadDefaultWasm());
    await initWasm(input as never);
  })();
  initPromise.catch(() => {
    initPromise = null;
  });
  return initPromise;
}