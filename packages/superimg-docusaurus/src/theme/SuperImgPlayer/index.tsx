//! @theme/SuperImgPlayer — BrowserOnly + dynamic SuperImg Player (SSR-safe).
//! Do not top-level-import @foxworth/superimg/react/player — keeps the SSG server graph clean.

import BrowserOnly from "@docusaurus/BrowserOnly";
import {
  useEffect,
  useState,
  type ComponentType,
  type CSSProperties,
} from "react";
import type { PlayerProps } from "@foxworth/superimg/react/player";

export type SuperImgPlayerProps = Omit<PlayerProps, "ref"> & {
  /** Optional corner label over the frame. */
  label?: string;
  /** SSR / pre-hydration fallback. @default "Loading preview…" */
  fallbackText?: string;
  className?: string;
  frameStyle?: CSSProperties;
};

const frameStyleBase: CSSProperties = {
  position: "relative",
  width: "100%",
  aspectRatio: "16 / 9",
  borderRadius: 12,
  overflow: "hidden",
  background: "#0a0a14",
  border: "1px solid var(--ifm-color-emphasis-300, #d4d4d8)",
};

const labelStyle: CSSProperties = {
  position: "absolute",
  top: 10,
  left: 12,
  zIndex: 2,
  fontSize: 11,
  fontWeight: 600,
  letterSpacing: "0.06em",
  textTransform: "uppercase",
  color: "rgba(255, 255, 255, 0.55)",
  background: "rgba(0, 0, 0, 0.45)",
  padding: "4px 8px",
  borderRadius: 6,
};

const fallbackStyle: CSSProperties = {
  width: "100%",
  height: "100%",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  color: "var(--ifm-color-emphasis-600, #71717a)",
  fontSize: 14,
  background: "linear-gradient(135deg, #111827, #0f172a)",
};

type PlayerComponent = ComponentType<PlayerProps>;

function ClientPlayer(props: PlayerProps & { fallbackText: string }) {
  const { fallbackText, style, ...rest } = props;
  const [Player, setPlayer] = useState<PlayerComponent | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void import("@foxworth/superimg/react/player")
      .then((mod) => {
        if (!cancelled) setPlayer(() => mod.Player as PlayerComponent);
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : String(err));
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (error) {
    return (
      <div style={fallbackStyle} role="alert">
        {error}
      </div>
    );
  }

  if (!Player) {
    return <div style={fallbackStyle}>{fallbackText}</div>;
  }

  return (
    <Player
      {...rest}
      style={{ width: "100%", height: "100%", ...style }}
    />
  );
}

/**
 * Docs-safe SuperImg Player: SSR fallback → hydrate → dynamic-import Player.
 */
export default function SuperImgPlayer({
  label,
  fallbackText = "Loading preview…",
  className,
  frameStyle,
  style,
  ...playerProps
}: SuperImgPlayerProps) {
  return (
    <div
      className={className}
      data-superimg-docusaurus-player=""
      style={{ ...frameStyleBase, ...frameStyle }}
    >
      {label ? <div style={labelStyle}>{label}</div> : null}
      <BrowserOnly
        fallback={<div style={fallbackStyle}>{fallbackText}</div>}
      >
        {() => (
          <ClientPlayer
            {...playerProps}
            style={style}
            fallbackText={fallbackText}
          />
        )}
      </BrowserOnly>
    </div>
  );
}
