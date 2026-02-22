//! SuperImg Core - Environment-agnostic primitives
//! Types, compilation, and validation utilities

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

// Core functionality (browser-safe)
export * from "./constants.js";
export * from "./html.js";
export * from "./wasm.js";
export * from "./compiler.js";
export * from "./template-metadata.js";
export * from "./assets.js";
export * from "./checkpoint-resolver.js";
