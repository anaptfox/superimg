//! SuperImg React session hooks — published as "superimg/react/session".
//! Kept off the main "superimg/react" entry so its export stack
//! (mediabunny / snapdom) doesn't bloat preview-only consumers.
"use client";

export { useExport, type UseExportReturn } from "./hooks/useExport.js";
export {
  usePlaygroundExport,
  type UsePlaygroundExportOptions,
} from "./hooks/usePlaygroundExport.js";
export {
  usePlayerSession,
  type UsePlayerSessionOptions,
  type UsePlayerSessionReturn,
} from "./hooks/usePlayerSession.js";

export type { ExportOptions } from "./components/ExportDialog.js";

export type {
  EncodingOptions,
  TemplateModule,
  ComposedTemplate,
} from "@superimg/types";

export type { FormatOption } from "../index.player.js";
export type { RuntimeStore } from "@superimg/media";
