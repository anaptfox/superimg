//! Construct inverse operations for undo.

import type {
  EditOperationPreconditions,
  MediaEditCommand,
} from "@superimg/types";
import { EditError } from "./errors.js";
import { assertEditFrame } from "./time.js";

/**
 * Invert set-node-transform using the pre-edit x/y values.
 * Caller supplies previous from binding/source; op never carries old value.
 */
export function invertSetNodeTransform(
  op: Extract<MediaEditCommand, { kind: "set-node-transform" }>,
  previous: { x: number; y: number },
  expected: EditOperationPreconditions = op.expected,
): MediaEditCommand {
  if (typeof previous.x !== "number" || !Number.isFinite(previous.x)) {
    throw new EditError("invalid_type", "previous.x must be finite");
  }
  if (typeof previous.y !== "number" || !Number.isFinite(previous.y)) {
    throw new EditError("invalid_type", "previous.y must be finite");
  }
  return {
    schemaVersion: 0,
    source: op.source,
    kind: "set-node-transform",
    target: { ...op.target },
    value: { x: previous.x, y: previous.y },
    expected: clonePreconditions(expected),
  };
}

/**
 * Invert trim-scene-end by restoring the previous global end frame.
 * After apply, expected hashes on the inverse are filled by the journal layer.
 */
export function invertTrimSceneEnd(
  op: Extract<MediaEditCommand, { kind: "trim-scene-end" }>,
  previousEndFrame: number,
  expected: EditOperationPreconditions = op.expected,
): MediaEditCommand {
  assertEditFrame(previousEndFrame, "previousEndFrame");
  if (previousEndFrame < 1) {
    throw new EditError(
      "invalid_frame",
      "previousEndFrame must be >= 1",
      { previousEndFrame },
    );
  }
  return {
    schemaVersion: 0,
    source: op.source,
    kind: "trim-scene-end",
    target: { ...op.target },
    mode: "ripple",
    end: { space: "global", frame: previousEndFrame },
    expected: clonePreconditions(expected),
  };
}

/**
 * Invert set-phase-boundary by restoring previous left/right weights.
 */
export function invertSetPhaseBoundary(
  op: Extract<MediaEditCommand, { kind: "set-phase-boundary" }>,
  previous: { left: number; right: number },
  expected: EditOperationPreconditions = op.expected,
): MediaEditCommand {
  if (
    typeof previous.left !== "number" ||
    !Number.isFinite(previous.left) ||
    previous.left <= 0
  ) {
    throw new EditError("invalid_type", "previous.left must be finite > 0");
  }
  if (
    typeof previous.right !== "number" ||
    !Number.isFinite(previous.right) ||
    previous.right <= 0
  ) {
    throw new EditError("invalid_type", "previous.right must be finite > 0");
  }
  return {
    schemaVersion: 0,
    source: op.source,
    kind: "set-phase-boundary",
    target: { ...op.target },
    mode: "zero-sum",
    value: { left: previous.left, right: previous.right },
    unit: op.unit,
    expected: clonePreconditions(expected),
  };
}

/** Invert a retained-composition still hold by restoring its literal source value. */
export function invertSetCompositionHold(
  op: Extract<MediaEditCommand, { kind: "set-composition-hold" }>,
  previousHold: string,
  expected: EditOperationPreconditions = op.expected,
): MediaEditCommand {
  if (!/^(?:\d+(?:\.\d+)?|\.\d+)(?:ms|s|f)$/.test(previousHold)) {
    throw new EditError("invalid_type", "previousHold must be a literal duration ending in ms, s, or f", { previousHold });
  }
  return {
    schemaVersion: 0,
    source: op.source,
    kind: "set-composition-hold",
    target: { ...op.target },
    value: { hold: previousHold },
    expected: clonePreconditions(expected),
  };
}

export function invertOperation(
  op: MediaEditCommand,
  previous:
    | { kind: "set-audio-clip-placement"; atSeconds: number }
    | { kind: "set-node-property"; value: string | number }
    | { kind: "set-node-text"; text: string }
    | { kind: "set-node-transform"; x: number; y: number }
    | { kind: "trim-scene-end"; endFrame: number }
    | { kind: "set-phase-boundary"; left: number; right: number }
    | { kind: "set-composition-hold"; hold: string },
  expected: EditOperationPreconditions = op.expected,
): MediaEditCommand {
  if (op.kind === "set-audio-clip-placement") {
    if (previous.kind !== op.kind || !Number.isFinite(previous.atSeconds) || previous.atSeconds < 0) throw new EditError("invalid_type", "inverse previous must match audio placement");
    return { ...op, target: { ...op.target }, value: { atSeconds: previous.atSeconds }, expected: clonePreconditions(expected) };
  }
  if (op.kind === "set-node-property") {
    if (previous.kind !== op.kind) throw new EditError("invalid_type", "inverse previous must match set-node-property");
    return { ...op, target: { ...op.target }, value: { value: previous.value }, expected: clonePreconditions(expected) };
  }
  if (op.kind === "set-node-text") {
    if (previous.kind !== "set-node-text") throw new EditError("invalid_type", "inverse previous must match set-node-text");
    return { ...op, target: { ...op.target }, value: { text: previous.text }, expected: clonePreconditions(expected) };
  }
  if (op.kind === "set-node-transform") {
    if (previous.kind !== "set-node-transform") {
      throw new EditError(
        "invalid_type",
        "inverse previous must match set-node-transform",
      );
    }
    return invertSetNodeTransform(op, previous, expected);
  }
  if (op.kind === "set-phase-boundary") {
    if (previous.kind !== "set-phase-boundary") {
      throw new EditError(
        "invalid_type",
        "inverse previous must match set-phase-boundary",
      );
    }
    return invertSetPhaseBoundary(op, previous, expected);
  }
  if (op.kind === "set-composition-hold") {
    if (previous.kind !== "set-composition-hold") {
      throw new EditError("invalid_type", "inverse previous must match set-composition-hold");
    }
    return invertSetCompositionHold(op, previous.hold, expected);
  }
  if (previous.kind !== "trim-scene-end") {
    throw new EditError(
      "invalid_type",
      "inverse previous must match trim-scene-end",
    );
  }
  return invertTrimSceneEnd(op, previous.endFrame, expected);
}

function clonePreconditions(
  expected: EditOperationPreconditions,
): EditOperationPreconditions {
  return {
    intentHash: expected.intentHash,
    sourceHashes: { ...expected.sourceHashes },
  };
}
