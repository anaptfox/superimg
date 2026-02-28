//! SuperImg React - Hooks and components for React applications
//! Player component, timeline, preview, and video session hooks

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
  usePlayer,
  usePreview,
  useCompiler,
  useExport,
  useTimeline,
  useCheckpoints,
  useVideoSession,
  type UsePlayerConfig,
  type UsePlayerReturn,
  type UsePreviewReturn,
  type UseCompilerReturn,
  type UseExportReturn,
  type UseTimelineReturn,
  type UseCheckpointsReturn,
  type VideoSessionConfig,
  type VideoSessionReturn,
  type FormatOption,
  type ExportOutput,
  type RenderFn,
} from "./hooks/index.js";

// =============================================================================
// OTHER COMPONENTS
// =============================================================================

export { Preview, type PreviewProps, type PreviewRef } from "./components/Preview.js";
export { Timeline, type TimelineProps, type TimelineRef } from "./components/Timeline.js";
export { VideoCanvas, type VideoCanvasProps } from "./components/VideoCanvas.js";
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
  PlayerConfig,
  PlayerState,
  PlayerStore,
  PlayerOptions,
  PlayerInput,
  LoadResult,
  
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
  
  // Stdlib
  Stdlib,
} from "superimg/browser";
