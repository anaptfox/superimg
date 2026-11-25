import type { ResolvedVisualPart, SceneBounds, SceneMatrix } from "../superimg-stdlib/src/scene-types.js";
import type { MediaNode } from "../superimg-stdlib/src/tree/node-types.js";
import { resolveSceneTree } from "../superimg-stdlib/src/tree/scene.js";

type Draw = SceneBounds & {
  id: string;
  matrix: SceneMatrix;
  opacity: number;
} & ({ kind: "rect" | "ellipse"; color: string } | { kind: "sprite"; asset: string });

interface Anchor {
  entity: string;
  name: string;
  x: number;
  y: number;
}

export interface NativeSceneFrame {
  width: number;
  height: number;
  draw: Draw[];
  anchors: Anchor[];
}

export interface NativeSceneViewport {
  width: number;
  height: number;
  scale: number;
  safeArea: { top: number; left: number; bottom: number; right: number };
  reduceMotion: boolean;
}

const common = ["id", "key", "semantic", "data-si-node", "data-si-actions", "opacity"];
const paint = [...common, "fill", "fillOpacity"];
const coordinate = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value);

function color(value: unknown, opacity: unknown): string | undefined {
  if (typeof value !== "string" || !/^#[0-9a-f]{6}([0-9a-f]{2})?$/i.test(value)) return undefined;
  if (opacity === undefined) return value;
  if (!coordinate(opacity) || opacity < 0 || opacity > 1) return undefined;
  const alpha = value.length === 9 ? Number.parseInt(value.slice(7), 16) : 255;
  return value.slice(0, 7) + Math.round(alpha * opacity).toString(16).padStart(2, "0");
}

function projectPart(part: ResolvedVisualPart, element: MediaNode, bounds: SceneBounds, opacity: number): Draw {
  const props = element.props;
  const fail = () => new TypeError(`Unsupported native paint at ${part.id} (${element.type})`);
  const only = (keys: readonly string[]) => Object.keys(props).every(key => props[key] === undefined || keys.includes(key));
  const alpha = props.opacity ?? 1;
  if (!coordinate(alpha) || alpha < 0 || alpha > 1 || element.children.length) throw fail();
  const base = { id: part.id, matrix: part.matrix, opacity: opacity * alpha };
  if (element.type === "Image" && only([...common, "src", "x", "y", "width", "height", "fit"])) {
    const { src, x = 0, y = 0, width = bounds.width, height = bounds.height, fit } = props;
    const w = width === "fill" ? bounds.width : width;
    const h = height === "fill" ? bounds.height : height;
    if (fit === "fill" && typeof src === "string" && src.length &&
        coordinate(x) && coordinate(y) && coordinate(w) && coordinate(h) && w >= 0 && h >= 0) {
      return { ...base, kind: "sprite", asset: src, x: bounds.x + x, y: bounds.y + y, width: w, height: h };
    }
  }
  const fill = color(props.fill ?? "#000000", props.fillOpacity ?? props["fill-opacity"]);
  if (!fill) throw fail();
  if (["VectorRect", "rect"].includes(element.type) && only([...paint, "x", "y", "width", "height"])) {
    const { x = 0, y = 0, width, height } = props;
    if (coordinate(x) && coordinate(y) && coordinate(width) && coordinate(height) && width >= 0 && height >= 0) {
      return { ...base, kind: "rect", color: fill, x, y, width, height };
    }
  }
  const circle = ["VectorCircle", "circle"].includes(element.type);
  if ((circle || ["VectorEllipse", "ellipse"].includes(element.type)) &&
      only([...paint, "cx", "cy", ...(circle ? ["r"] : ["rx", "ry"])])) {
    const { cx = 0, cy = 0, rx = props.r, ry = props.r } = props;
    if (coordinate(cx) && coordinate(cy) && coordinate(rx) && coordinate(ry) && rx >= 0 && ry >= 0) {
      return { ...base, kind: "ellipse", color: fill, x: cx - rx, y: cy - ry, width: 2 * rx, height: 2 * ry };
    }
  }
  throw fail();
}

/** Projects one authored Scene, preserving the shared camera, depth, and anchor math. */
export function projectNativeScene(scene: MediaNode): NativeSceneFrame {
  if (scene.type !== "Scene" || scene.props.clip === false) {
    throw new TypeError("Native playback requires a single clipped Scene");
  }
  const draw: Draw[] = [];
  const resolved = resolveSceneTree(scene, {
    onPaintPart(part, content, bounds, opacity) {
      const command = projectPart(part, content, bounds, opacity);
      if (command.opacity > 0) draw.push(command);
    },
  });
  const snapshot = resolved.sceneSnapshot;
  if (!snapshot) throw new TypeError("Native playback requires an authored spatial Scene");
  const visible = new Set(snapshot.nodes.filter(node => node.visible && node.opacity > 0).map(node => node.id));
  const anchors = snapshot.instances.flatMap(instance => visible.has(instance.id)
    ? Object.entries(instance.anchors).map(([name, { x, y }]) => ({
      entity: instance.entityId ?? instance.id, name, x, y,
    }))
    : []);
  return { width: snapshot.viewport.width, height: snapshot.viewport.height, draw, anchors };
}

/** Expose a pure sample function in the JS bundle shipped with the Swift host. */
export function installSuperImgSampler<State>(
  render: (seconds: number, viewport: NativeSceneViewport, state: State) => MediaNode,
): void {
  Object.assign(globalThis, {
    superimgSample: (seconds: number, viewport: NativeSceneViewport, state: State) =>
      projectNativeScene(render(seconds, viewport, state)),
  });
}
