//! SuperImg React - Hooks and components for React applications
//! Player component, timeline, and session hooks
"use client";

// =============================================================================
// PLAYER COMPONENT (main export)
// =============================================================================

export { Player, type PlayerProps, type PlayerRef } from "./components/Player.js";

// =============================================================================
// HOOKS
// =============================================================================

export {
  useMediaQuery,
  useIsMobile,
  useCompiler,
  useCompiledTemplate,
  clearTemplateCache,
  getTemplateCacheSize,
  usePlaygroundCatalog,
  usePlaygroundExport,
  usePlayerSession,
  usePlayerShortcuts,
  checkBrowserCompileSupport,
  useExport,
  useTimeline,
  useCheckpoints,
  type UseCompilerReturn,
  type UseCompiledTemplateOptions,
  type UseCompiledTemplateReturn,
  type PlaygroundCatalogEntry,
  type PlaygroundCategory,
  type PlaygroundCategoryId,
  type PlaygroundManifest,
  type PlaygroundMeta,
  type UsePlaygroundCatalogOptions,
  type UsePlaygroundCatalogReturn,
  type UsePlaygroundExportOptions,
  type UsePlayerSessionOptions,
  type UsePlayerSessionReturn,
  type UsePlayerShortcutsOptions,
  type BrowserCompileSupport,
  type UseExportReturn,
  type UseTimelineReturn,
  type UseCheckpointsReturn,
  type FormatOption,
} from "./hooks/index.js";

// =============================================================================
// OTHER COMPONENTS
// =============================================================================

export { Timeline, type TimelineProps, type TimelineRef } from "./components/Timeline.js";
export { ChapterNav, type ChapterNavProps } from "./components/ChapterNav.js";
export { PlayButton, type PlayButtonProps } from "./components/PlayButton.js";
export { ExportButton, type ExportButtonProps } from "./components/ExportButton.js";
export { ExportDialog, type ExportDialogProps, type ExportOptions } from "./components/ExportDialog.js";
export { FormatSelector, type FormatSelectorProps, type FormatPreset } from "./components/FormatSelector.js";
export { VideoControls, type VideoControlsProps } from "./components/VideoControls.js";
export { DataForm, type DataFormProps, type DataFormTheme } from "./components/DataForm.js";

// =============================================================================
// UTILITIES
// =============================================================================

export {
  inferSchema,
  inferFieldType,
  humanizeKey,
  getFieldKeys,
  getNestedValue,
  setNestedValue,
  type FieldSchema,
  type FieldType,
} from "./utils/inferSchema.js";

// =============================================================================
// RE-EXPORTED TYPES
// =============================================================================

export type {
  // Context types
  RenderContext,
  TemplateModule,
  TemplateConfig,

  // Player types
  PlayerOptions,
  PlayerInput,
  LoadResult,
  RuntimeState,
  RuntimeStore,

  // Mode types
  PlaybackMode,
  LoadMode,
  HoverBehavior,

  // Checkpoint types
  Checkpoint,
  Marker,
  MarkerPosition,

  // Compiler types
  CompileError,
  CompileResult,

  // Composition types
  ComposedTemplate,
  ResolvedScene,

  // Asset types
  AssetMeta,
  ImageAssetMeta,
  VideoAssetMeta,
  AudioAssetMeta,

  // Stdlib
  Stdlib,
} from "../index.browser.js";

// Type guards
export { isComposedTemplate } from "../index.browser.js";
