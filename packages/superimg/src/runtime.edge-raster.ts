//! Explicitly opt in to SVG-to-PNG rasterization on edge runtimes.
import { createRuntime } from "@superimg/core/runtime";
import { createEdgeRuntimeAdapter, type EdgeRuntimeAdapterOptions } from "@superimg/edge-runtime";
import { RuntimeCancelledError, type InitOptions, type Runtime } from "@superimg/types";

/** Initialize a runtime using caller-supplied resvg WASM. No asset is downloaded. */
export async function initEdgeRaster(
  wasm: NonNullable<EdgeRuntimeAdapterOptions["wasm"]>,
  options: InitOptions = {},
): Promise<Runtime> {
  if (options.signal?.aborted) throw new RuntimeCancelledError({ operation: "init" });
  const adapter = createEdgeRuntimeAdapter({ wasm, ...(options.defaultFonts !== undefined ? { defaultFonts: options.defaultFonts } : {}) });
  if (options.signal?.aborted) {
    await adapter.dispose();
    throw new RuntimeCancelledError({ operation: "init" });
  }
  return createRuntime(adapter, options);
}
