//! Probe whether in-browser WASM compilation is available (requires COI).

export interface BrowserCompileSupport {
  supported: boolean;
  reason?: string;
}

export function checkBrowserCompileSupport(): BrowserCompileSupport {
  if (typeof globalThis === "undefined") {
    return { supported: false, reason: "Not in a browser environment" };
  }
  if (globalThis.crossOriginIsolated === false) {
    return {
      supported: false,
      reason:
        "In-browser compilation requires cross-origin isolation (COOP + COEP headers).",
    };
  }
  return { supported: true };
}