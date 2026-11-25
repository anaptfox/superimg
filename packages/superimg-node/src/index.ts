export {
  BrowserInstallError,
  BrowserLaunchDeniedError,
  BrowserNotInstalledError,
  chromiumHealth,
  RenderSession,
  checkBrowserStatus as getRuntimeStatus,
  createRenderSession,
  ensureBrowser as ensureRuntime,
  getBrowserInstallCommand as getRuntimeInstallCommand,
  installBrowser as installRuntime,
  isCI,
} from "@superimg/playwright";

export type {
  BrowserStatus as RuntimeStatus,
  BrowsersPathSource,
  EnsureBrowserOptions as EnsureRuntimeOptions,
  InstallOptions as InstallRuntimeOptions,
  RenderSessionEngine,
  RenderSessionOptions,
  RenderSessionRenderOptions,
} from "@superimg/playwright";

export type {
  Rasterizer,
  RenderEngine,
  RenderJob,
  RenderPlan,
  RenderProgress,
  VideoEncoder,
} from "@superimg/types";

export {
  CollectionExecutionError,
  loadCollectionEntries,
  type LoadCollectionEntriesOptions,
  type ResolvedEntry,
} from "./collection/index.js";

export {
  createNodeRuntimeAdapter,
  type NodeRuntimeAdapterOptions,
} from "./runtime/index.js";
export type {
  CompositionFrameCacheIdentity,
  CompositionFrameCacheOptions,
} from "./runtime/index.js";

export { doctor, setup } from "./doctor.js";
export type { DoctorReport, SetupOptions } from "@superimg/types";

export { inspectEncodedMedia } from "./narration-probe.js";

export { prepareNodeMediaExport, type PreparedNodeMediaExport } from "./runtime/index.js";
