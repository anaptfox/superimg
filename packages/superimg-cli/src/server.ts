//! Private server implementation exports used by superimg/server.

export { renderFromBundle } from "./render-from-bundle.js";
export type { ManifestEntry, RenderFromBundleOptions } from "./render-from-bundle.js";
export { renderDistributed } from "./render-distributed.js";
export type { DistributedRenderOptions } from "./render-distributed.js";
export type { Manifest } from "./container/handler.js";

export { bundleTemplate, bundleTemplateCode } from "@superimg/core/bundler";
export { extractTemplateMetadata } from "@superimg/core/template-metadata";
export { createRenderPlan, executeRenderPlan } from "@superimg/core/engine";
export { createRenderSession, RenderSession } from "@superimg/node";
export { PlaywrightEngine } from "@superimg/node/internal";
export type {
  PlaywrightEngineOptions,
} from "@superimg/node/internal";
export type {
  RenderSessionEngine,
  RenderSessionOptions,
  RenderSessionRenderOptions,
} from "@superimg/node";

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

export { resolveRenderTargets, buildRenderTarget } from "./cli/commands/render-targets.js";
export type { RenderOptions, RenderTarget, ResolvedTargets } from "./cli/commands/render-targets.js";
export { executeRenderTargets } from "./cli/commands/render-execute.js";
export type { ExecuteRenderOptions } from "./cli/commands/render-execute.js";
export { startDevServer } from "./dev-server.js";
export type { DevServerOptions, DevServer } from "./dev-server.js";
export { listVideos } from "./list-videos.js";
export type { VideoSummary } from "./list-videos.js";
export { discoverVideos, extractShortName, checkDuplicateVideoNames } from "./cli/utils/discover-videos.js";
export type { DiscoveredVideo } from "./cli/utils/discover-videos.js";
export { RENDER_EVENT_VERSION } from "@superimg/types";
export type { RenderEvent } from "@superimg/types";
export { renderTemplates } from "./render-templates.js";
export type { RenderTemplatesOptions } from "./render-templates.js";
