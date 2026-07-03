//! SuperImg browser export/capture — opt-in (snapdom + mediabunny).
//! Import from "superimg/export" for client-side MP4 encoding.

export {
  CanvasRenderer,
  exportToVideo,
  downloadBlob,
  get2DContext,
  BrowserRenderer,
  BrowserEncoder,
} from "@superimg/runtime";

export type { ExportConfig, ExportOptions } from "@superimg/runtime";