//! FormatSelector - Compact aspect-ratio/format picker for the controls bar

import type { FormatOption } from "superimg/browser";

export interface FormatPreset {
  id: string;
  label: string;
  icon: "landscape" | "portrait" | "square";
  format: FormatOption;
}

export interface FormatSelectorProps {
  /** Currently selected format */
  value: FormatOption;
  /** Called when user picks a new format */
  onChange: (format: FormatOption) => void;
  /** Override the default presets */
  presets?: FormatPreset[];
  /** Show text labels (e.g. on mobile for touch targets) */
  showLabels?: boolean;
  /** Optional CSS class */
  className?: string;
}

const DEFAULT_PRESETS: FormatPreset[] = [
  { id: "horizontal", label: "Landscape", icon: "landscape", format: "horizontal" },
  { id: "vertical", label: "Portrait", icon: "portrait", format: "vertical" },
  { id: "square", label: "Square", icon: "square", format: "square" },
];

function AspectIcon({ type, size = 14 }: { type: "landscape" | "portrait" | "square"; size?: number }) {
  const s = size;
  const stroke = "currentColor";
  const sw = 1.5;
  const r = 2;

  if (type === "landscape") {
    return (
      <svg width={s} height={s} viewBox="0 0 16 16" fill="none">
        <rect x="1" y="3.5" width="14" height="9" rx={r} stroke={stroke} strokeWidth={sw} />
      </svg>
    );
  }
  if (type === "portrait") {
    return (
      <svg width={s} height={s} viewBox="0 0 16 16" fill="none">
        <rect x="3.5" y="1" width="9" height="14" rx={r} stroke={stroke} strokeWidth={sw} />
      </svg>
    );
  }
  return (
    <svg width={s} height={s} viewBox="0 0 16 16" fill="none">
      <rect x="2" y="2" width="12" height="12" rx={r} stroke={stroke} strokeWidth={sw} />
    </svg>
  );
}

/**
 * A compact format/aspect-ratio selector that renders as a pill group inside the controls bar.
 *
 * @example
 * ```tsx
 * const session = useVideoSession(config);
 *
 * <FormatSelector
 *   value={session.format}
 *   onChange={session.setFormat}
 * />
 * ```
 */
export function FormatSelector({
  value,
  onChange,
  presets = DEFAULT_PRESETS,
  showLabels = false,
  className,
}: FormatSelectorProps) {
  const activeId = typeof value === "string" ? value : undefined;

  return (
    <div
      className={className}
      style={{
        display: "flex",
        alignItems: "center",
        gap: showLabels ? 6 : 2,
        background: "rgba(255,255,255,0.06)",
        borderRadius: 6,
        padding: showLabels ? 4 : 2,
      }}
    >
      {presets.map((p) => {
        const active = activeId === p.id;
        return (
          <button
            key={p.id}
            onClick={() => onChange(p.format)}
            title={p.label}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: showLabels ? 4 : 0,
              minWidth: showLabels ? 44 : 28,
              minHeight: showLabels ? 44 : 24,
              width: showLabels ? undefined : 28,
              height: showLabels ? undefined : 24,
              padding: showLabels ? "6px 10px" : 0,
              borderRadius: 4,
              border: "none",
              background: active ? "rgba(255,255,255,0.15)" : "transparent",
              color: active ? "white" : "rgba(255,255,255,0.45)",
              cursor: "pointer",
              transition: "all 0.12s ease",
              fontSize: showLabels ? 11 : undefined,
            }}
            onMouseEnter={(e) => {
              if (!active) e.currentTarget.style.color = "rgba(255,255,255,0.7)";
            }}
            onMouseLeave={(e) => {
              if (!active) e.currentTarget.style.color = "rgba(255,255,255,0.45)";
            }}
          >
            <AspectIcon type={p.icon} size={14} />
            {showLabels && <span>{p.label}</span>}
          </button>
        );
      })}
    </div>
  );
}
