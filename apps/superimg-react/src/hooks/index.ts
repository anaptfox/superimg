//! SuperImg React Hooks

export { useMediaQuery, useIsMobile } from "./useMediaQuery.js";
export { usePlayer, type UsePlayerConfig, type UsePlayerReturn } from "./usePlayer.js";
export { usePreview, type UsePreviewReturn, type RenderFn } from "./usePreview.js";
export { useCompiler, type UseCompilerReturn } from "./useCompiler.js";
export {
  useCompiledTemplate,
  clearTemplateCache,
  getTemplateCacheSize,
  type UseCompiledTemplateOptions,
  type UseCompiledTemplateReturn,
} from "./useCompiledTemplate.js";
export { useExport, type UseExportReturn } from "./useExport.js";
export { useTimeline, type UseTimelineReturn } from "./useTimeline.js";
export { useCheckpoints, type UseCheckpointsReturn } from "./useCheckpoints.js";
export {
  useVideoSession,
  type VideoSessionConfig,
  type VideoSessionReturn,
  type ExportOutput,
} from "./useVideoSession.js";

// Re-export FormatOption and resolveFormat from the browser package
export { resolveFormat, type FormatOption } from "superimg/browser";
