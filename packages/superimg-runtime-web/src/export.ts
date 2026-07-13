//! Compatibility export surface. Browser export execution is owned by
//! @superimg/browser-export so cancellation and cleanup have one implementation.

export {
  downloadBlob,
  exportImageDataToVideo,
  exportToVideo,
} from "@superimg/browser-export";
export type { ExportConfig, ExportOptions } from "@superimg/browser-export";
