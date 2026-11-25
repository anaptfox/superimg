//! VideoControls - Composite component for PlayButton + Timeline + ExportButton
"use client";

import { useState, useCallback } from "react";
import type { RuntimeStore } from "@superimg/media";
import type { CanvasSize } from "@superimg/types";
import { useIsMobile } from "../hooks/useMediaQuery.js";
import { PlayButton } from "./PlayButton.js";
import { Timeline } from "./Timeline.js";
import { ExportButton } from "./ExportButton.js";
import { ExportDialog, type ExportOptions } from "./ExportDialog.js";

export interface VideoControlsProps {
  /** The player store to control */
  store: RuntimeStore;
  /** Show timeline (default: true) */
  showTimeline?: boolean;
  /** Show time labels on timeline (default: false) */
  showTime?: boolean;
  /** Show export button (default: false). Requires onExport + onDownload to function. */
  showExport?: boolean;
  /** Export handler — called when user clicks "Export" in the dialog */
  onExport?: (options: ExportOptions) => Promise<Blob | null>;
  /** Download handler */
  onDownload?: (blob: Blob, filename: string) => void;
  /** Whether export is in progress */
  exporting?: boolean;
  /** Export progress 0-1 */
  exportProgress?: number;
  /** Current custom preview size, used as the export dialog default. */
  currentSize?: CanvasSize;
  /** Optional CSS class */
  className?: string;
  /** Controlled export dialog open state */
  exportDialogOpen?: boolean;
  /** Called when export dialog open state changes */
  onExportDialogOpenChange?: (open: boolean) => void;
}

/**
 * Composite control bar with play/pause button, optional timeline, and optional export.
 *
 * @example
 * ```tsx
 * const playerRef = useRef<PlayerRef>(null);
 * const { exportMp4, download, exporting, exportProgress } = usePlaygroundExport({ media, data });
 *
 * <VideoControls
 *   store={playerRef.current!.store!}
 *   showTime
 *   showExport
 *   onExport={exportMp4}
 *   onDownload={download}
 *   exporting={exporting}
 *   exportProgress={exportProgress}
 *   currentSize={{ width: 1280, height: 720 }}
 * />
 * ```
 */
export function VideoControls({
  store,
  showTimeline = true,
  showTime = false,
  showExport = false,
  onExport,
  onDownload,
  exporting = false,
  exportProgress = 0,
  currentSize,
  className,
  exportDialogOpen,
  onExportDialogOpenChange,
}: VideoControlsProps) {
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false);
  const dialogOpen = exportDialogOpen ?? uncontrolledOpen;
  const setDialogOpen = onExportDialogOpenChange ?? setUncontrolledOpen;

  const handleExportClick = useCallback(() => {
    setDialogOpen(true);
  }, [setDialogOpen]);

  const handleClose = useCallback(() => {
    if (!exporting) setDialogOpen(false);
  }, [exporting, setDialogOpen]);

  const canExport = showExport && onExport && onDownload;
  const isMobile = useIsMobile();

  const controlsPadding = showTime ? "12px 12px 12px" : "12px";

  return (
    <>
      <div
        className={className}
        style={{
          display: "flex",
          flexDirection: isMobile ? "column" : "row",
          alignItems: "center",
          gap: isMobile ? 8 : 12,
          padding: controlsPadding,
          background: "rgba(0, 0, 0, 0.6)",
        }}
      >
        {isMobile ? (
          <>
            {/* Row 1: Play + Timeline (full width for scrubbing) */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                width: "100%",
              }}
            >
              <PlayButton store={store} size={isMobile ? "lg" : "md"} />
              <div
                style={{
                  flex: 1,
                  minWidth: 0,
                  padding: "18px 0",
                  margin: "-18px 0",
                  cursor: "pointer",
                }}
              >
                {showTimeline && (
                  <Timeline
                    store={store}
                    style={{ flex: 1, minHeight: 8 }}
                    showTime={showTime}
                  />
                )}
              </div>
            </div>
            {/* Row 2: Export */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                width: "100%",
              }}
            >
              {canExport && (
                <ExportButton
                  onClick={handleExportClick}
                  exporting={exporting}
                  size={isMobile ? "lg" : "md"}
                />
              )}
            </div>
          </>
        ) : (
          <>
            <PlayButton store={store} size="md" />
            {showTimeline && (
              <div
                style={{
                  flex: 1,
                  minWidth: 0,
                  padding: "18px 0",
                  margin: "-18px 0",
                  cursor: "pointer",
                }}
              >
                <Timeline
                  store={store}
                  style={{ flex: 1, minHeight: 8 }}
                  showTime={showTime}
                />
              </div>
            )}
            {canExport && (
              <ExportButton
                onClick={handleExportClick}
                exporting={exporting}
                size="md"
              />
            )}
          </>
        )}
      </div>

      {canExport && (
        <ExportDialog
          open={dialogOpen}
          onClose={handleClose}
          onExport={onExport}
          onDownload={onDownload}
          exporting={exporting}
          exportProgress={exportProgress}
          {...(currentSize !== undefined ? { currentSize } : {})}
        />
      )}
    </>
  );
}
