//! RSC stub — types only. Import hooks/components from @foxworth/superimg/react in Client Components.

export type { TimelineProps, TimelineRef } from "./components/Timeline.js";
export type { ChapterNavProps } from "./components/ChapterNav.js";
export type { PlayButtonProps } from "./components/PlayButton.js";
export type { ExportButtonProps } from "./components/ExportButton.js";
export type { ExportDialogProps, ExportOptions } from "./components/ExportDialog.js";
export type { VideoControlsProps } from "./components/VideoControls.js";
export type { DataFormProps, DataFormTheme } from "./components/DataForm.js";

export type {
  UsePlayerShortcutsOptions,
  UseTimelineReturn,
  UseCheckpointsReturn,
} from "./hooks/index.js";

export type {
  RenderContext,
  MediaDefinition,
  CanvasSize,
  TemplateConfig,
  PlaybackMode,
  LoadMode,
  HoverBehavior,
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

const MSG =
  '@foxworth/superimg/react is client-only. Use @foxworth/superimg/react/player in Server Components, or mark the file with "use client".';

function clientOnly(name: string, hint = MSG): never {
  throw new Error(`${name}: ${hint}`);
}

export const Timeline = () => clientOnly("Timeline");
export const ChapterNav = () => clientOnly("ChapterNav");
export const PlayButton = () => clientOnly("PlayButton");
export const ExportButton = () => clientOnly("ExportButton");
export const ExportDialog = () => clientOnly("ExportDialog");
export const VideoControls = () => clientOnly("VideoControls");
export const DataForm = () => clientOnly("DataForm");
export const usePlayerShortcuts = () => clientOnly("usePlayerShortcuts");
export const useTimeline = () => clientOnly("useTimeline");
export const useCheckpoints = () => clientOnly("useCheckpoints");
