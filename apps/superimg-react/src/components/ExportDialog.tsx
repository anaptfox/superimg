//! ExportDialog - Self-contained export modal with size, format, and progress

import { useState, useEffect, useCallback, useRef } from "react";
import type { FormatOption } from "superimg/browser";

// ============================================================================
// Types
// ============================================================================

type OutputFormat = "mp4" | "webm";

export interface ExportDialogProps {
  /** Whether the dialog is open */
  open: boolean;
  /** Close handler */
  onClose: () => void;
  /** Trigger export — returns the blob on success */
  onExport: (options: ExportOptions) => Promise<Blob | null>;
  /** Download a blob */
  onDownload: (blob: Blob, filename: string) => void;
  /** Whether export is in progress */
  exporting: boolean;
  /** Export progress 0-1 */
  exportProgress: number;
  /** Current format (used as default selection) */
  currentFormat?: FormatOption;
  /** Optional CSS class on the overlay */
  className?: string;
}

export interface ExportOptions {
  format?: FormatOption;
  encoding?: {
    format?: OutputFormat;
  };
}

// ============================================================================
// Format presets
// ============================================================================

const FORMAT_PRESETS = [
  { id: "horizontal" as const, label: "1920 × 1080", sub: "Landscape" },
  { id: "vertical" as const, label: "1080 × 1920", sub: "Portrait" },
  { id: "square" as const, label: "1080 × 1080", sub: "Square" },
] as const;

const OUTPUT_FORMATS: { id: OutputFormat; label: string }[] = [
  { id: "mp4", label: "MP4" },
  { id: "webm", label: "WebM" },
];

// ============================================================================
// Inline styles (no CSS framework dependency)
// ============================================================================

const S = {
  overlay: {
    position: "fixed" as const,
    inset: 0,
    zIndex: 9999,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "rgba(0, 0, 0, 0.6)",
    backdropFilter: "blur(4px)",
  },
  panel: {
    background: "#1a1a1a",
    border: "1px solid rgba(255,255,255,0.1)",
    borderRadius: 12,
    width: 380,
    maxWidth: "90vw",
    padding: 24,
    color: "white",
    fontFamily: "system-ui, -apple-system, sans-serif",
    boxShadow: "0 20px 60px rgba(0,0,0,0.5)",
  },
  header: {
    display: "flex" as const,
    justifyContent: "space-between" as const,
    alignItems: "center" as const,
    marginBottom: 20,
  },
  title: {
    fontSize: 16,
    fontWeight: 600 as const,
    margin: 0,
  },
  closeBtn: {
    background: "none",
    border: "none",
    color: "rgba(255,255,255,0.5)",
    cursor: "pointer",
    padding: 10,
    margin: -6,
    fontSize: 18,
    lineHeight: 1,
    minWidth: 44,
    minHeight: 44,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  fieldGroup: {
    marginBottom: 16,
  },
  label: {
    display: "block" as const,
    fontSize: 11,
    fontWeight: 500 as const,
    color: "rgba(255,255,255,0.5)",
    textTransform: "uppercase" as const,
    letterSpacing: "0.05em",
    marginBottom: 6,
  },
  pillRow: {
    display: "flex" as const,
    gap: 6,
  },
  pill: (active: boolean) => ({
    flex: 1,
    padding: "10px 4px",
    fontSize: 12,
    fontWeight: 500 as const,
    textAlign: "center" as const,
    borderRadius: 6,
    border: "1px solid",
    borderColor: active ? "rgba(59,130,246,0.6)" : "rgba(255,255,255,0.1)",
    background: active ? "rgba(59,130,246,0.15)" : "rgba(255,255,255,0.04)",
    color: active ? "#93bbfc" : "rgba(255,255,255,0.7)",
    cursor: "pointer",
    transition: "all 0.15s ease",
  }),
  pillSub: {
    display: "block" as const,
    fontSize: 10,
    color: "rgba(255,255,255,0.35)",
    marginTop: 1,
  },
  exportBtn: (disabled: boolean) => ({
    width: "100%",
    padding: "10px 0",
    fontSize: 14,
    fontWeight: 600 as const,
    borderRadius: 8,
    border: "none",
    background: disabled ? "rgba(59,130,246,0.3)" : "#3b82f6",
    color: disabled ? "rgba(255,255,255,0.5)" : "white",
    cursor: disabled ? "default" : "pointer",
    transition: "background 0.15s ease",
    marginTop: 4,
  }),
  progressWrap: {
    marginTop: 16,
  },
  progressTrack: {
    height: 6,
    borderRadius: 3,
    background: "rgba(255,255,255,0.08)",
    overflow: "hidden" as const,
  },
  progressFill: (pct: number) => ({
    height: "100%",
    width: `${pct}%`,
    background: "#3b82f6",
    borderRadius: 3,
    transition: "width 0.1s ease-out",
  }),
  progressLabel: {
    fontSize: 12,
    color: "rgba(255,255,255,0.5)",
    marginTop: 6,
    textAlign: "center" as const,
  },
  doneRow: {
    display: "flex" as const,
    gap: 8,
    marginTop: 16,
  },
  doneBtn: (primary: boolean) => ({
    flex: 1,
    padding: "9px 0",
    fontSize: 13,
    fontWeight: 500 as const,
    borderRadius: 8,
    border: primary ? "none" : "1px solid rgba(255,255,255,0.15)",
    background: primary ? "#3b82f6" : "transparent",
    color: "white",
    cursor: "pointer",
    transition: "background 0.15s ease",
  }),
} as const;

// ============================================================================
// Component
// ============================================================================

/**
 * A self-contained export dialog with size and format pickers.
 * Renders as a portal overlay.
 *
 * @example
 * ```tsx
 * const session = useVideoSession(config);
 * const [showExport, setShowExport] = useState(false);
 *
 * <ExportDialog
 *   open={showExport}
 *   onClose={() => setShowExport(false)}
 *   onExport={(opts) => session.exportMp4(opts)}
 *   onDownload={session.download}
 *   exporting={session.exporting}
 *   exportProgress={session.exportProgress}
 *   currentFormat={session.format}
 * />
 * ```
 */
export function ExportDialog({
  open,
  onClose,
  onExport,
  onDownload,
  exporting,
  exportProgress,
  currentFormat,
  className,
}: ExportDialogProps) {
  const [resolution, setResolution] = useState<string>(
    () => {
      if (typeof currentFormat === "string" && FORMAT_PRESETS.some(p => p.id === currentFormat)) {
        return currentFormat;
      }
      return "horizontal";
    }
  );
  const [outputFmt, setOutputFmt] = useState<OutputFormat>("mp4");
  const [resultBlob, setResultBlob] = useState<Blob | null>(null);
  const [error, setError] = useState<string | null>(null);
  const overlayRef = useRef<HTMLDivElement>(null);

  // Reset state when dialog opens
  useEffect(() => {
    if (open) {
      setResultBlob(null);
      setError(null);
      if (typeof currentFormat === "string" && FORMAT_PRESETS.some(p => p.id === currentFormat)) {
        setResolution(currentFormat);
      }
    }
  }, [open, currentFormat]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !exporting) onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, exporting, onClose]);

  const handleExport = useCallback(async () => {
    setError(null);
    setResultBlob(null);

    const blob = await onExport({
      format: resolution as FormatOption,
      encoding: {
        format: outputFmt,
      },
    });

    if (blob) {
      setResultBlob(blob);
    } else {
      setError("Export failed. Check browser console for details.");
    }
  }, [onExport, resolution, outputFmt]);

  const handleDownload = useCallback(() => {
    if (!resultBlob) return;
    const ext = outputFmt === "webm" ? "webm" : "mp4";
    onDownload(resultBlob, `superimg-export.${ext}`);
  }, [resultBlob, outputFmt, onDownload]);

  const handleOverlayClick = useCallback((e: React.MouseEvent) => {
    if (e.target === overlayRef.current && !exporting) {
      onClose();
    }
  }, [exporting, onClose]);

  if (!open) return null;

  const pct = Math.round(exportProgress * 100);
  const done = resultBlob !== null;

  return (
    <div ref={overlayRef} className={className} style={S.overlay} onClick={handleOverlayClick}>
      <div style={S.panel} onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div style={S.header}>
          <h3 style={S.title}>Export Video</h3>
          {!exporting && (
            <button style={S.closeBtn} onClick={onClose} aria-label="Close">
              ✕
            </button>
          )}
        </div>

        {/* Done state */}
        {done ? (
          <>
            <div style={{ textAlign: "center", padding: "8px 0 4px" }}>
              <div style={{ fontSize: 32, marginBottom: 8 }}>✓</div>
              <div style={{ fontSize: 14, color: "rgba(255,255,255,0.7)" }}>
                Export complete
              </div>
              <div style={{ fontSize: 12, color: "rgba(255,255,255,0.35)", marginTop: 4 }}>
                {(resultBlob.size / (1024 * 1024)).toFixed(1)} MB
              </div>
            </div>
            <div style={S.doneRow}>
              <button style={S.doneBtn(false)} onClick={onClose}>
                Close
              </button>
              <button style={S.doneBtn(true)} onClick={handleDownload}>
                Download
              </button>
            </div>
          </>
        ) : exporting ? (
          /* Progress state */
          <div style={S.progressWrap}>
            <div style={S.progressTrack}>
              <div style={S.progressFill(pct)} />
            </div>
            <div style={S.progressLabel}>
              Exporting… {pct}%
            </div>
          </div>
        ) : (
          /* Config state */
          <>
            {/* Resolution */}
            <div style={S.fieldGroup}>
              <span style={S.label}>Resolution</span>
              <div style={S.pillRow}>
                {FORMAT_PRESETS.map((p) => (
                  <button
                    key={p.id}
                    style={S.pill(resolution === p.id)}
                    onClick={() => setResolution(p.id)}
                  >
                    {p.sub}
                    <span style={S.pillSub}>{p.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Output Format */}
            <div style={S.fieldGroup}>
              <span style={S.label}>Format</span>
              <div style={S.pillRow}>
                {OUTPUT_FORMATS.map((f) => (
                  <button
                    key={f.id}
                    style={S.pill(outputFmt === f.id)}
                    onClick={() => setOutputFmt(f.id)}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Error */}
            {error && (
              <div style={{ fontSize: 12, color: "#f87171", marginBottom: 12 }}>
                {error}
              </div>
            )}

            {/* Export button */}
            <button
              style={S.exportBtn(false)}
              onClick={handleExport}
            >
              Export
            </button>
          </>
        )}
      </div>
    </div>
  );
}
