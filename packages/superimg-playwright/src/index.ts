//! SuperImg Playwright - Server-side rendering via Playwright
//! Headless browser-based video rendering with engine + adapters

// Engine (primary export)
export { PlaywrightEngine } from "./playwright-engine.js";
export type { PlaywrightEngineOptions } from "./playwright-engine.js";

// Adapters (advanced use)
export { PlaywrightFrameRenderer, PlaywrightVideoEncoder } from "./adapters.js";

// Browser management
export {
  checkBrowserStatus,
  ensureBrowser,
  installBrowser,
  getBrowserInstallCommand,
  isCI,
  BrowserNotInstalledError,
  BrowserInstallError,
} from "./browser-utils.js";
export type {
  BrowserStatus,
  EnsureBrowserOptions,
  InstallOptions,
} from "./browser-utils.js";
