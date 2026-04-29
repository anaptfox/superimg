//! ExportButton - Download/export trigger button

export interface ExportButtonProps {
  /** Click handler */
  onClick: () => void;
  /** Whether export is in progress */
  exporting?: boolean;
  /** Optional CSS class name */
  className?: string;
  /** Button size preset */
  size?: "sm" | "md" | "lg";
}

const sizes = { sm: 24, md: 32, lg: 40 };
const iconSizes = { sm: 12, md: 16, lg: 20 };

function DownloadIcon({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="7 10 12 15 17 10" />
      <line x1="12" y1="15" x2="12" y2="3" />
    </svg>
  );
}

function SpinnerIcon({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round">
      <path d="M12 2a10 10 0 0 1 10 10">
        <animateTransform attributeName="transform" type="rotate" from="0 12 12" to="360 12 12" dur="0.8s" repeatCount="indefinite" />
      </path>
    </svg>
  );
}

/**
 * A button that triggers video export.
 *
 * @example
 * ```tsx
 * <ExportButton onClick={() => setShowExport(true)} />
 * ```
 */
export function ExportButton({ onClick, exporting = false, className, size = "md" }: ExportButtonProps) {
  return (
    <button
      onClick={onClick}
      disabled={exporting}
      className={className}
      title="Export video"
      style={{
        width: sizes[size],
        height: sizes[size],
        borderRadius: "50%",
        background: "rgba(255, 255, 255, 0.1)",
        border: "none",
        cursor: exporting ? "default" : "pointer",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        color: "white",
        opacity: exporting ? 0.6 : 1,
        transition: "background 0.15s ease, opacity 0.15s ease",
      }}
      onMouseEnter={(e) => {
        if (!exporting) e.currentTarget.style.background = "rgba(255, 255, 255, 0.2)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = "rgba(255, 255, 255, 0.1)";
      }}
    >
      {exporting ? (
        <SpinnerIcon size={iconSizes[size]} />
      ) : (
        <DownloadIcon size={iconSizes[size]} />
      )}
    </button>
  );
}
