//! SuperImg - Browser-specific exports
//! Runtime-web, Player, rendering, and export utilities for client-side usage

export * from "./index.shared.js";

// =============================================================================
// PLAYER (main browser export)
// =============================================================================

export { Player, resolveFormat } from "@superimg/player";

// =============================================================================
// RUNTIME-WEB (canonical display runtime)
// =============================================================================

export { createRuntime, mount } from "@superimg/runtime-web";

// =============================================================================
// EXPORT/CAPTURE RUNTIME (advanced usage)
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
  formatTime,
} from "@superimg/player";

// Runtime-web types
export type {
  RuntimeInput,
  RuntimeOptions,
  RuntimeUpdate,
  RuntimeState,
  RuntimeEvents,
  RuntimeStore,
  RuntimeRenderedPayload,
  RuntimePlaybackMode,
  WebRuntime,
} from "@superimg/runtime-web";

// Export/capture runtime types
export type {
  ExportConfig,
  ExportOptions,
} from "@superimg/runtime";

// Player types
export type {
  LoadOptions,
  FormatOption,
  PlayerOptions,
  PlayerEvents,
  PlayerInput,
  PlayerUpdate,
  LoadResult,
} from "@superimg/player";
