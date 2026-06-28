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
  UseCompilerReturn,
  UseCompiledTemplateOptions,
  UseCompiledTemplateReturn,
  PlaygroundCatalogEntry,
  PlaygroundCategory,
  PlaygroundCategoryId,
  PlaygroundManifest,
  PlaygroundMeta,
  UsePlaygroundCatalogOptions,
  UsePlaygroundCatalogReturn,
  UsePlaygroundExportOptions,
  UsePlayerSessionOptions,
  UsePlayerSessionReturn,
  UsePlayerShortcutsOptions,
  BrowserCompileSupport,
  UseExportReturn,
  UseTimelineReturn,
  UseCheckpointsReturn,
  FormatOption,
} from "./hooks/index.js";

export type { FieldSchema, FieldType } from "./utils/inferSchema.js";

export type {
  RenderContext,
  TemplateModule,
  TemplateConfig,
  PlayerOptions,
  PlayerInput,
  LoadResult,
  RuntimeState,
  RuntimeStore,
  PlaybackMode,
  LoadMode,
  HoverBehavior,
  Checkpoint,
  Marker,
  MarkerPosition,
  CompileError,
  CompileResult,
  ComposedTemplate,
  ResolvedScene,
  AssetMeta,
  ImageAssetMeta,
  VideoAssetMeta,
  AudioAssetMeta,
  Stdlib,
} from "../index.browser.js";

const MSG =
  "superimg/react is client-only. Use superimg/react/player in Server Components, or mark the file with \"use client\".";

function clientOnly(name: string): never {
  throw new Error(`${name}: ${MSG}`);
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
export const useCompiler = () => clientOnly("useCompiler");
export const useCompiledTemplate = () => clientOnly("useCompiledTemplate");
export const clearTemplateCache = () => clientOnly("clearTemplateCache");
export const getTemplateCacheSize = () => clientOnly("getTemplateCacheSize");
export const usePlaygroundCatalog = () => clientOnly("usePlaygroundCatalog");
export const usePlaygroundExport = () => clientOnly("usePlaygroundExport");
export const usePlayerSession = () => clientOnly("usePlayerSession");
export const usePlayerShortcuts = () => clientOnly("usePlayerShortcuts");
export const checkBrowserCompileSupport = () => clientOnly("checkBrowserCompileSupport");
export const useExport = () => clientOnly("useExport");
export const useTimeline = () => clientOnly("useTimeline");
export const useCheckpoints = () => clientOnly("useCheckpoints");
export const inferSchema = () => clientOnly("inferSchema");
export const inferFieldType = () => clientOnly("inferFieldType");
export const humanizeKey = () => clientOnly("humanizeKey");
export const getFieldKeys = () => clientOnly("getFieldKeys");
export const getNestedValue = () => clientOnly("getNestedValue");
export const setNestedValue = () => clientOnly("setNestedValue");
export const isComposedTemplate = () => clientOnly("isComposedTemplate");