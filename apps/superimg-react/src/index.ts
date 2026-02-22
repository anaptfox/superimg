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
  usePlayer,
  usePreview,
  useCompiler,
  useExport,
  useTimeline,
  useCheckpoints,
  useVideoSession,
  resolveFormat,
  type UsePlayerConfig,
  type UsePlayerReturn,
  type UsePreviewConfig,
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
} from "superimg";
