//! Structural validation for edit operations and manifests.

import type {
  EditCapability,
  EditManifest,
  MediaEditCommand,
  EditReasonCode,
  EditSourceBinding,
} from "@superimg/types";
import { EditError } from "./errors.js";
import { assertEditFrame } from "./time.js";

const CAPABILITIES: ReadonlySet<string> = new Set([
  "exact",
  "inspect-only",
  "opaque",
]);

const REASON_CODES: ReadonlySet<string> = new Set([
  "animated-transform",
  "expression-binding",
  "missing-property",
  "computed-property",
  "spread-property",
  "duplicate-target",
  "unstable-node",
  "missing-stable-id",
  "cross-file-target",
  "derived-duration",
  "single-scene-template",
  "opaque-visual",
]);

const OP_KINDS: ReadonlySet<string> = new Set([
  "set-node-text",
  "set-node-property",
  "set-audio-clip-placement",
  "set-node-transform",
  "trim-scene-end",
  "set-phase-boundary",
  "set-composition-hold",
]);

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function reqObject(value: unknown, path: string): Record<string, unknown> {
  if (!isObject(value)) {
    throw new EditError("invalid_type", `${path} must be an object`);
  }
  return value;
}

function reqString(obj: Record<string, unknown>, key: string, path: string): string {
  const value = obj[key];
  if (typeof value !== "string" || value.length === 0) {
    throw new EditError(
      "missing_field",
      `${path}.${key} must be a non-empty string`,
    );
  }
  return value;
}

function reqFiniteNumber(
  obj: Record<string, unknown>,
  key: string,
  path: string,
): number {
  const value = obj[key];
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new EditError(
      "invalid_type",
      `${path}.${key} must be a finite number`,
    );
  }
  return value;
}

function reqSchemaVersion0(obj: Record<string, unknown>, path: string): void {
  if (obj.schemaVersion !== 0) {
    throw new EditError(
      "unknown_version",
      `${path}.schemaVersion must be 0`,
      { schemaVersion: obj.schemaVersion },
    );
  }
}

function validatePreconditions(
  raw: unknown,
  path: string,
): { intentHash: string; sourceHashes: Record<string, string> } {
  const obj = reqObject(raw, path);
  const intentHash = reqString(obj, "intentHash", path);
  const hashesRaw = reqObject(obj.sourceHashes, `${path}.sourceHashes`);
  const sourceHashes: Record<string, string> = {};
  for (const [k, v] of Object.entries(hashesRaw)) {
    if (typeof v !== "string" || v.length === 0) {
      throw new EditError(
        "invalid_type",
        `${path}.sourceHashes.${k} must be a non-empty string`,
      );
    }
    sourceHashes[k] = v;
  }
  return { intentHash, sourceHashes };
}

function validateObservation(raw: unknown) {
  if (raw === undefined) return undefined;
  const obj = reqObject(raw, "operation.observation");
  const coords = reqObject(obj.coordinates, "operation.observation.coordinates");
  if (typeof obj.frame !== "number") throw new EditError("invalid_type", "observation.frame must be an integer");
  assertEditFrame(obj.frame, "observation.frame");
  const entryId = coords.entryId;
  if (entryId !== undefined && (typeof entryId !== "string" || !entryId)) throw new EditError("invalid_type", "invalid observation entryId");
  return { frame: obj.frame, coordinates: { sourceId: reqString(coords, "sourceId", "observation.coordinates"), variantId: reqString(coords, "variantId", "observation.coordinates"), editionId: reqString(coords, "editionId", "observation.coordinates"), ...(entryId === undefined ? {} : { entryId }) } };
}

/** Validate and narrow an unknown value to MediaEditCommand. */
export function validateMediaEditCommand(raw: unknown): MediaEditCommand {
  const obj = reqObject(raw, "operation");
  reqSchemaVersion0(obj, "operation");
  const source = reqString(obj, "source", "operation");
  const kind = reqString(obj, "kind", "operation");
  if (!OP_KINDS.has(kind)) {
    throw new EditError(
      "unsupported_kind",
      `unsupported operation kind "${kind}"`,
      { kind },
    );
  }

  const expected = validatePreconditions(obj.expected, "operation.expected");
  const observation = validateObservation(obj.observation);
  if (observation && kind !== "set-node-text" && kind !== "set-node-property") throw new EditError("invalid_type", "observation is not supported for this edit");

  if (kind === "set-audio-clip-placement") {
    const target = reqObject(obj.target, "operation.target");
    const value = reqObject(obj.value, "operation.value");
    const atSeconds = reqFiniteNumber(value, "atSeconds", "operation.value");
    if (atSeconds < 0 || !/^(?:\d+(?:\.\d+)?|\.\d+)$/.test(String(atSeconds))) throw new EditError("invalid_type", "atSeconds must be a nonnegative decimal value");
    return { schemaVersion: 0, source, kind, target: { clipId: reqString(target, "clipId", "operation.target"), bindingId: reqString(target, "bindingId", "operation.target") }, value: { atSeconds }, expected };
  }
  if (kind === "set-node-property") {
    const target = reqObject(obj.target, "operation.target");
    const value = reqObject(obj.value, "operation.value");
    const property = reqString(target, "property", "operation.target");
    if (!["color", "fill", "size", "weight", "width", "height", "src"].includes(property)) throw new EditError("invalid_type", "unsupported node property");
    const v = value.value;
    const stringProperty = property === "color" || property === "fill" || property === "src";
    if (stringProperty ? typeof v !== "string" || v.length === 0 : typeof v !== "number" || !Number.isFinite(v) || v <= 0) throw new EditError("invalid_type", "invalid node property value");
    return { schemaVersion: 0, source, kind, target: { nodeId: reqString(target, "nodeId", "operation.target"), bindingId: reqString(target, "bindingId", "operation.target"), property: property as "color" | "fill" | "size" | "weight" | "width" | "height" | "src" }, value: { value: v as string | number }, expected, ...(observation ? { observation } : {}) };
  }

  if (kind === "set-node-text") {
    const target = reqObject(obj.target, "operation.target");
    const value = reqObject(obj.value, "operation.value");
    if (typeof value.text !== "string") throw new EditError("invalid_type", "operation.value.text must be a string");
    return { schemaVersion: 0, source, kind, target: { nodeId: reqString(target, "nodeId", "operation.target"), textBindingId: reqString(target, "textBindingId", "operation.target") }, value: { text: value.text }, expected, ...(observation ? { observation } : {}) };
  }

  if (kind === "set-node-transform") {
    const target = reqObject(obj.target, "operation.target");
    const nodeId = reqString(target, "nodeId", "operation.target");
    const xBindingId = reqString(target, "xBindingId", "operation.target");
    const yBindingId = reqString(target, "yBindingId", "operation.target");
    const value = reqObject(obj.value, "operation.value");
    const x = reqFiniteNumber(value, "x", "operation.value");
    const y = reqFiniteNumber(value, "y", "operation.value");
    return {
      schemaVersion: 0,
      source,
      kind: "set-node-transform",
      target: { nodeId, xBindingId, yBindingId },
      value: { x, y },
      expected,
    };
  }

  if (kind === "set-phase-boundary") {
    const target = reqObject(obj.target, "operation.target");
    const sceneId = reqString(target, "sceneId", "operation.target");
    const leftPhaseName = reqString(
      target,
      "leftPhaseName",
      "operation.target",
    );
    const rightPhaseName = reqString(
      target,
      "rightPhaseName",
      "operation.target",
    );
    const leftBindingId = reqString(
      target,
      "leftBindingId",
      "operation.target",
    );
    const rightBindingId = reqString(
      target,
      "rightBindingId",
      "operation.target",
    );
    if (obj.mode !== "zero-sum") {
      throw new EditError(
        "unsupported_mode",
        `set-phase-boundary mode must be "zero-sum" (got ${String(obj.mode)})`,
        { mode: obj.mode },
      );
    }
    const value = reqObject(obj.value, "operation.value");
    const left = reqFiniteNumber(value, "left", "operation.value");
    const right = reqFiniteNumber(value, "right", "operation.value");
    if (left <= 0 || right <= 0) {
      throw new EditError(
        "invalid_type",
        "set-phase-boundary value.left/right must be > 0",
        { left, right },
      );
    }
    const unit = reqString(obj, "unit", "operation");
    if (unit !== "percent" && unit !== "seconds") {
      throw new EditError(
        "invalid_type",
        `set-phase-boundary unit must be "percent" or "seconds"`,
        { unit },
      );
    }
    return {
      schemaVersion: 0,
      source,
      kind: "set-phase-boundary",
      target: {
        sceneId,
        leftPhaseName,
        rightPhaseName,
        leftBindingId,
        rightBindingId,
      },
      mode: "zero-sum",
      value: { left, right },
      unit: unit as "percent" | "seconds",
      expected,
    };
  }

  if (kind === "set-composition-hold") {
    const target = reqObject(obj.target, "operation.target");
    const occurrencePath = reqString(target, "occurrencePath", "operation.target");
    const holdBindingId = reqString(target, "holdBindingId", "operation.target");
    const value = reqObject(obj.value, "operation.value");
    const hold = reqString(value, "hold", "operation.value");
    if (!/^(?:\d+(?:\.\d+)?|\.\d+)(?:ms|s|f)$/.test(hold)) {
      throw new EditError(
        "invalid_type",
        "set-composition-hold value.hold must be a literal duration ending in ms, s, or f",
        { hold },
      );
    }
    return {
      schemaVersion: 0,
      source,
      kind: "set-composition-hold",
      target: { occurrencePath, holdBindingId },
      value: { hold },
      expected,
    };
  }

  // trim-scene-end
  const target = reqObject(obj.target, "operation.target");
  const sceneId = reqString(target, "sceneId", "operation.target");
  const durationBindingId = reqString(
    target,
    "durationBindingId",
    "operation.target",
  );
  if (obj.mode !== "ripple") {
    throw new EditError(
      "unsupported_mode",
      `trim-scene-end mode must be "ripple" in P0 (got ${String(obj.mode)})`,
      { mode: obj.mode },
    );
  }
  const end = reqObject(obj.end, "operation.end");
  if (end.space !== "global") {
    throw new EditError(
      "unknown_space",
      `trim-scene-end end.space must be "global"`,
      { space: end.space },
    );
  }
  const frame = reqFiniteNumber(end, "frame", "operation.end");
  assertEditFrame(frame, "operation.end.frame");
  if (frame < 1) {
    throw new EditError(
      "invalid_frame",
      "trim-scene-end end frame must be >= 1 (min one-frame scene)",
      { frame },
    );
  }

  return {
    schemaVersion: 0,
    source,
    kind: "trim-scene-end",
    target: { sceneId, durationBindingId },
    mode: "ripple",
    end: { space: "global", frame },
    expected,
  };
}

function validateBinding(raw: unknown, path: string): EditSourceBinding {
  const obj = reqObject(raw, path);
  reqSchemaVersion0(obj, path);
  const bindingId = reqString(obj, "bindingId", path);
  const targetId = reqString(obj, "targetId", path);
  const propertyPath = reqString(obj, "propertyPath", path);
  const capability = reqString(obj, "capability", path);
  if (!CAPABILITIES.has(capability)) {
    throw new EditError(
      "invalid_type",
      `${path}.capability is not a known EditCapability`,
      { capability },
    );
  }

  let reason: EditReasonCode | undefined;
  if (obj.reason !== undefined) {
    if (typeof obj.reason !== "string" || !REASON_CODES.has(obj.reason)) {
      throw new EditError(
        "invalid_type",
        `${path}.reason is not a known EditReasonCode`,
        { reason: obj.reason },
      );
    }
    reason = obj.reason as EditReasonCode;
  }

  let source: NonNullable<EditSourceBinding["source"]> | undefined;
  if (obj.source !== undefined) {
    const s = reqObject(obj.source, `${path}.source`);
    const relativePath = reqString(s, "relativePath", `${path}.source`);
    if (relativePath.startsWith("/") || /^[A-Za-z]:[\\/]/.test(relativePath)) {
      throw new EditError(
        "invalid_type",
        `${path}.source.relativePath must not be absolute`,
        { relativePath },
      );
    }
    const sourceHash = reqString(s, "sourceHash", `${path}.source`);
    const startByte = reqFiniteNumber(s, "startByte", `${path}.source`);
    const endByte = reqFiniteNumber(s, "endByte", `${path}.source`);
    if (!Number.isInteger(startByte) || !Number.isInteger(endByte)) {
      throw new EditError(
        "invalid_type",
        `${path}.source byte offsets must be integers`,
      );
    }
    if (startByte < 0 || endByte < startByte) {
      throw new EditError(
        "invalid_range",
        `${path}.source byte range invalid`,
        { startByte, endByte },
      );
    }
    const syntaxKind = reqString(s, "syntaxKind", `${path}.source`);
    if (syntaxKind !== "number-literal" && syntaxKind !== "string-duration" && syntaxKind !== "string-literal") {
      throw new EditError(
        "invalid_type",
        `${path}.source.syntaxKind invalid`,
        { syntaxKind },
      );
    }
    source = {
      relativePath,
      sourceHash,
      startByte,
      endByte,
      syntaxKind,
    };
  }

  const binding: EditSourceBinding = {
    schemaVersion: 0,
    bindingId,
    targetId,
    propertyPath,
    capability: capability as EditCapability,
    ...(reason !== undefined ? { reason } : {}),
    ...(obj.value !== undefined
      ? { value: obj.value as NonNullable<EditSourceBinding["value"]> }
      : {}),
    ...(source !== undefined ? { source } : {}),
  };
  return binding;
}

/** Validate and narrow an unknown value to EditManifest. */
export function validateEditManifest(raw: unknown): EditManifest {
  const obj = reqObject(raw, "manifest");
  reqSchemaVersion0(obj, "manifest");
  const coordinatesObj = reqObject(obj.coordinates, "manifest.coordinates");
  const coordinates = {
    sourceId: reqString(coordinatesObj, "sourceId", "manifest.coordinates"),
    ...(coordinatesObj.entryId !== undefined
      ? { entryId: reqString(coordinatesObj, "entryId", "manifest.coordinates") }
      : {}),
    variantId: reqString(coordinatesObj, "variantId", "manifest.coordinates"),
    editionId: reqString(coordinatesObj, "editionId", "manifest.coordinates"),
  };
  const intentHash = reqString(obj, "intentHash", "manifest");
  const summaryObj = reqObject(obj.summary, "manifest.summary");
  const exactBindingCount = reqFiniteNumber(
    summaryObj,
    "exactBindingCount",
    "manifest.summary",
  );
  const inspectOnlyCount = reqFiniteNumber(
    summaryObj,
    "inspectOnlyCount",
    "manifest.summary",
  );
  const opaqueCount = reqFiniteNumber(
    summaryObj,
    "opaqueCount",
    "manifest.summary",
  );
  if (
    !Number.isInteger(exactBindingCount) ||
    !Number.isInteger(inspectOnlyCount) ||
    !Number.isInteger(opaqueCount)
  ) {
    throw new EditError(
      "invalid_type",
      "manifest.summary counts must be integers",
    );
  }
  if (!Array.isArray(obj.bindings)) {
    throw new EditError("invalid_type", "manifest.bindings must be an array");
  }
  const bindings = obj.bindings.map((b, i) =>
    validateBinding(b, `manifest.bindings[${i}]`),
  );

  return {
    schemaVersion: 0,
    coordinates,
    intentHash,
    summary: { exactBindingCount, inspectOnlyCount, opaqueCount },
    bindings,
  };
}

/** Deep-clone via JSON (operations are JSON-shaped). */
export function cloneMediaEditCommand(op: MediaEditCommand): MediaEditCommand {
  return validateMediaEditCommand(JSON.parse(JSON.stringify(op)));
}

/** Round-trip serialization fixture helper. */
export function roundTripMediaEditCommand(op: MediaEditCommand): MediaEditCommand {
  return validateMediaEditCommand(JSON.parse(JSON.stringify(op)));
}

export function roundTripEditManifest(m: EditManifest): EditManifest {
  return validateEditManifest(JSON.parse(JSON.stringify(m)));
}
