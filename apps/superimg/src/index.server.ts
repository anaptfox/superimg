//! SuperImg - Server-specific exports (Node.js, Bun, Deno)
//! Playwright-based rendering for server-side video generation

export * from "./index.shared.js";

// =============================================================================
// SERVER BUNDLER (esbuild native for template bundling)
// =============================================================================

export { bundleTemplate, bundleTemplateCode } from "@superimg/core/bundler";

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
export { createRenderPlan, executeRenderPlan } from "@superimg/core/engine";

// =============================================================================
// PLAYWRIGHT (server default engine)
// =============================================================================

export { PlaywrightEngine } from "@superimg/playwright";
export type { PlaywrightEngineOptions } from "@superimg/playwright";
