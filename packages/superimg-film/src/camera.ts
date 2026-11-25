import { vector } from "@superimg/stdlib/tree";
import { isMediaElement, type CanvasSize, type MediaChild } from "@superimg/types";
import { castHead } from "./cast.js";
import { clamp } from "./math.js";
import { apply, parseTransform, typedTransform } from "./transform.js";
import type { Point, Rect } from "./types.js";

type View = { zoom: number; y?: number; x?: number };
const CAMERA = Symbol.for("superimg.film.camera");
type TaggedCamera = { [CAMERA]?: { point: Point; view: View; obstacles: readonly Rect[] } };

export function closeOn(
  point: Point,
  view: View,
  art: MediaChild[],
  /** Obstacles in the same local coordinates as the camera group's art. */
  obstacles: readonly Rect[] = [],
): MediaChild {
  if (!(view.zoom > 0) || !Number.isFinite(view.zoom)) {
    throw new Error(`closeOn needs a positive zoom; received ${view.zoom}.`);
  }
  const group = vector.group({}, ...art);
  Object.defineProperty(group, CAMERA, {
    value: { point: { ...point }, view: { ...view }, obstacles: obstacles.map(rect => ({ ...rect })) },
  });
  return group;
}

// A zoom above 1 crops the stage, so the offset is limited to keep its edges
// off the screen. A zoom below 1 leaves bars: the offset is limited to keep the
// whole stage on screen, which centres it on the point (an exactly centred
// point gives a centred stage) until the stage meets a screen edge.
function offset(anchor: number, point: number, scale: number, extent: number) {
  const reach = extent * (1 - scale);
  return clamp(anchor - point * scale, Math.min(0, reach), Math.max(0, reach));
}

export function cameraTransform({ x, y }: Point, view: View, stage: CanvasSize) {
  const scale = view.zoom;
  return {
    scale,
    x: offset(view.x ?? stage.width / 2, x, scale, stage.width),
    y: offset(view.y ?? stage.height / 2, y, scale, stage.height),
  };
}

type Project = (point: Point) => Point;

export function projectRect({ x, y, width, height }: Rect, project: Project): Rect {
  const corners = [
    project({ x, y }),
    project({ x: x + width, y }),
    project({ x, y: y + height }),
    project({ x: x + width, y: y + height }),
  ];
  const xs = corners.map(point => point.x);
  const ys = corners.map(point => point.y);
  const left = Math.min(...xs);
  const top = Math.min(...ys);
  return { x: left, y: top, width: Math.max(...xs) - left, height: Math.max(...ys) - top };
}

export function projectShot(art: MediaChild[], stage: CanvasSize) {
  const heads = new Map<string, Point>();
  const obstacles: Rect[] = [];
  function visit(child: MediaChild, project: Project): MediaChild {
    if (Array.isArray(child)) return child.map(part => visit(part, project));
    if (!isMediaElement(child)) return child;
    const head = castHead(child);
    if (head && !heads.has(head.name.toLowerCase())) heads.set(head.name.toLowerCase(), project(head.point));
    const camera = (child as TaggedCamera)[CAMERA];
    if (camera) {
      const transform = cameraTransform(camera.point, camera.view, stage);
      const { x, y, scale } = transform;
      const map: Project = point => project({ x: point.x * scale + x, y: point.y * scale + y });
      for (const rect of camera.obstacles ?? []) obstacles.push(projectRect(rect, map));
      return vector.group({ transform }, ...child.children.map(part => visit(part, map)));
    }
    if (child.children.length === 0) return child;
    // Every enclosing group transform (place(), vector.group({ transform })) moves its heads too.
    const transform = child.type === "VectorGroup" ? typedTransform(child.props.transform) : undefined;
    const matrix = transform ? parseTransform(transform) : undefined;
    const inner: Project = matrix ? point => project(apply(matrix, point.x, point.y)) : project;
    const children = child.children.map(part => visit(part, inner));
    return children.some((part, i) => part !== child.children[i]) ? { ...child, children } : child;
  }
  return { art: art.map(part => visit(part, point => point)), heads, obstacles };
}

export function extractFocusPoint(art: readonly MediaChild[]): Point | undefined {
  function visit(child: MediaChild, project: Project): Point | undefined {
    if (Array.isArray(child)) {
      for (const part of child) {
        const found = visit(part, project);
        if (found) return found;
      }
      return undefined;
    }
    if (!isMediaElement(child)) return undefined;
    const camera = (child as TaggedCamera)[CAMERA];
    if (camera) return project(camera.point);
    if (child.children.length === 0) return undefined;
    const transform = child.type === "VectorGroup" ? typedTransform(child.props.transform) : undefined;
    const matrix = transform ? parseTransform(transform) : undefined;
    const inner: Project = matrix ? point => project(apply(matrix, point.x, point.y)) : project;
    for (const part of child.children) {
      const found = visit(part, inner);
      if (found) return found;
    }
    return undefined;
  }
  for (const part of art) {
    const found = visit(part, point => point);
    if (found) return found;
  }
  return undefined;
}

export function viewport(
  stage: CanvasSize,
  screen: CanvasSize,
  fit: "contain" | "cover" | "focus",
  focusPoint?: Point,
) {
  if (fit === "focus") {
    const scale = Math.max(screen.width / stage.width, screen.height / stage.height);
    const focus = focusPoint ?? { x: stage.width / 2, y: stage.height / 2 };
    const minX = Math.min(0, screen.width - stage.width * scale);
    const minY = Math.min(0, screen.height - stage.height * scale);
    return {
      scale,
      x: clamp(screen.width / 2 - focus.x * scale, minX, 0),
      y: clamp(screen.height / 2 - focus.y * scale, minY, 0),
    };
  }
  const scale = (fit === "contain" ? Math.min : Math.max)(screen.width / stage.width, screen.height / stage.height);
  return { scale, x: (screen.width - stage.width * scale) / 2, y: (screen.height - stage.height * scale) / 2 };
}
