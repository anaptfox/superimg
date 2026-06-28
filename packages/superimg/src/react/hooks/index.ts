//! SuperImg React Hooks

export { useMediaQuery, useIsMobile } from "./useMediaQuery.js";
export { useCompiler, type UseCompilerReturn } from "./useCompiler.js";
export {
  useCompiledTemplate,
  clearTemplateCache,
  getTemplateCacheSize,
  type UseCompiledTemplateOptions,
  type UseCompiledTemplateReturn,
} from "./useCompiledTemplate.js";
export {
  usePlaygroundCatalog,
  type PlaygroundCatalogEntry,
  type PlaygroundCategory,
  type PlaygroundCategoryId,
  type PlaygroundManifest,
  type PlaygroundMeta,
  type UsePlaygroundCatalogOptions,
  type UsePlaygroundCatalogReturn,
} from "./usePlaygroundCatalog.js";
export {
  usePlaygroundExport,
  type UsePlaygroundExportOptions,
} from "./usePlaygroundExport.js";
export {
  usePlayerSession,
  type UsePlayerSessionOptions,
  type UsePlayerSessionReturn,
} from "./usePlayerSession.js";
export {
  usePlayerShortcuts,
  type UsePlayerShortcutsOptions,
} from "./usePlayerShortcuts.js";
export {
  checkBrowserCompileSupport,
  type BrowserCompileSupport,
} from "./checkBrowserCompileSupport.js";
export { useExport, type UseExportReturn } from "./useExport.js";
export { useTimeline, type UseTimelineReturn } from "./useTimeline.js";
export { useCheckpoints, type UseCheckpointsReturn } from "./useCheckpoints.js";

// Re-export FormatOption and resolveFormat from the browser package
export { resolveFormat, type FormatOption } from "../../index.browser.js";
