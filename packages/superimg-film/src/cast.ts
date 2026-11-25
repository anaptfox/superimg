import { vector, type VectorGroupProps } from "@superimg/stdlib/tree";
import type { MediaChild, MediaElement } from "@superimg/types";
import type { CastMember, CastPlacement, Point, PropDrawer } from "./types.js";

type Shape = { fill: string; d: string };
/** A compiled character rig, as a `*.rig.toml` import or pre-compiled JSON provides it. */
export type Rig = {
  w: number;
  h: number;
  poses: Record<string, readonly Shape[]> & { rest: readonly Shape[] };
  moves?: Record<string, readonly { pose: string; ms: number; alt?: number }[]>;
};

/** Declarative PNG/WebP/SVG cutout speaker rendered via `vector.image`. */
export type ImageCutoutSpec = {
  kind: "image";
  /** Default image URL, data URI, or resolved asset path. */
  src: string;
  /** Optional pose-name → image URL map (e.g. `{ talk, happy, surprised }`). */
  poses?: Readonly<Record<string, string>>;
  width: number;
  height: number;
  /** Ground-contact anchor in local image coordinates (defaults to bottom-center). */
  anchor?: Point;
  /** Head point relative to `anchor` at scale 1 (e.g. `{ x: 0, y: -height }`). */
  head: Point;
  shadow?: boolean;
  imageRendering?: "auto" | "optimizeSpeed" | "optimizeQuality" | "pixelated";
};

/** Declarative inline SVG cutout speaker rendered via an SVG data URI in `vector.image`. */
export type SvgCutoutSpec = {
  kind: "svg";
  viewBox: { width: number; height: number };
  markup: string;
  /** Optional pose-name → SVG inner markup map. */
  poses?: Readonly<Record<string, string>>;
  width?: number;
  height?: number;
  anchor?: Point;
  head: Point;
  shadow?: boolean;
};

type Drawn = { draw: (t: number, at: Point, options: CastPlacement) => MediaChild[]; head: Point };

export type CastCommonOptions = {
  seed?: number;
  /** Speaker display label printed in bubbles (defaults to `name.toUpperCase()`). */
  label?: string;
  /** Arbitrary theme/series metadata (e.g. badgeColor, voiceId). */
  meta?: Readonly<Record<string, unknown>>;
};

// The tag follows the authored object across separately built shot modules.
const CAST_NAME = Symbol.for("superimg.film.castName");
const CAST_LABEL = Symbol.for("superimg.film.castLabel");
const CAST_META = Symbol.for("superimg.film.castMeta");
const CAST_HEAD = Symbol.for("superimg.film.castHead");
/**
 * Which cast member or prop a group draws. A private tag, not a SuperImg semantic id:
 * the same subject may be drawn more than once in a frame (a match cut, a reflection).
 */
const SUBJECT = Symbol.for("superimg.film.subject");
export type SubjectTag = { id: string; kind: "cast" | "prop" };
export const subjectOf = (node: unknown): SubjectTag | undefined =>
  node !== null && typeof node === "object" ? (node as { [SUBJECT]?: SubjectTag })[SUBJECT] : undefined;
function tagSubject<T extends object>(node: T, tag: SubjectTag): T {
  Object.defineProperty(node, SUBJECT, { value: tag });
  return node;
}
type TaggedMember = CastMember & {
  [CAST_NAME]?: string;
  [CAST_LABEL]?: string;
  [CAST_META]?: Readonly<Record<string, unknown>>;
};
type TaggedHead = { [CAST_HEAD]?: { name: string; point: Point } };
export const castName = (member: CastMember) => (member as TaggedMember)[CAST_NAME];
export const castLabel = (member: CastMember) => (member as TaggedMember)[CAST_LABEL];
export const castMeta = (member: CastMember) => (member as TaggedMember)[CAST_META];
export const castHead = (node: object) => (node as TaggedHead)[CAST_HEAD];

/**
 * The painted extent of a pose in rig cells. Rig paths are traced, so a run
 * (`h3`, `v-2`, `H5`, `V4`) counts however long it is, whether the path is
 * absolute or relative and however many cells it paints.
 */
export function paintedCells(shapes: readonly Shape[]) {
  let left = Infinity;
  let right = -Infinity;
  let top = Infinity;
  for (const { d } of shapes) {
    let x = 0, y = 0, startX = 0, startY = 0;
    const see = () => {
      left = Math.min(left, x);
      right = Math.max(right, x);
      top = Math.min(top, y);
    };
    for (const [, command, args] of d.matchAll(/([MmLlHhVvZz])([^A-Za-z]*)/g)) {
      const n = (args!.match(/[-+]?(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?/g) ?? []).map(Number);
      const relative = command === command!.toLowerCase();
      switch (command!.toUpperCase()) {
        case "Z": x = startX; y = startY; see(); break;
        case "H": for (const v of n) { x = relative ? x + v : v; see(); } break;
        case "V": for (const v of n) { y = relative ? y + v : v; see(); } break;
        default:
          for (let i = 0; i + 1 < n.length; i += 2) {
            x = relative ? x + n[i]! : n[i]!;
            y = relative ? y + n[i + 1]! : n[i + 1]!;
            if (command!.toUpperCase() === "M" && i === 0) { startX = x; startY = y; }
            see();
          }
      }
    }
  }
  return Number.isFinite(top) && right > left ? { left, right, top } : undefined;
}

function rigDrawer(rig: Rig, seed: number) {
  const poses = new Map(Object.entries(rig.poses).map(([pose, shapes]) => [pose, { shapes, painted: paintedCells(shapes) }]));
  const resting = poses.get("rest")!;
  const rest = resting.painted ?? { left: 0, right: rig.w };
  return (t: number, at: Point, o: CastPlacement) => {
    const blink = (t + seed * 0.77) % (2.7 + ((seed * 0.41) % 1.3)) < 0.13;
    const pose = o.pose ?? (o.walk ? (Math.floor(t / 0.16) % 2 ? "walk-a" : "walk-b") : (blink ? "blink" : "rest"));
    const { shapes, painted } = poses.get(pose) ?? resting;
    const size = o.size ?? 10;
    const lift = o.lift ?? 0;
    const cell = rig.w > 30 ? size / 2 : size;
    const restCentre = (rest.left + rest.right) / 2;
    const x = Math.round(at.x - (o.flip ? rig.w * cell - restCentre * cell : restCentre * cell));
    const top = Math.round(at.y - rig.h * cell) - lift;
    const stageX = (column: number) => x + (o.flip ? rig.w - column : column) * cell;
    const opacity = typeof o.opacity === "number" && o.opacity < 1 ? Number(o.opacity.toFixed(3)) : undefined;
    return {
      // The pose determines painted bounds, while placement uses the rest box.
      point: painted ? {
        x: (stageX(painted.left) + stageX(painted.right)) / 2,
        y: at.y - (rig.h - painted.top) * cell - lift,
      } : undefined,
      art: [
        // The shadow stays on the ground when the sprite lifts, and fades with it.
        ...(o.shadow === false ? [] : [vector.ellipse({
          cx: stageX(restCentre), cy: at.y + 2, rx: (rest.right - rest.left) * cell * 0.46,
          ry: Math.max(6, cell * 0.9), fill: "#000", opacity: opacity === undefined ? 0.26 : Number((0.26 * opacity).toFixed(3)),
          shapeRendering: "geometricPrecision",
        })]),
        vector.group({
          transform: { x: o.flip ? x + rig.w * cell : x, y: top, scaleX: o.flip ? -cell : cell, scaleY: cell },
          shapeRendering: "crispEdges",
          ...(opacity === undefined ? {} : { opacity }),
        }, ...shapes.map(shape => vector.path({ d: shape.d, fill: typeof o.tint === "string" ? o.tint : shape.fill }))),
      ],
    };
  };
}

function svgDataUri(viewBox: { width: number; height: number }, markup: string): string {
  const doc = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${viewBox.width} ${viewBox.height}">${markup}</svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(doc)}`;
}

function cutoutDrawer(spec: ImageCutoutSpec | SvgCutoutSpec) {
  const width = spec.kind === "image" ? spec.width : (spec.width ?? spec.viewBox.width);
  const height = spec.kind === "image" ? spec.height : (spec.height ?? spec.viewBox.height);
  const anchor = spec.anchor ?? { x: width / 2, y: height };
  const svgCache = spec.kind === "svg" ? new Map<string, string>() : undefined;
  const resolveHref = (pose: string | undefined): string => {
    if (spec.kind === "image") {
      return (pose && spec.poses?.[pose]) || spec.src;
    }
    const key = pose && spec.poses?.[pose] !== undefined ? pose : "__default";
    const cached = svgCache!.get(key);
    if (cached !== undefined) return cached;
    const markup = key === "__default" ? spec.markup : spec.poses![key]!;
    const uri = svgDataUri(spec.viewBox, markup);
    svgCache!.set(key, uri);
    return uri;
  };

  return (_t: number, at: Point, o: CastPlacement) => {
    const scale = o.size ?? 1;
    const lift = o.lift ?? 0;
    const flip = Boolean(o.flip);
    const opacity = typeof o.opacity === "number" && o.opacity < 1 ? Number(o.opacity.toFixed(3)) : undefined;
    const showShadow = o.shadow !== undefined ? o.shadow !== false : spec.shadow === true;
    const href = resolveHref(o.pose);
    return {
      point: {
        x: at.x + spec.head.x * scale * (flip ? -1 : 1),
        y: at.y + spec.head.y * scale - lift,
      },
      art: [
        ...(showShadow ? [vector.ellipse({
          cx: at.x,
          cy: at.y + 2,
          rx: width * scale * 0.36,
          ry: Math.max(4, height * scale * 0.06),
          fill: "#000",
          opacity: opacity === undefined ? 0.24 : Number((0.24 * opacity).toFixed(3)),
          shapeRendering: "geometricPrecision",
        })] : []),
        vector.group(
          {
            transform: {
              x: at.x,
              y: at.y - lift,
              scaleX: flip ? -scale : scale,
              scaleY: scale,
            },
            ...(opacity === undefined ? {} : { opacity }),
          },
          vector.image({
            href,
            x: -anchor.x,
            y: -anchor.y,
            width,
            height,
            ...(spec.kind === "image" && spec.imageRendering ? { imageRendering: spec.imageRendering } : {}),
          }),
        ),
      ],
    };
  };
}

export function cast(name: string, rig: Rig, options?: CastCommonOptions): CastMember;
export function cast(name: string, drawn: Drawn, options?: CastCommonOptions): CastMember;
export function cast(name: string, cutout: ImageCutoutSpec | SvgCutoutSpec, options?: CastCommonOptions): CastMember;
export function cast(
  name: string,
  subject: Rig | Drawn | ImageCutoutSpec | SvgCutoutSpec,
  options?: CastCommonOptions,
): CastMember {
  const id = name.trim();
  if (!id) throw new Error("cast() name must be a non-empty string.");
  const draw = "kind" in subject && (subject.kind === "image" || subject.kind === "svg")
    ? cutoutDrawer(subject)
    : "draw" in subject
      ? (t: number, at: Point, o: CastPlacement) => ({
        art: subject.draw(t, at, o),
        point: {
          x: at.x + subject.head.x * (o.size ?? 1) * (o.flip ? -1 : 1),
          // A drawn artist receives `lift` in its options and raises its own art.
          y: at.y + subject.head.y * (o.size ?? 1) - (o.lift ?? 0),
        },
      })
      : rigDrawer(subject, options?.seed ?? 0);
  const member: CastMember = (t, at, o = {}) => {
    const { art, point } = draw(t, at, o);
    const groupProps: VectorGroupProps = {
      ...(typeof o.opacity === "number" && o.opacity <= 0 ? { opacity: 0 } : {}),
    };
    const group = tagSubject(vector.group(groupProps, ...art), { id, kind: "cast" });
    if (point) Object.defineProperty(group, CAST_HEAD, { value: { name: id, point } });
    return group;
  };
  Object.defineProperty(member, CAST_NAME, { value: id });
  if (options?.label !== undefined) {
    Object.defineProperty(member, CAST_LABEL, { value: options.label });
  }
  if (options?.meta !== undefined) {
    Object.defineProperty(member, CAST_META, { value: Object.freeze({ ...options.meta }) });
  }
  return member;
}

function wrapProp(id: string, art: MediaChild | readonly MediaChild[]) {
  const children: MediaChild[] = Array.isArray(art) ? [...art] : [art as MediaChild];
  return tagSubject(vector.group({}, ...children), { id, kind: "prop" });
}

/**
 * Tag a prop so the film's breakdown and continuity checks know which shots it
 * appears in. Accepts either a reusable draw function or art directly, and
 * wraps the output in a group tagged with the prop's name. The same prop may be drawn
 * more than once in a frame.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function prop<Fn extends (...args: any[]) => MediaChild | readonly MediaChild[]>(
  name: string,
  draw: Fn,
): PropDrawer<Parameters<Fn>>;
export function prop(
  name: string,
  art: MediaChild | readonly MediaChild[],
): MediaElement<"VectorGroup", VectorGroupProps>;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function prop<Fn extends (...args: any[]) => MediaChild | readonly MediaChild[]>(
  name: string,
  drawOrArt: Fn | MediaChild | readonly MediaChild[],
): PropDrawer<Parameters<Fn>> | MediaElement<"VectorGroup", VectorGroupProps> {
  const id = name.trim();
  if (!id) throw new Error("prop() name must be a non-empty string.");
  if (typeof drawOrArt === "function") {
    return ((...args: Parameters<Fn>) => wrapProp(id, drawOrArt(...args))) as PropDrawer<Parameters<Fn>>;
  }
  return wrapProp(id, drawOrArt);
}
