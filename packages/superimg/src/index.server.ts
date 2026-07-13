//! SuperImg - Server-specific exports (Node.js, Bun, Deno)
//! Playwright-based rendering for server-side video generation

export * from "./index.shared.js";

// Server-only core utilities intentionally excluded from the root authoring API.
export {
  createRenderContext,
  createImageRenderContext,
  createSvgRenderContext,
  resolveRuntimeTemplateInfo,
  compileTemplate,
  validateTemplate,
  CheckpointResolver,
  transitions,
  parseDuration,
} from "@superimg/core";
export { buildCompositeHtml } from "@superimg/core/html";

// =============================================================================
// SERVER BUNDLER (rolldown for template bundling)
// =============================================================================

export { bundleTemplate, bundleTemplateCode } from "@superimg/cli/server";
export { extractTemplateMetadata } from "@superimg/cli/server";

// =============================================================================
// ENGINE (from core + types)
// =============================================================================

export type {
  FrameRenderer,
  VideoEncoder,
  RenderEngine,
  RenderPlan,
  RenderJob,
  RenderProgress,
} from "@superimg/types";
export { createRenderPlan, executeRenderPlan } from "@superimg/cli/server";

// =============================================================================
// HIGH-LEVEL API
// =============================================================================

export { renderVideo } from "@superimg/cli/server";
export { renderBatch } from "@superimg/cli/server";
export { loadTemplate } from "@superimg/cli/server";
export type { RenderVideoOptions } from "@superimg/cli/server";
export type {
  RenderBatchOptions,
  RenderBatchResultEntry,
  BatchProgressEvent,
} from "@superimg/cli/server";
export type { LoadedTemplate, LoadedTemplateRenderOptions } from "@superimg/cli/server";

export { startDevServer } from "@superimg/cli/server";
export type { DevServerOptions, DevServer } from "@superimg/cli/server";
export { listVideos } from "@superimg/cli/server";
export type { VideoSummary } from "@superimg/cli/server";

// =============================================================================
// BUILD TOOL INTEGRATION
// =============================================================================

export { discoverVideos, extractShortName, checkDuplicateVideoNames } from "@superimg/cli/server";
export type { DiscoveredVideo } from "@superimg/cli/server";
export { RENDER_EVENT_VERSION } from "@superimg/cli/server";
export type { RenderEvent } from "@superimg/cli/server";
export { renderTemplates } from "@superimg/cli/server";
export type { RenderTemplatesOptions } from "@superimg/cli/server";
export { resolveRenderTargets, buildRenderTarget, executeRenderTargets } from "@superimg/cli/server";
export type { RenderOptions, RenderTarget, ResolvedTargets, ExecuteRenderOptions } from "@superimg/cli/server";
