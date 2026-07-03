import type { ExportOptions } from "./ExportDialog.js";

export interface ExportLayerState {
  exporting: boolean;
  exportProgress: number;
  exportMp4: (options?: ExportOptions) => Promise<Blob | null>;
  download: (blob: Blob, filename: string) => void;
}

export const noopExportLayer: ExportLayerState = {
  exporting: false,
  exportProgress: 0,
  exportMp4: async () => null,
  download: () => {},
};