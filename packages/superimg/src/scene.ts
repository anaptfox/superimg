//! Pure spatial inspection of the same tree used for paint and export.
export {
  resolveSceneTree,
  collectSceneSnapshots,
  collectSceneDescriptions,
  multiplySceneMatrices,
  transformScenePoint,
  transformSceneBounds,
} from "@superimg/stdlib/tree";
export type {
  VisualDefinition,
  SubjectBinding,
  SubjectValue,
  VisualFrame,
  VisualPart,
  VisualAnchor,
  InstanceProps,
  SpatialSceneProps,
  SpatialSceneSnapshot,
  SceneBounds,
  SceneMatrix,
  ScenePoint,
  ScenePosition,
  SceneProjection,
  MediaSemantic,
  SceneHitRegion,
} from "@superimg/types";

import type { MediaIR, SceneSnapshot } from "@superimg/types";

export interface SceneObservationRange {
  readonly startFrame: number;
  readonly endFrame: number;
  readonly scenes: readonly SceneSnapshot[];
}

/** Decode schema-0 scene observations. Absence means no declared scene, never inferred identity. */
export function sceneObservations(
  ir: Pick<MediaIR, "extensions">,
): readonly SceneObservationRange[] {
  const extension = ir.extensions["superimg/scene"];
  if (!extension) return [];
  if (extension.schemaVersion !== 0)
    throw new TypeError("Unsupported scene extension schema");
  const payload = extension.payload as unknown as {
    ranges?: SceneObservationRange[];
  };
  if (!payload || !Array.isArray(payload.ranges))
    throw new TypeError("Invalid scene observation ranges");
  let end = 0;
  for (const range of payload.ranges) {
    if (
      !Number.isSafeInteger(range.startFrame) ||
      !Number.isSafeInteger(range.endFrame) ||
      range.startFrame < end ||
      range.endFrame <= range.startFrame ||
      !Array.isArray(range.scenes)
    )
      throw new TypeError("Invalid scene observation range");
    for (const scene of range.scenes) {
      if (
        scene.schemaVersion !== 0 ||
        typeof scene.sceneId !== "string" ||
        !Array.isArray(scene.nodes)
      )
        throw new TypeError("Invalid scene observation");
    }
    end = range.endFrame;
  }
  return structuredClone(payload.ranges);
}

export function scenesAtFrame(
  ir: Pick<MediaIR, "extensions">,
  frame: number,
): readonly SceneSnapshot[] {
  if (!Number.isSafeInteger(frame) || frame < 0)
    throw new RangeError("Scene frame must be a nonnegative integer");
  return (
    sceneObservations(ir).find(
      (range) => frame >= range.startFrame && frame < range.endFrame,
    )?.scenes ?? []
  );
}
