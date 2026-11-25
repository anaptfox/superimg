//! Node Chromium install and the doctor report shared with `@foxworth/superimg/runtime`.

import {
  chromiumHealth,
  ensureBrowser,
  checkBrowserStatus,
} from "@superimg/playwright";
import {
  RuntimeCancelledError,
  type DoctorReport,
  type SetupOptions,
} from "@superimg/types";
import { nodeEncoderAvailability } from "./runtime/adapter.js";

export async function doctor(): Promise<DoctorReport> {
  const status = await checkBrowserStatus();
  const chromium = chromiumHealth(status);
  return {
    ok: chromium.status === "ok",
    chromium,
    encoders: nodeEncoderAvailability(),
  };
}

/** Install Chromium when it is missing, then return a doctor report. */
export async function setup(options: SetupOptions = {}): Promise<DoctorReport> {
  if (options.signal?.aborted) throw new RuntimeCancelledError({ operation: "setup" });
  await ensureBrowser({
    autoInstall: true,
    ...(options.onProgress !== undefined ? { onProgress: options.onProgress } : {}),
  });
  if (options.signal?.aborted) throw new RuntimeCancelledError({ operation: "setup" });
  return doctor();
}
