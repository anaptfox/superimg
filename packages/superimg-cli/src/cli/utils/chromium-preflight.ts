//! Fail closed when Playwright Chromium is missing (export / inspect --png).

import {
  BrowserLaunchDeniedError,
  BrowserNotInstalledError,
  chromiumHealth,
  getRuntimeStatus,
} from "@superimg/node";

export async function assertChromiumRuntime(): Promise<void> {
  const status = await getRuntimeStatus();
  const chromium = chromiumHealth(status);
  if (chromium.status === "ok") return;
  if (chromium.status === "launch-denied") {
    throw new BrowserLaunchDeniedError({ browsersPath: chromium.browsersPath });
  }
  throw new BrowserNotInstalledError({ browsersPath: chromium.browsersPath });
}
