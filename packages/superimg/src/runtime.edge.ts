//! Edge/workerd binder for `@foxworth/superimg/runtime`.

import { bindRuntimeApi, createRuntime } from "@superimg/core/runtime";
import { createEdgeDocumentRuntimeAdapter } from "@superimg/edge-runtime/document";
import {
  CapabilityUnavailableError,
  RuntimeCancelledError,
  type DoctorReport,
  type InitOptions,
  type Runtime,
  type SetupOptions,
} from "@superimg/types";

export * from "./runtime.shared.js";

export async function prepareNativeSurface(_options: import("./runtime.shared.js").NativeSurfacePreparationOptions): Promise<import("./runtime.shared.js").NativeSurfacePreparation> {
  throw new CapabilityUnavailableError("prepareNativeSurface");
}

export async function setup(_options?: SetupOptions): Promise<DoctorReport> {
  throw new CapabilityUnavailableError("setup");
}

export async function doctor(): Promise<DoctorReport> {
  throw new CapabilityUnavailableError("doctor");
}

export async function init(options: InitOptions = {}): Promise<Runtime> {
  if (options.signal?.aborted) throw new RuntimeCancelledError({ operation: "init" });
  // The public edge binder is document-only. Importing a packaged `.wasm`
  // asset here would force every HTML-only host to provide a bundler-specific
  // WASM loader. The private adapter still advertises SVG-to-PNG when a host
  // explicitly constructs it with a resvg WASM source.
  const adapter = createEdgeDocumentRuntimeAdapter({
    ...(options.defaultFonts !== undefined ? { defaultFonts: options.defaultFonts } : {}),
  });
  if (options.signal?.aborted) {
    await adapter.dispose();
    throw new RuntimeCancelledError({ operation: "init" });
  }
  return createRuntime(adapter, options);
}

export const {
  check,
  inspect,
  inspectFile,
  render,
  renderResponse,
  exportMedia,
  startExport,
  startConversion,
  shutdown,
} = bindRuntimeApi(init);
