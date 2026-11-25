//! Browser binder for `@foxworth/superimg/runtime`.

import { createBrowserRuntimeAdapter } from "@superimg/browser-export/runtime";
import { bindRuntimeApi, createRuntime } from "@superimg/core/runtime";
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
  const adapter = createBrowserRuntimeAdapter({
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
