//! SuperImg React preview hooks — no compile/export graph.
//! Only hooks whose static import graph is free of the bundler (rolldown) and
//! the export stack (mediabunny / snapdom). The compile/export hooks live in
//! "./index.js". Browser export lives in @superimg/browser-export.

export { useMediaQuery, useIsMobile } from "./useMediaQuery.js";
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
  usePlayerShortcuts,
  type UsePlayerShortcutsOptions,
} from "./usePlayerShortcuts.js";
export { useTimeline, type UseTimelineReturn } from "./useTimeline.js";
export { useCheckpoints, type UseCheckpointsReturn } from "./useCheckpoints.js";

// resolveFormat / FormatOption come from the (export-free) browser barrel.
export { resolveFormat, type FormatOption } from "../../index.browser.js";
