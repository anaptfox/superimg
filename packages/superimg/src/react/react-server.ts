//! RSC stub — types only. Import hooks/components from superimg/react in Client Components.

export type { PlayerProps, PlayerRef } from "./components/Player.js";
export type { TimelineProps, TimelineRef } from "./components/Timeline.js";
export type { ChapterNavProps } from "./components/ChapterNav.js";
export type { PlayButtonProps } from "./components/PlayButton.js";
export type { ExportButtonProps } from "./components/ExportButton.js";
export type { ExportDialogProps, ExportOptions } from "./components/ExportDialog.js";
export type { FormatSelectorProps, FormatPreset } from "./components/FormatSelector.js";
export type { VideoControlsProps } from "./components/VideoControls.js";
export type { DataFormProps, DataFormTheme } from "./components/DataForm.js";

export type {
  PlaygroundCatalogEntry,
  PlaygroundCategory,
  PlaygroundCategoryId,
  PlaygroundManifest,
  PlaygroundMeta,
  UsePlaygroundCatalogOptions,
  UsePlaygroundCatalogReturn,
  UsePlayerShortcutsOptions,
  UseTimelineReturn,
  UseCheckpointsReturn,
  FormatOption,
} from "./hooks/index.js";

export type { FieldSchema, FieldType } from "./utils/inferSchema.js";

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

const MSG =
  'superimg/react is client-only. Use superimg/react/player in Server Components, or mark the file with "use client".';

const COMPILE_MSG =
  'Import compile hooks from "superimg/react/compile" in a Client Component.';

const EXPORT_MSG =
  'Use @superimg/browser-export in a Client Component.';

function clientOnly(name: string, hint = MSG): never {
  throw new Error(`${name}: ${hint}`);
}

export const Player = () => clientOnly("Player");
export const Timeline = () => clientOnly("Timeline");
export const ChapterNav = () => clientOnly("ChapterNav");
export const PlayButton = () => clientOnly("PlayButton");
export const ExportButton = () => clientOnly("ExportButton");
export const ExportDialog = () => clientOnly("ExportDialog");
export const FormatSelector = () => clientOnly("FormatSelector");
export const VideoControls = () => clientOnly("VideoControls");
export const DataForm = () => clientOnly("DataForm");
export const useMediaQuery = () => clientOnly("useMediaQuery");
export const useIsMobile = () => clientOnly("useIsMobile");
export const usePlaygroundCatalog = () => clientOnly("usePlaygroundCatalog");
export const usePlayerShortcuts = () => clientOnly("usePlayerShortcuts");
export const useTimeline = () => clientOnly("useTimeline");
export const useCheckpoints = () => clientOnly("useCheckpoints");
export const inferSchema = () => clientOnly("inferSchema");
export const inferFieldType = () => clientOnly("inferFieldType");
export const humanizeKey = () => clientOnly("humanizeKey");
export const getFieldKeys = () => clientOnly("getFieldKeys");
export const getNestedValue = () => clientOnly("getNestedValue");
export const setNestedValue = () => clientOnly("setNestedValue");
export const isComposedTemplate = () => clientOnly("isComposedTemplate");
