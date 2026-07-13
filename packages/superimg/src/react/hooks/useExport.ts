//! React hook for video export

import { useState, useCallback, useEffect, useRef } from "react";
import type { ExportConfig } from "@superimg/browser-export";

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
  /** Cancel the active export. */
  cancel: () => void;
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
  const controllerRef = useRef<AbortController | null>(null);

  useEffect(() => () => controllerRef.current?.abort(), []);

  const exportMp4 = useCallback(async (
    canvas: HTMLCanvasElement,
    config: ExportConfig,
    renderFrame: (frame: number) => Promise<void>
  ): Promise<Blob | null> => {
    if (exporting) return null;

    setExporting(true);
    setProgress(0);
    setStatus("Starting export...");
    const controller = new AbortController();
    controllerRef.current = controller;

    try {
      const { exportToVideo } = await import("@superimg/browser-export");
      const blob = await exportToVideo(canvas, config, renderFrame, {
        signal: controller.signal,
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
      if (controller.signal.aborted || (error as { code?: string }).code === "aborted") {
        setStatus("Export cancelled");
        return null;
      }
      const message = error instanceof Error ? error.message : "Unknown error";
      setStatus(`Export failed: ${message}`);
      return null;
    } finally {
      if (controllerRef.current === controller) controllerRef.current = null;
      setExporting(false);
    }
  }, [exporting]);

  const download = useCallback((blob: Blob, filename: string) => {
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = filename;
    anchor.click();
    URL.revokeObjectURL(url);
  }, []);

  const cancel = useCallback(() => {
    controllerRef.current?.abort();
  }, []);

  return {
    exporting,
    progress,
    status,
    exportMp4,
    download,
    cancel,
  };
}
