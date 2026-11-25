//! SuperImg React Player - SSR-safe entry point
//! Only exports the Player component and its types.
//! Import from "@foxworth/superimg/react/player" instead of "@foxworth/superimg/react" for SSR compatibility.
"use client";

export {
  PassivePlayer as Player,
  type PassivePlayerProps as PlayerProps,
  type PlayerRef,
} from "./components/PassivePlayer.js";

export type {
  RenderContext,
  TemplateConfig,
  PlaybackMode,
  LoadMode,
  HoverBehavior,
} from "@superimg/types";

export type { PlayerInput, LoadResult } from "@superimg/player";

export type { MediaDefinition, CanvasSize } from "@superimg/types";
