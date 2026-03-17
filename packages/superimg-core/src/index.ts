//! SuperImg Core - Browser-safe primitives
//! Types, compilation, validation. NO html (use @superimg/core/html)

// Re-export types for convenience
export type {
  RenderContext,
  OutputInfo,
  FitMode,
  CssViewport,
  RenderOptions,
  TemplateModule,
  TemplateConfig,
  PlaybackMode,
  LoadMode,
  HoverBehavior,
  Checkpoint,
  CheckpointSource,
  Marker,
  MarkerPosition,
  // Scene composition types
  Duration,
  Transition,
  TransitionType,
  SceneDefinition,
  ResolvedScene,
  ResolvedTransition,
  ComposedTemplate,
} from "@superimg/types";

// Core functionality (browser-safe only)
export * from "./shared/constants.js";
export * from "./rendering/wasm.js";
export * from "./rendering/compiler.js";
export * from "./shared/assets.js";
export * from "./shared/asset-metadata.js";
export * from "./rendering/checkpoint-resolver.js";
export * from "./html/sanitize.js";
export * from "./html/css.js";

// Scene composition
export { compose } from "./composition/compose.js";
export { scene } from "./composition/scene.js";
export { transitions, renderWithTransition } from "./composition/transitions.js";
export { parseDuration } from "./shared/utils.js";
