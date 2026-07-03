//! SuperImg React export hooks — opt-in client-side MP4 encoding.
//! Import from "superimg/react/export" (pulls mediabunny via superimg/export).
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
export type { RuntimeStore } from "@superimg/runtime-web";