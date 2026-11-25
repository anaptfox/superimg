import type { MediaElement } from "./node-types.js";
import type { TextMeasurer } from "../svg/measure.js";
import { isMediaElement } from "./h.js";

export interface VectorInheritedStyle {
  fill?: string; stroke?: string; strokeWidth?: number; fillOpacity?: number;
  opacity?: number; family?: string; size?: number; weight?: number; unsupported?: boolean;
  letterSpacing?: number; anchor?: string; dominantBaseline?: string; styleName?: string;
}
export function vectorTextContent(el: MediaElement): string {
  return el.children.map(child => isMediaElement(child) ? vectorTextContent(child) : typeof child === "string" || typeof child === "number" ? String(child) : "").join("");
}
export function inheritedVectorStyle(el: MediaElement, parent: VectorInheritedStyle = {}): VectorInheritedStyle {
  const css = el.props.style && typeof el.props.style === "object" ? el.props.style as Record<string, unknown> : {};
  const props = { ...css, ...el.props };
  const result = { ...parent };
  if (typeof el.props.style === "string") result.unsupported = true;
  const strings = { fill: "fill", stroke: "stroke", family: "fontFamily", anchor: "textAnchor", dominantBaseline: "dominantBaseline", styleName: "fontStyle" } as const;
  for (const [key, alias] of Object.entries(strings)) {
    const value = props[key] ?? props[alias];
    if (typeof value === "string") Object.assign(result, { [key]: value });
  }
  for (const [key, alias] of Object.entries({ size: "fontSize", weight: "fontWeight", letterSpacing: "letterSpacing", strokeWidth: "strokeWidth", fillOpacity: "fillOpacity" })) {
    const value = props[key] ?? props[alias];
    if (typeof value === "number" && Number.isFinite(value)) Object.assign(result, { [key]: value });
    else if (key === "weight" && (value === "bold" || value === "normal")) result.weight = value === "bold" ? 700 : 400;
    else if (typeof value === "string" && /^-?\d+(?:\.\d+)?(?:px)?$/.test(value)) Object.assign(result, { [key]: Number(value.replace(/px$/, "")) });
    else if (value !== undefined) result.unsupported = true;
  }
  const opacity = props.opacity;
  if (typeof opacity === "number") result.opacity = (parent.opacity ?? 1) * opacity;
  return result;
}

export function vectorTextMetrics(el: MediaElement, style: VectorInheritedStyle, measurer?: TextMeasurer) {
  if (el.type !== "VectorText" && el.type !== "text") return undefined;
  const text = vectorTextContent(el);
  const fontSize = style.size ?? 16, fontFamily = style.family ?? "serif", fontWeight = style.weight ?? 400;
  const measured = measurer?.measure(text, { fontSize, fontFamily, fontWeight, ...(style.styleName ? { fontStyle: style.styleName } : {}), ...(style.letterSpacing !== undefined ? { letterSpacing: style.letterSpacing } : {}) });
  // Differently styled/positioned runs need browser ink measurement. Do not
  // claim that measuring the aggregate string resolves their native layout.
  const complexRuns = style.unsupported === true || el.children.some(child => isMediaElement(child) && Object.keys(child.props).some(key => !["id", "key"].includes(key)));
  const width = measured?.width ?? Array.from(text).length * fontSize * 0.55 + Math.max(0, Array.from(text).length - 1) * (style.letterSpacing ?? 0);
  const ascent = measured?.ascent ?? fontSize * 0.8, descent = measured?.descent ?? fontSize * 0.2;
  const x = typeof el.props.x === "number" ? el.props.x : 0, y = typeof el.props.y === "number" ? el.props.y : 0;
  const anchor = style.anchor ?? "start", baseline = style.dominantBaseline ?? "auto";
  const top = baseline === "middle" || baseline === "central" ? y - (ascent + descent) / 2 : baseline === "hanging" || baseline === "text-before-edge" ? y : baseline === "text-after-edge" ? y - ascent - descent : y - ascent;
  return {
    bounds: { x: x - (anchor === "middle" ? width / 2 : anchor === "end" ? width : 0), y: top, width, height: ascent + descent, estimated: true as const },
    typography: { fontSize, fontFamily, fontWeight, anchor, dominantBaseline: baseline, metricsSource: measured?.exact && !complexRuns ? "font" as const : "heuristic" as const },
    metricsExact: measured?.exact === true && !complexRuns,
    complexRuns,
  };
}
