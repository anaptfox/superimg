//! Tagged frame validation and scene/global conversion for P0 editing.

import type {
  EditFramePoint,
  EditFrameRange,
  EditTimeSpace,
} from "@superimg/types";
import type { MediaIRFrameRange } from "@superimg/types";
import { EditError } from "./errors.js";

const P0_SPACES: ReadonlySet<EditTimeSpace> = new Set(["scene", "global"]);

/** True when space is implemented for P0 conversions. */
export function isP0TimeSpace(space: EditTimeSpace): boolean {
  return P0_SPACES.has(space);
}

/**
 * Assert integer, non-negative, finite frame value.
 * Fractional frames are rejected (editing is frame-authoritative).
 */
export function assertEditFrame(
  frame: number,
  path = "frame",
): asserts frame is number {
  if (typeof frame !== "number" || !Number.isFinite(frame)) {
    throw new EditError("invalid_frame", `${path} must be a finite number`, {
      frame,
    });
  }
  if (!Number.isInteger(frame)) {
    throw new EditError("invalid_frame", `${path} must be an integer`, {
      frame,
    });
  }
  if (frame < 0) {
    throw new EditError("invalid_frame", `${path} must be non-negative`, {
      frame,
    });
  }
}

/** Zero-based half-open range: endFrame >= startFrame. */
export function assertEditFrameRange(
  range: Pick<EditFrameRange, "startFrame" | "endFrame">,
  path = "range",
): void {
  assertEditFrame(range.startFrame, `${path}.startFrame`);
  assertEditFrame(range.endFrame, `${path}.endFrame`);
  if (range.endFrame < range.startFrame) {
    throw new EditError(
      "invalid_range",
      `${path} must be half-open with endFrame >= startFrame`,
      { range },
    );
  }
}

export function assertEditFramePoint(point: EditFramePoint, path = "point"): void {
  if (typeof point !== "object" || point === null) {
    throw new EditError("invalid_type", `${path} must be an object`);
  }
  if (typeof point.space !== "string") {
    throw new EditError("invalid_type", `${path}.space must be a string`);
  }
  assertEditFrame(point.frame, `${path}.frame`);
}

/**
 * Scene-local frame 0 is the first frame of the scene's global range.
 * Scene-local end is exclusive relative to scene start.
 */
export function sceneFrameToGlobal(
  sceneFrame: number,
  sceneRange: MediaIRFrameRange,
): number {
  assertEditFrame(sceneFrame, "sceneFrame");
  assertEditFrame(sceneRange.startFrame, "sceneRange.startFrame");
  assertEditFrame(sceneRange.endFrame, "sceneRange.endFrame");
  if (sceneRange.endFrame < sceneRange.startFrame) {
    throw new EditError("invalid_range", "sceneRange inverted", { sceneRange });
  }
  return sceneRange.startFrame + sceneFrame;
}

export function globalFrameToScene(
  globalFrame: number,
  sceneRange: MediaIRFrameRange,
): number {
  assertEditFrame(globalFrame, "globalFrame");
  assertEditFrame(sceneRange.startFrame, "sceneRange.startFrame");
  return globalFrame - sceneRange.startFrame;
}

/**
 * Convert a tagged frame point between scene and global.
 * `source` / `clip` / `parent` are reserved and throw.
 */
export function convertEditFramePoint(
  point: EditFramePoint,
  targetSpace: "scene" | "global",
  sceneRange: MediaIRFrameRange,
): EditFramePoint {
  assertEditFramePoint(point);
  if (!isP0TimeSpace(point.space)) {
    throw new EditError(
      "unknown_space",
      `time space "${point.space}" is not implemented in P0`,
      { space: point.space },
    );
  }
  if (point.space === targetSpace) {
    return { ...point, space: targetSpace };
  }

  if (point.space === "scene" && targetSpace === "global") {
    return {
      space: "global",
      frame: sceneFrameToGlobal(point.frame, sceneRange),
      ...(point.ownerId !== undefined ? { ownerId: point.ownerId } : {}),
    };
  }

  if (point.space === "global" && targetSpace === "scene") {
    return {
      space: "scene",
      frame: globalFrameToScene(point.frame, sceneRange),
      ...(point.ownerId !== undefined ? { ownerId: point.ownerId } : {}),
    };
  }

  throw new EditError(
    "unknown_space",
    `cannot convert ${point.space} → ${targetSpace}`,
    { point, targetSpace },
  );
}

export function convertEditFrameRange(
  range: EditFrameRange,
  targetSpace: "scene" | "global",
  sceneRange: MediaIRFrameRange,
): EditFrameRange {
  assertEditFrameRange(range);
  const start = convertEditFramePoint(
    {
      space: range.space,
      frame: range.startFrame,
      ...(range.ownerId !== undefined ? { ownerId: range.ownerId } : {}),
    },
    targetSpace,
    sceneRange,
  );
  const end = convertEditFramePoint(
    {
      space: range.space,
      frame: range.endFrame,
      ...(range.ownerId !== undefined ? { ownerId: range.ownerId } : {}),
    },
    targetSpace,
    sceneRange,
  );
  return {
    space: targetSpace,
    startFrame: start.frame,
    endFrame: end.frame,
    ...(range.ownerId !== undefined ? { ownerId: range.ownerId } : {}),
  };
}

/** Scene length in frames (half-open). */
export function sceneLengthFrames(sceneRange: MediaIRFrameRange): number {
  assertEditFrameRange(sceneRange, "sceneRange");
  return sceneRange.endFrame - sceneRange.startFrame;
}
