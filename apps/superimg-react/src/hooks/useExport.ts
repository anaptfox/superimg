//! React hook for video export

import { useState, useCallback } from "react";
import { exportToVideo, downloadBlob, type ExportConfig } from "superimg";

export interface UseExportReturn {
  /** Whether export is in progress */
  exporting: boolean;
  /** Export progress (0-1) */
  progress: number;
  /** Current status message */
  status: string | null;
  /** Export to MP4 and return the blob */
  exportMp4: (
    canvas: HTMLCanvasElement,
    config: ExportConfig,
    renderFrame: (frame: number) => Promise<void>
  ) => Promise<Blob | null>;
  /** Download a blob as a file */
  download: (blob: Blob, filename: string) => void;
}

/**
 * Hook for exporting video to MP4.
 *
 * @example
 * ```tsx
 * const { exporting, progress, exportMp4, download } = useExport();
 *
 * const handleExport = async () => {
 *   const blob = await exportMp4(canvas, config, renderFrame);
 *   if (blob) {
 *     download(blob, 'my-video.mp4');
 *   }
 * };
 * ```
 */
export function useExport(): UseExportReturn {
  const [exporting, setExporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState<string | null>(null);

  const exportMp4 = useCallback(async (
    canvas: HTMLCanvasElement,
    config: ExportConfig,
    renderFrame: (frame: number) => Promise<void>
  ): Promise<Blob | null> => {
    if (exporting) return null;

    setExporting(true);
    setProgress(0);
    setStatus("Starting export...");

    try {
      const blob = await exportToVideo(canvas, config, renderFrame, {
        onProgress: (frame, total) => {
          setProgress(frame / total);
        },
        onStatusChange: (message) => {
          setStatus(message);
        },
      });

      setStatus("Export complete!");
      return blob;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      setStatus(`Export failed: ${message}`);
      return null;
    } finally {
      setExporting(false);
    }
  }, [exporting]);

  const download = useCallback((blob: Blob, filename: string) => {
    downloadBlob(blob, filename);
  }, []);

  return {
    exporting,
    progress,
    status,
    exportMp4,
    download,
  };
}
