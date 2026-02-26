//! SuperImg - Browser-specific exports
//! Player, runtime rendering, and playback utilities for client-side usage

export * from "./index.shared.js";

// =============================================================================
// BROWSER BUNDLER (esbuild-wasm for template compilation)
// =============================================================================

export { initBundler, bundleTemplateBrowser } from "@superimg/core/bundler-browser";

// =============================================================================
// PLAYER (main browser export)
// =============================================================================

export { Player, HtmlPresenter, CanvasPresenter } from "@superimg/player";

// =============================================================================
// RUNTIME (for advanced usage)
// =============================================================================

export {
  CanvasRenderer,
  exportToVideo,
  downloadBlob,
  get2DContext,
  BrowserRenderer,
  BrowserEncoder,
} from "@superimg/runtime";

// =============================================================================
// PLAYER UTILITIES
// =============================================================================

export {
  createPlaybackController,
  createTimelineController,
  formatTime,
} from "@superimg/player";

// Runtime types
export type {
  ExportConfig,
  ExportOptions,
} from "@superimg/runtime";

// Player types
export type {
  PlaybackController,
  PlaybackCallbacks,
  TimelineController,
  TimelineElements,
  LoadOptions,
} from "@superimg/player";
