/** Deterministic, inspectable charts. TanStack owns layout; SuperImg owns time and paint. */
import { rectCornerRadiiPath } from "@tanstack/charts/renderer/rect";
import { createChartScene } from "@tanstack/charts/scene";
import type {
  ChartValue,
  ChartScene,
  ChartPoint,
  ChartTheme,
  ChartTextTypography,
  ChartTextMeasurer,
  StaticChartDefinition,
  SceneNode,
  SceneStyle,
} from "@tanstack/charts/types/core";
import { Vector, vector, type VectorPaintProps } from "../tree/vector.js";
import type { MediaElement } from "../tree/node-types.js";
import { pointAt } from "../svg/bezier.js";
export { defineChart } from "@tanstack/charts/scene";
export { lineY, lineX } from "@tanstack/charts/line";
export { barY, barX } from "@tanstack/charts/bar";
export { group } from "@tanstack/charts/group";
export { areaY } from "@tanstack/charts/area";
export { scaleLinear } from "@tanstack/charts/scales/linear";
export { scaleBand } from "@tanstack/charts/scales/band";
export { scalePoint } from "@tanstack/charts/scales/point";
export { scaleOrdinal } from "@tanstack/charts/scales/ordinal";
export type {
  ChartScene,
  ChartPoint,
  StaticChartDefinition,
} from "@tanstack/charts/types/core";
export interface ChartMotion {
  /** Normalized path draw. Auxiliary dots appear at completion; areas need an explicit fill clip. */
  lineReveal?: number;
  barsGrow?: number;
}
export interface ChartLayoutOptions {
  /** Stable occurrence identity, unique among charts in the same media tree. */
  id: string;
  width: number;
  height: number;
  theme?: Partial<ChartTheme>;
  typography?: ChartTextTypography;
  measureText?: ChartTextMeasurer;
  motion?: ChartMotion & {
    marks?: Readonly<Record<string, ChartMotion>>;
  };
}
export interface ChartDiagnostic {
  code: "APPROXIMATE_TEXT_METRICS";
  message: string;
}
export class ChartLayoutError extends Error {
  constructor(
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "ChartLayoutError";
  }
}
export interface ChartLayout<
  TDatum = unknown,
  TX extends ChartValue = ChartValue,
  TY extends ChartValue = ChartValue,
> {
  artwork: MediaElement;
  /** Unanimated semantic scene. Points and annotation coordinates refer to this final layout. */
  scene: ChartScene<TDatum, TX, TY>;
  points: readonly ChartPoint<TDatum, TX, TY>[];
  diagnostics: readonly ChartDiagnostic[];
  point(key: string): ChartPoint<TDatum, TX, TY> | undefined;
  mark(markId: string): readonly SceneNode[];
  project(channel: string, value: unknown): number;
  /** Samples a scene path in chart coordinates, including enclosing translations. */
  pathPoint(
    nodeKey: string,
    progress: number,
  ): {
    x: number;
    y: number;
  };
}
const theme: ChartTheme = {
  foreground: "#111827",
  muted: "#475569",
  grid: "#cbd5e1",
  background: "#ffffff",
  palette: ["#2563eb", "#e56b16", "#09977c", "#9254c8", "#c33f61", "#89730b"],
};
function present<T extends object>(
  value: T,
): {
  [K in keyof T]: Exclude<T[K], undefined>;
} {
  return Object.fromEntries(
    Object.entries(value).filter(([, v]) => v !== undefined),
  ) as {
    [K in keyof T]: Exclude<T[K], undefined>;
  };
}
function fail(code: string, message: string): never {
  throw new ChartLayoutError(code, message);
}
function finite(value: number, label: string): number {
  if (!Number.isFinite(value))
    fail("NON_FINITE_GEOMETRY", `${label} must be finite`);
  return value;
}
function progress(value: number | undefined): number {
  return Math.max(0, Math.min(1, finite(value ?? 1, "Motion progress")));
}
// Encode Unicode code points instead of lossy sanitization or hash collisions.
function token(value: string): string {
  return Array.from(value)
    .map((c) => c.codePointAt(0)!.toString(16))
    .join("-");
}
function path(
  points: readonly (readonly [number, number])[],
  close = false,
): string {
  return (
    points
      .map(
        ([x, y], i) =>
          `${i ? "L" : "M"}${finite(x, "Path x")},${finite(y, "Path y")}`,
      )
      .join("") + (close && points.length ? "Z" : "")
  );
}
function geometry(
  node: Extract<
    SceneNode,
    {
      kind: "polyline" | "area";
    }
  >,
): string {
  const d =
    node.kind === "area" && node.polygons !== undefined
      ? node.polygons.map((p) => p.map((r) => path(r, true)).join("")).join("")
      : (node.path ?? path(node.points, node.kind === "area"));
  if (/NaN|Infinity|undefined/.test(d))
    fail("NON_FINITE_GEOMETRY", `Invalid path ${node.key}`);
  return d;
}
export function layout<TDatum, TX extends ChartValue, TY extends ChartValue>(
  definition: StaticChartDefinition<TDatum, TX, TY>,
  options: ChartLayoutOptions,
): ChartLayout<TDatum, TX, TY> {
  if (!options.id.trim())
    fail("MISSING_ID", "Chart occurrence id must be nonempty");
  for (const [k, v] of Object.entries({
    width: options.width,
    height: options.height,
  }))
    if (finite(v, k) <= 0) fail("INVALID_SIZE", `${k} must be positive`);
  progress(options.motion?.lineReveal);
  progress(options.motion?.barsGrow);
  for (const entry of Object.values(options.motion?.marks ?? {})) {
    progress(entry.lineReveal);
    progress(entry.barsGrow);
  }
  const typography = { fontFamily: "Arial, sans-serif", ...options.typography };
  // These typography attributes affect measurement but are not yet paintable by VectorText.
  if (
    (typography.fontScale !== undefined && typography.fontScale !== 1) ||
    (typography.direction && typography.direction !== "ltr") ||
    (typography.fontStyle && typography.fontStyle !== "normal") ||
    (typography.fontStretch && typography.fontStretch !== "normal")
  )
    fail(
      "UNSUPPORTED_TYPOGRAPHY",
      "Font scaling, direction, style and stretch require a text adapter",
    );
  const fontSize = Math.max(16, Math.min(36, options.height / 24));
  const scales = Object.fromEntries(
    Object.entries(definition.scales).map(([key, scale]) => {
      if (!scale || scale.axis === false) return [key, scale];
      const axis = scale.axis ?? {};
      return [
        key,
        {
          ...scale,
          axis: {
            ...axis,
            tickLabels:
              axis.tickLabels === false
                ? false
                : { fontSize, ...axis.tickLabels },
            ...(typeof axis.label === "string"
              ? { label: { text: axis.label, fontSize: fontSize * 1.1 } }
              : axis.label
                ? { label: { fontSize: fontSize * 1.1, ...axis.label } }
                : {}),
          },
        },
      ];
    }),
  );
  const scene = createChartScene<TDatum, TX, TY>(
    {
      ...definition,
      scales,
      focus: false,
      pointer: false,
      keyboard: false,
      theme: {
        ...theme,
        ...definition.theme,
        ...options.theme,
      },
    },
    { width: options.width, height: options.height },
    present({ typography, measureText: options.measureText }),
  );
  if (scene.gradients.length)
    fail(
      "UNSUPPORTED_GRADIENT",
      "Chart gradients require an explicit paint adapter; use solid colors",
    );
  if (!scene.theme.palette.length)
    fail("EMPTY_PALETTE", "Chart palette must contain at least one color");
  for (const color of [
    scene.theme.foreground,
    scene.theme.muted,
    scene.theme.grid,
    scene.theme.background,
    ...scene.theme.palette,
  ]) {
    if (
      !color.trim() ||
      /url\(|var\(|currentColor|context-fill|context-stroke/i.test(color)
    )
      fail("UNSUPPORTED_PAINT", `Use explicit solid colors: ${color}`);
  }
  const prefix = `chart-${token(options.id)}`;
  const nodeKeys = new Set<string>();
  const points = new Map<string, ChartPoint<TDatum, TX, TY>>();
  for (const p of scene.points) {
    finite(p.x, "Point x");
    finite(p.y, "Point y");
    if (points.has(p.key))
      fail("DUPLICATE_POINT_KEY", `Duplicate datum identity ${p.key}`);
    points.set(p.key, p);
  }
  const paths = new Map<
    string,
    {
      d: string;
      x: number;
      y: number;
      first?: { x: number; y: number };
    }
  >();
  const marks = new Map<string, SceneNode[]>();
  function paint(style: SceneStyle = {}): VectorPaintProps {
    if (style.lineJoin === "arcs" || style.lineJoin === "miter-clip")
      fail("UNSUPPORTED_STROKE_JOIN", `Unsupported join ${style.lineJoin}`);
    for (const [k, v] of Object.entries(style))
      if (typeof v === "number") finite(v, k);
    for (const color of [style.fill, style.stroke])
      if (
        color &&
        /url\(|var\(|currentColor|context-fill|context-stroke/i.test(color)
      )
        fail("UNSUPPORTED_PAINT", `Use explicit solid colors: ${color}`);
    return present({
      fill: style.fill,
      fillOpacity: style.fillOpacity,
      stroke: style.stroke,
      strokeOpacity: style.strokeOpacity,
      strokeWidth: style.strokeWidth,
      opacity: style.opacity,
      strokeLinecap: style.lineCap,
      strokeLinejoin: style.lineJoin,
      strokeDasharray: style.strokeDasharray,
    });
  }
  function convert(node: SceneNode, tx = 0, ty = 0): MediaElement {
    if (nodeKeys.has(node.key))
      fail("DUPLICATE_NODE_KEY", `Duplicate scene identity ${node.key}`);
    nodeKeys.add(node.key);
    if (node.renderer)
      fail("UNSUPPORTED_RENDERER", `Custom renderer on ${node.key}`);
    const common = {
      ...paint(node.style),
      id: `${prefix}-${token(node.key)}`,
      key: node.key,
    };
    if (node.kind === "group") {
      if (node.focus || node.states)
        fail(
          "UNSUPPORTED_FOCUS_STATE",
          `Dynamic focus/state group ${node.key}`,
        );
      const x = finite(node.translateX ?? 0, "Translation x"),
        y = finite(node.translateY ?? 0, "Translation y");
      const children = node.children.map((n) => convert(n, tx + x, ty + y));
      const clip = node.clip ? `${common.id}-clip` : undefined;
      if (node.clip) {
        for (const [k, v] of Object.entries(node.clip)) finite(v, `Clip ${k}`);
        if (node.clip.width < 0 || node.clip.height < 0)
          fail("INVALID_GEOMETRY", "Clip dimensions must be nonnegative");
      }
      return vector.group(
        present({
          ...common,
          transform: { x, y },
          clip,
        }),
        ...(node.clip
          ? [
              vector.defs(
                vector.clip({ id: clip! }, vector.rect({ ...node.clip })),
              ),
            ]
          : []),
        ...children,
      );
    }
    const owner =
      "interaction" in node
        ? (node.interaction?.point ?? node.interaction?.points?.[0])
        : undefined;
    const owners =
      "interaction" in node
        ? (node.interaction?.points ?? (owner ? [owner] : []))
        : [];
    for (const markId of new Set(owners.map((p) => p.markId))) {
      const list = marks.get(markId) ?? [];
      list.push(node);
      marks.set(markId, list);
    }
    const motion = {
      ...options.motion,
      ...(owner ? options.motion?.marks?.[owner.markId] : {}),
    };
    switch (node.kind) {
      case "rule":
        return vector.path({
          ...common,
          d: `M${finite(node.x1, "Rule x")},${finite(node.y1, "Rule y")}L${finite(node.x2, "Rule x")},${finite(node.y2, "Rule y")}`,
        });
      case "polyline":
      case "area": {
        const d = geometry(node);
        const move = /^\s*M\s*([-+\d.eE]+)[ ,]+([-+\d.eE]+)/.exec(d);
        const first = node.points[0]
          ? { x: node.points[0][0], y: node.points[0][1] }
          : move
            ? { x: Number(move[1]), y: Number(move[2]) }
            : undefined;
        paths.set(node.key, present({ d, x: tx, y: ty, first }));
        const p = progress(motion.lineReveal);
        if (node.kind === "area" && p < 1)
          fail(
            "UNSUPPORTED_REVEAL",
            "Area reveal requires an explicit fill clip; apply lineReveal only to line marks",
          );
        if (node.kind === "polyline" && p < 1 && node.style?.strokeDasharray)
          fail(
            "UNSUPPORTED_REVEAL",
            "Line reveal cannot replace authored stroke dashes",
          );
        return vector.path(
          present({
            ...common,
            d,
            fill:
              node.kind === "polyline" ? (common.fill ?? "none") : common.fill,
            fillRule:
              node.kind === "area" && node.polygons !== undefined
                ? "evenodd"
                : undefined,
            vectorEffect: "non-scaling-stroke",
            ...(node.kind === "polyline" && p < 1
              ? {
                  pathLength: 1,
                  strokeDasharray: 1,
                  strokeDashoffset: 1 - p,
                }
              : {}),
          }),
        );
      }
      case "dot":
        if (node.radius < 0)
          fail("INVALID_GEOMETRY", "Dot radius must be nonnegative");
        return vector.circle({
          ...common,
          ...(progress(motion.lineReveal) < 1 ? { opacity: 0 } : {}),
          cx: finite(node.x, "Dot x"),
          cy: finite(node.y, "Dot y"),
          r: finite(node.radius, "Dot radius"),
        });
      case "rect": {
        if (node.radius !== undefined) finite(node.radius, "Rect radius");
        if (node.cornerRadii)
          node.cornerRadii.forEach((r) => finite(r, "Corner radius"));
        let x = finite(node.x, "Rect x"),
          y = finite(node.y, "Rect y"),
          width = finite(node.width, "Rect width"),
          height = finite(node.height, "Rect height");
        if (width < 0 || height < 0)
          fail("INVALID_GEOMETRY", "Rectangle dimensions must be nonnegative");
        const p = progress(motion.barsGrow);
        if (p < 1 && owner) {
          const axis =
            owner.y1Value !== undefined
              ? "y"
              : owner.x1Value !== undefined
                ? "x"
                : undefined;
          if (!axis)
            fail(
              "UNSUPPORTED_BAR_BASELINE",
              `No public interval baseline for ${node.key}`,
            );
          // The public point is the value end. The opposite rectangle edge
          // is its baseline, including reversed and named scales and stacks.
          const endpoint = axis === "y" ? owner.y - ty : owner.x - tx;
          const near = axis === "y" ? y : x;
          const far = near + (axis === "y" ? height : width);
          const baseline =
            Math.abs(endpoint - near) <= Math.abs(endpoint - far) ? far : near;
          finite(baseline, "Bar baseline");
          if (axis === "y") {
            y = baseline + (y - baseline) * p;
            height *= p;
          } else {
            x = baseline + (x - baseline) * p;
            width *= p;
          }
        }
        return node.cornerRadii
          ? vector.path({
              ...common,
              d: rectCornerRadiiPath(x, y, width, height, node.cornerRadii),
            })
          : vector.rect(
              present({
                ...common,
                x,
                y,
                width,
                height,
                rx: node.radius,
              }),
            );
      }
      case "label": {
        if (node.focusOpacity)
          fail("UNSUPPORTED_FOCUS_STATE", `Dynamic label opacity ${node.key}`);
        const x = finite(node.x, "Label x"),
          y = finite(node.y, "Label y");
        if (node.fontSize !== undefined) finite(node.fontSize, "Font size");
        if (node.fontWeight !== undefined)
          finite(node.fontWeight, "Font weight");
        return vector.text(
          present({
            ...common,
            x,
            y,
            size: node.fontSize,
            weight: node.fontWeight,
            family: typography.fontFamily,
            letterSpacing: typography.letterSpacing,
            anchor: node.anchor,
            dominantBaseline: node.baseline,
            transform:
              node.rotate === undefined
                ? undefined
                : `rotate(${finite(node.rotate, "Label rotation")} ${x} ${y})`,
          }),
          node.text,
        );
      }
    }
  }
  const artwork = Vector(
    {
      id: options.id,
      width: options.width,
      height: options.height,
      viewBox: {
        x: 0,
        y: 0,
        width: options.width,
        height: options.height,
      },
    },
    vector.group(
      { fill: scene.theme.foreground },
      ...scene.nodes.map((n) => convert(n)),
    ),
  );
  return {
    artwork,
    scene,
    points: scene.points,
    diagnostics: options.measureText
      ? []
      : [
          {
            code: "APPROXIMATE_TEXT_METRICS",
            message:
              "Layout uses deterministic estimated text metrics; supply measureText for font-qualified spacing.",
          },
        ],
    point: (key) => points.get(key),
    mark: (id) => marks.get(id) ?? [],
    project(channel, value) {
      const scale = scene.scales[channel];
      if (!scale) fail("UNKNOWN_SCALE", `Unknown channel ${channel}`);
      return finite(scale.map(value), "Projected coordinate");
    },
    pathPoint(key, p) {
      const entry = paths.get(key);
      if (!entry) fail("UNKNOWN_PATH", `Unknown path ${key}`);
      const amount = progress(p);
      const point =
        !/[LlCcQqAaHhVvSsTt]/.test(entry.d.replace(/^\s*[Mm]/, "")) &&
        entry.first
          ? entry.first
          : pointAt(entry.d, amount);
      return { x: point.x + entry.x, y: point.y + entry.y };
    },
  };
}
