//! SuperImg React - preview hooks and components (no compile/export graph).
"use client";

// =============================================================================
// PLAYER COMPONENT (main export)
// =============================================================================

export { Player, type PlayerProps, type PlayerRef } from "./components/Player.js";

// =============================================================================
// PREVIEW HOOKS
// =============================================================================

export {
  useMediaQuery,
  useIsMobile,
  usePlaygroundCatalog,
  usePlayerShortcuts,
  useTimeline,
  useCheckpoints,
  type PlaygroundCatalogEntry,
  type PlaygroundCategory,
  type PlaygroundCategoryId,
  type PlaygroundManifest,
  type PlaygroundMeta,
  type UsePlaygroundCatalogOptions,
  type UsePlaygroundCatalogReturn,
  type UsePlayerShortcutsOptions,
  type UseTimelineReturn,
  type UseCheckpointsReturn,
  type FormatOption,
} from "./hooks/preview.js";

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
  RenderContext,
  TemplateModule,
  TemplateConfig,
  PlaybackMode,
  LoadMode,
  HoverBehavior,
  Checkpoint,
  Marker,
  MarkerPosition,
  ComposedTemplate,
  ResolvedScene,
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
} from "../index.player.js";

export type { RuntimeState, RuntimeStore } from "@superimg/media";

export { isComposedTemplate } from "@superimg/types";
