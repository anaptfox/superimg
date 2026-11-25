//! One resolved text style shared by approximate geometry and HTML paint.

import type { MediaElement } from "./node-types.js";

export interface ResolvedTypography {
  fontSize: number;
  fontWeight: number;
  fontFamily: string;
  lineHeight: number;
  letterSpacing: number | undefined;
  textAlign: string;
  whiteSpace: "pre" | "pre-wrap" | "nowrap";
  /** Laid-out line breaks. Paint emits these so the browser does not re-wrap. */
  lines?: string[];
  /** Widths from the same wrap pass that supplied lines; not glyph ink bounds. */
  lineWidths?: number[];
  /** False when width came from the 0.55em heuristic. */
  metricsExact?: boolean;
}

// Keys are newly laid-out nodes, so retaining an authored tree does not retain
// prior evaluations. No data or font-measurement cache crosses render frames.
const laidOutTypography = new WeakMap<MediaElement, ResolvedTypography>();

function finite(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

export function resolveTypography(el: MediaElement, canvasWidth: number): ResolvedTypography {
  const explicit = finite(el.props.size);
  const scale = canvasWidth / 1920;
  const variant = el.props.variant;
  const sizes = variant === "display" ? [28, 96] : variant === "title" ? [20, 40]
    : variant === "caption" ? [11, 14] : variant === "label" ? [10, 12] : [14, 18];
  return {
    fontSize: explicit !== undefined && explicit > 0 ? explicit : Math.max(sizes[0]!, Math.round(sizes[1]! * scale)),
    fontWeight: finite(el.props.weight) ?? (variant === "display" || variant === "title" ? 700 : 500),
    fontFamily: typeof el.props.fontFamily === "string" ? el.props.fontFamily : "Inter, system-ui, sans-serif",
    lineHeight: finite(el.props.lineHeight) ?? 1.2,
    letterSpacing: finite(el.props.letterSpacing),
    textAlign: typeof el.props.align === "string" ? el.props.align : "left",
    whiteSpace: finite(el.props.maxWidth) !== undefined ? "pre-wrap" : "nowrap",
  };
}

export function rememberTypography(el: MediaElement, style: ResolvedTypography): MediaElement {
  laidOutTypography.set(el, style);
  return el;
}

export function typographyForPaint(el: MediaElement, canvasWidth: number): ResolvedTypography {
  return laidOutTypography.get(el) ?? resolveTypography(el, canvasWidth);
}
