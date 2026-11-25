/**
 * Semantic scene authoring helpers — pure functions for templates and apps.
 * Exported only from `@foxworth/superimg/interactive/define`.
 */

/** Subset of SceneTransform used for deep-merge (mirrors types package). */
export interface SceneTransformPatch {
  x?: number;
  y?: number;
  z?: number;
  scale?: number;
  scaleX?: number;
  scaleY?: number;
  rotate?: number;
  rotateX?: number;
  rotateY?: number;
}

export interface SceneAnimationPatch {
  type: string;
  progress?: number;
  durationMs?: number;
  easing?: string;
  iterations?: number;
  intensity?: number;
}

/**
 * Subset of SceneNodeStatePatch for authoring merges.
 * Intentionally omits `properties` so the result stays assignable to
 * SceneNodeStatePatch without a types↔stdlib cycle on JsonObject.
 */
export interface SceneNodePatch {
  visible?: boolean;
  opacity?: number;
  transform?: SceneTransformPatch;
  animation?: SceneAnimationPatch | null;
}

export interface CenteredCameraOpts {
  zoom: number;
  rotation?: number;
  fit?: { target: string; padding?: number } | null;
  /** Clear follow when centering (default true). */
  clearFollow?: boolean;
}

export interface CenteredCameraResult {
  x: number;
  y: number;
  zoom: number;
  rotation: number;
  fit: { target: string; padding?: number } | null | undefined;
  follow: null | undefined;
}

/**
 * Centered pan compensation for zoom so the viewport stays framed on center.
 * Shared by templates (`scene.states` cameras) and runtime `camera.center()`.
 */
export function centeredCamera(
  width: number,
  height: number,
  opts: CenteredCameraOpts,
): CenteredCameraResult {
  if (!Number.isFinite(width) || width <= 0) {
    throw new Error(`interactive.scene.centeredCamera: width must be a positive finite number (got ${width})`);
  }
  if (!Number.isFinite(height) || height <= 0) {
    throw new Error(`interactive.scene.centeredCamera: height must be a positive finite number (got ${height})`);
  }
  const zoom = opts.zoom;
  if (!Number.isFinite(zoom) || zoom <= 0) {
    throw new Error(`interactive.scene.centeredCamera: zoom must be a positive finite number (got ${zoom})`);
  }
  const rotation = opts.rotation ?? 0;
  const clearFollow = opts.clearFollow !== false;
  // Avoid signed zero when zoom === 1 (Object.is(-0, 0) is false).
  const x = -(width * (zoom - 1)) / 2 || 0;
  const y = -(height * (zoom - 1)) / 2 || 0;
  return {
    x,
    y,
    zoom,
    rotation,
    fit: opts.fit === undefined ? undefined : opts.fit,
    follow: clearFollow ? null : undefined,
  };
}

function mergeTransform(
  base: SceneTransformPatch | undefined,
  over: SceneTransformPatch | undefined,
): SceneTransformPatch | undefined {
  if (!base && !over) return undefined;
  if (!over) return base ? { ...base } : undefined;
  if (!base) return { ...over };
  return { ...base, ...over };
}

/** Deep-merge one node patch onto another (transform fields merge field-wise). */
export function mergeNodePatch(base: SceneNodePatch, over: SceneNodePatch): SceneNodePatch {
  const out: SceneNodePatch = { ...base, ...over };
  const transform = mergeTransform(base.transform, over.transform);
  if (transform !== undefined) out.transform = transform;
  else delete out.transform;
  if (over.animation === null) out.animation = null;
  else if (over.animation !== undefined) out.animation = { ...over.animation };
  else if (base.animation !== undefined) {
    out.animation = base.animation === null ? null : { ...base.animation };
  }
  return out;
}

/**
 * Apply per-node overrides on a base map. Every base key is present in the
 * result; overrides may introduce new keys. Transforms deep-merge.
 *
 * Use for “quiet unless spotlighted” nodes so each act only declares deltas.
 *
 * Return type is intentionally structural (not the named SceneNodePatch alias)
 * so spreads assign cleanly into `scene.states({ nodes })` SceneNodeStatePatch maps.
 */
export function focusOn(
  base: Readonly<Record<string, SceneNodePatch>>,
  overrides: Readonly<Record<string, SceneNodePatch>> = {},
): Record<
  string,
  {
    visible?: boolean;
    opacity?: number;
    transform?: SceneTransformPatch;
    animation?: SceneAnimationPatch | null;
  }
> {
  const ids = new Set([...Object.keys(base), ...Object.keys(overrides)]);
  const result: Record<string, SceneNodePatch> = {};
  for (const id of ids) {
    const b = base[id];
    const o = overrides[id];
    if (b && o) result[id] = mergeNodePatch(b, o);
    else if (o) result[id] = mergeNodePatch({}, o);
    else if (b) result[id] = mergeNodePatch({}, b);
  }
  return result;
}

export interface CaptionStateOpts {
  /** Y offset for past (already-read) captions. Default -18. */
  pastY?: number;
  /** Y offset for future captions. Default 24. */
  futureY?: number;
  /** Active caption opacity. Default 1. */
  activeOpacity?: number;
  /** Inactive caption opacity. Default 0. */
  inactiveOpacity?: number;
}

/**
 * Direction-aware narration stack: past acts rest above, future below.
 * Keys are `${prefix}${id}` (default prefix `caption.`).
 */
export function captionStates(
  ids: readonly string[],
  active: string,
  opts: CaptionStateOpts = {},
): Record<
  string,
  {
    opacity: number;
    transform: { y: number };
  }
> {
  const prefix = "caption.";
  const pastY = opts.pastY ?? -18;
  const futureY = opts.futureY ?? 24;
  const activeOpacity = opts.activeOpacity ?? 1;
  const inactiveOpacity = opts.inactiveOpacity ?? 0;
  const activeIndex = ids.indexOf(active);
  const result: Record<string, { opacity: number; transform: { y: number } }> = {};
  for (let index = 0; index < ids.length; index++) {
    const id = ids[index]!;
    const isActive = id === active;
    const y = isActive ? 0 : activeIndex >= 0 && index < activeIndex ? pastY : futureY;
    result[`${prefix}${id}`] = {
      opacity: isActive ? activeOpacity : inactiveOpacity,
      transform: { y },
    };
  }
  return result;
}

/** Interactive-owned scene helper namespace. */
export const scene = {
  centeredCamera,
  focusOn,
  mergeNodePatch,
  captionStates,
} as const;

export type SceneStd = typeof scene;
