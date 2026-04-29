//! Private server implementation exports used by superimg/server.

export { bundleTemplate, bundleTemplateCode } from "@superimg/core/bundler";
export { extractTemplateMetadata } from "@superimg/core/template-metadata";
export { createRenderPlan, executeRenderPlan } from "@superimg/core/engine";
export { PlaywrightEngine } from "@superimg/playwright";
export type { PlaywrightEngineOptions } from "@superimg/playwright";

export type {
  FrameRenderer,
  VideoEncoder,
  RenderEngine,
  RenderPlan,
  RenderJob,
  RenderProgress,
} from "@superimg/types";

export { renderVideo } from "./render-video.js";
export { renderBatch } from "./render-batch.js";
export { loadTemplate } from "./load-template.js";
export type { RenderVideoOptions } from "./render-video.js";
export type {
  RenderBatchOptions,
  RenderBatchResultEntry,
  BatchProgressEvent,
} from "./render-batch.js";
export type { LoadedTemplate, LoadedTemplateRenderOptions } from "./load-template.js";
