//! @theme/AnimatedFigure — prose + compact hover-to-play SuperImg loop.

import type { CSSProperties, ReactNode } from "react";
import type { PlayerInput } from "@foxworth/superimg/react/player";
// Relative import so the package builds without Docusaurus @theme aliases.
import SuperImgPlayer from "../SuperImgPlayer/index.js";

export type AnimatedFigureProps = {
  title: string;
  children: ReactNode;
  media: PlayerInput;
  label?: string;
};

const figureStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "minmax(0, 1fr) minmax(220px, 42%)",
  gap: 20,
  alignItems: "center",
  margin: "28px 0",
  padding: 20,
  borderRadius: 12,
  border: "1px solid var(--ifm-color-emphasis-200, #e4e4e7)",
  background: "var(--ifm-background-surface-color, transparent)",
};

const titleStyle: CSSProperties = {
  margin: "0 0 8px",
  fontSize: "1.05rem",
};

const copyStyle: CSSProperties = {
  margin: 0,
  color: "var(--ifm-color-emphasis-700, #3f3f46)",
  lineHeight: 1.6,
};

/**
 * Inline animated figure — prose on the left, compact loop preview on the right.
 */
export default function AnimatedFigure({
  title,
  children,
  media,
  label,
}: AnimatedFigureProps) {
  return (
    <div data-superimg-animated-figure="" style={figureStyle}>
      <div>
        <h4 style={titleStyle}>{title}</h4>
        <div style={copyStyle}>{children}</div>
      </div>
      <div style={{ minWidth: 0 }}>
        <SuperImgPlayer
          media={media}
          label={label}
          playbackMode="loop"
          loadMode="lazy"
          hoverBehavior="play"
          hoverDelayMs={150}
        />
      </div>
    </div>
  );
}
