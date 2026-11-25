//! SuperImg React - preview hooks and components (no compile/export graph).
"use client";

// =============================================================================
// PREVIEW HOOKS
// =============================================================================

export {
  usePlayerShortcuts,
  useTimeline,
  useCheckpoints,
  type UsePlayerShortcutsOptions,
  type UseTimelineReturn,
  type UseCheckpointsReturn,
} from "./hooks/preview.js";

// =============================================================================
// OTHER COMPONENTS
// =============================================================================

export { Timeline, type TimelineProps, type TimelineRef } from "./components/Timeline.js";
export { ChapterNav, type ChapterNavProps } from "./components/ChapterNav.js";
export { PlayButton, type PlayButtonProps } from "./components/PlayButton.js";
export { ExportButton, type ExportButtonProps } from "./components/ExportButton.js";
export { ExportDialog, type ExportDialogProps, type ExportOptions } from "./components/ExportDialog.js";
export { VideoControls, type VideoControlsProps } from "./components/VideoControls.js";
export { DataForm, type DataFormProps, type DataFormTheme } from "./components/DataForm.js";

// =============================================================================
// RE-EXPORTED TYPES
// =============================================================================

export type {
  RenderContext,
  MediaDefinition,
  CanvasSize,
  TemplateConfig,
  PlaybackMode,
  LoadMode,
  HoverBehavior,
  DriveSource,
  Checkpoint,
  Marker,
  MarkerPosition,
  AssetMeta,
  ImageAssetMeta,
  VideoAssetMeta,
  AudioAssetMeta,
  Stdlib,
} from "@superimg/types";

export type {
  PlayerOptions,
  PlayerInput,
  LoadResult,
} from "@superimg/player";

export type { RuntimeState, RuntimeStore } from "@superimg/media";
