import { vector, type MediaChild } from "@superimg/stdlib/tree";

export const r = (x: number, y: number, width: number, height: number, fill: string, opacity = 1) =>
  vector.rect({ x, y, width, height, fill, opacity, shapeRendering: "crispEdges" });
export const ellipse = (cx: number, cy: number, rx: number, ry: number, fill: string, opacity = 1) =>
  vector.ellipse({ cx, cy, rx, ry, fill, opacity });
export const poly = (points: readonly (readonly [number, number])[], fill: string) =>
  vector.polygon({ points, fill, shapeRendering: "crispEdges" });
export const line = (x1: number, y1: number, x2: number, y2: number, stroke: string, strokeWidth = 1) =>
  vector.line({ x1, y1, x2, y2, stroke, strokeWidth, strokeLinecap: "round" });
export const place = (x: number, y: number, children: MediaChild[], scale = 1, rotate = 0) =>
  vector.group({ transform: { x, y, scale, rotate } }, ...children);
