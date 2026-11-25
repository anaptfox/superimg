//! SuperImg Playwright - Server-side rendering via Playwright
//! Headless browser-based video rendering with engine + adapters

// Engine (primary export)
export { PlaywrightEngine } from "./playwright-engine.js";
export type { PlaywrightEngineOptions } from "./playwright-engine.js";
export { createRenderSession, RenderSession } from "./render-session.js";
export type {
  RenderSessionEngine,
  RenderSessionOptions,
  RenderSessionRenderOptions,
} from "./render-session.js";

// Adapters (advanced use)
export { PlaywrightRasterizer } from "./adapters.js";
export { FfmpegGifEncoder } from "./ffmpeg-gif-encoder.js";
export { NodeVideoEncoder } from "./node-encoder.js";
export type { CapturedFrame, RawRgbaFrame } from "./encoder-frame.js";
export { resolveNodeVideoQualityOptions, resolveNodeAudioQualityOptions } from "./encoder-quality.js";
export { SharpStillEncoder } from "./sharp-still-encoder.js";
export type { StillFormat } from "./sharp-still-encoder.js";
export { AssetRegistry, openRegisteredAsset, parseRangeHeader } from "./asset-server.js";
export type { AssetResponse, ByteRange, OpenAssetOptions, ParseRangeResult } from "./asset-server.js";

// Browser management
export {
  checkBrowserStatus,
  chromiumHealth,
  chromiumLaunchError,
  ensureBrowser,
  installBrowser,
  getBrowserInstallCommand,
  isCI,
  BrowserNotInstalledError,
  BrowserLaunchDeniedError,
  BrowserInstallError,
} from "./browser-utils.js";
export type {
  BrowserStatus,
  BrowsersPathSource,
  EnsureBrowserOptions,
  InstallOptions,
} from "./browser-utils.js";
export {
  applyBrowsersDirectory,
  resolveBrowsersDirectory,
} from "./runtime-path.js";
