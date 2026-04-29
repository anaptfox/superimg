//! SuperImg - Server-specific exports (Node.js, Bun, Deno)
//! Playwright-based rendering for server-side video generation

export * from "./index.shared.js";

// =============================================================================
// SERVER BUNDLER (esbuild native for template bundling)
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
// PLAYWRIGHT (server default engine)
// =============================================================================

export { PlaywrightEngine } from "@superimg/cli/server";
export type { PlaywrightEngineOptions } from "@superimg/cli/server";

// =============================================================================
// HIGH-LEVEL API
// =============================================================================

export { renderVideo } from "@superimg/cli/server";
export { loadTemplate } from "@superimg/cli/server";
export type { RenderVideoOptions } from "@superimg/cli/server";
export type { LoadedTemplate, LoadedTemplateRenderOptions } from "@superimg/cli/server";
