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
} from "@superimg/types";

// Core functionality (browser-safe only)
export * from "./constants.js";
export * from "./wasm.js";
export * from "./compiler.js";
export * from "./assets.js";
export * from "./asset-metadata.js";
export * from "./checkpoint-resolver.js";
export * from "./sanitize.js";
export * from "./css.js";
