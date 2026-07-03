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
