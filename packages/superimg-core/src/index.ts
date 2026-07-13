//! SuperImg Core - Browser-safe primitives
//! Types, compilation, validation. NO html (use @superimg/core/html)

// Re-export types for convenience
export type {
  RenderContext,
  ImageRenderContext,
  SvgRenderContext,
  OutputInfo,
  FitMode,
  CssViewport,
  RenderOptions,
  Medium,
  AnyTemplateModule,
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
export * from "./rendering/create-render-context.js";
export * from "./rendering/runtime-info.js";
export * from "./shared/stdlib-capabilities.js";
export * from "./rendering/compiler.js";
export * from "./rendering/resolve-template.js";
export * from "./rendering/probe-phases.js";
// Bind Node ensureInit at package load (tsdown drops pure side-effect imports).
import { bindEnsureInit } from "./rendering/resvg-rasterizer.js";
import { nodeEnsureInit } from "./rendering/resvg-ensure-init.node.js";
bindEnsureInit(nodeEnsureInit);
export {
  ensureInit,
  rasterize,
  rasterizeSvgSync,
  ResvgRasterizer,
  bindEnsureInit,
} from "./rendering/resvg-rasterizer.js";
export type { WasmSource, RasterizeSvgOptions } from "./rendering/resvg-rasterizer.js";
export * from "./rendering/fonts.js";
export * from "./rendering/rasterizer-registry.js";
export * from "./shared/assets.js";
export * from "./shared/asset-metadata.js";
export * from "./rendering/checkpoint-resolver.js";
export * from "./html/sanitize.js";
export * from "./html/css.js";

// Scene composition
export { compose } from "./composition/compose.js";
export { scene } from "./composition/scene.js";
export { collectComposeAudio } from "./shared/assets.js";
export {
  resolveAudioTimeline,
  buildTimelineModel,
  mixAudioClips,
  normalizeAudioInput,
  ensureClipIds,
  inferAudioRole,
  sceneBoundariesFromResolved,
  interleaveStereo,
  TARGET_SAMPLE_RATE,
  TARGET_CHANNELS,
} from "./shared/assets.js";
export { transitions, renderWithTransition } from "./composition/transitions.js";
export { parseDuration } from "./shared/utils.js";
export { resolveAssetUrls } from "./rendering/engine.js";

// Edge rendering
export * from "./edge.js";
