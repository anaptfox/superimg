//! SuperImg Player - SSR-safe entry point
//! Exports only the Player class and related types.
//! Does NOT include bundler, export, or other browser-global APIs.

export { Player, resolveFormat } from "@superimg/player";

export type {
  PlayerOptions,
  PlayerInput,
  PlayerEvents,
  LoadOptions,
  LoadResult,
  FormatOption,
} from "@superimg/player";

export type {
  PlaybackMode,
  LoadMode,
  HoverBehavior,
  TemplateModule,
  RenderContext,
  TemplateConfig,
} from "@superimg/types";
