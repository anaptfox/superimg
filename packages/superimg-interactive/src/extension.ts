//! Interactive-owned codec for the generic schema-0 Media IR extension slot.

import type {
  JsonObject,
  JsonValue,
  MediaIR,
  MediaIRExtensionEnvelope,
} from "@superimg/types";
import type {
  InteractiveDefinition,
  SceneGuide,
  SceneRuntimeInput,
} from "./contracts.js";
import { resolveInteractiveClock } from "./definition.js";

export const INTERACTIVE_EXTENSION_KEY = "superimg/interactive";

export interface InteractiveExtensionPayload extends JsonObject {
  kind: "interactive";
  guide: JsonObject;
  clock: JsonObject;
}

export type InteractiveExtension = MediaIRExtensionEnvelope & {
  schemaVersion: 0;
  payload: InteractiveExtensionPayload;
};

export interface DecodedInteractiveExtension {
  readonly guide: SceneGuide;
  readonly clock: {
    readonly fps: number;
    readonly durationSeconds: number;
    readonly totalFrames: number;
  };
}

export function encodeInteractiveExtension<TData>(
  definition: InteractiveDefinition<TData>,
): InteractiveExtension {
  const clock = resolveInteractiveClock(definition.guide);
  const guide = cloneJson(definition.guide, "guide") as unknown as JsonObject;
  return {
    schemaVersion: 0,
    payload: {
      kind: "interactive",
      guide,
      clock: {
        fps: clock.fps,
        durationSeconds: clock.durationSeconds,
        totalFrames: clock.totalFrames,
      },
    },
  };
}

export function parseInteractiveExtension(
  envelope: MediaIRExtensionEnvelope,
): DecodedInteractiveExtension {
  if (!envelope || envelope.schemaVersion !== 0) {
    throw new TypeError("Interactive Media IR extension must use schemaVersion 0");
  }
  const payload = envelope.payload as Partial<InteractiveExtensionPayload>;
  if (payload.kind !== "interactive") {
    throw new TypeError('Interactive Media IR extension kind must be "interactive"');
  }
  const guide = parseGuide(payload.guide);
  const derived = resolveInteractiveClock(guide);
  const clock = payload.clock;
  if (!isObject(clock)) {
    throw new TypeError("Interactive Media IR extension clock must be an object");
  }
  const fps = finitePositive(clock.fps, "clock.fps", true);
  const durationSeconds = finitePositive(
    clock.durationSeconds,
    "clock.durationSeconds",
  );
  const totalFrames = finitePositive(clock.totalFrames, "clock.totalFrames", true);
  if (
    fps !== derived.fps ||
    Math.abs(durationSeconds - derived.durationSeconds) > 1e-9 ||
    totalFrames !== derived.totalFrames
  ) {
    throw new TypeError("Interactive Media IR extension clock does not match its guide");
  }
  return { guide, clock: { fps, durationSeconds, totalFrames } };
}

export function isInteractiveExtension(
  envelope: MediaIRExtensionEnvelope | undefined,
): envelope is InteractiveExtension {
  if (!envelope) return false;
  try {
    parseInteractiveExtension(envelope);
    return true;
  } catch {
    return false;
  }
}

export function attachInteractiveExtension<TData>(
  ir: MediaIR,
  definition: InteractiveDefinition<TData>,
): MediaIR {
  return {
    ...ir,
    extensions: {
      ...ir.extensions,
      [INTERACTIVE_EXTENSION_KEY]: encodeInteractiveExtension(definition),
    },
  };
}

export function readInteractiveExtension(
  ir: MediaIR,
): DecodedInteractiveExtension | null {
  const envelope = ir.extensions[INTERACTIVE_EXTENSION_KEY];
  return envelope ? parseInteractiveExtension(envelope) : null;
}

function parseGuide(value: unknown): SceneGuide {
  if (!isObject(value) || typeof value.id !== "string" || !Array.isArray(value.steps)) {
    throw new TypeError("Interactive Media IR extension guide is malformed");
  }
  const guide: SceneGuide = {
    id: value.id,
    steps: value.steps.map((step, index) => parseStep(step, index)),
  };
  return guide;
}

function parseStep(value: unknown, index: number): SceneGuide["steps"][number] {
  if (
    !isObject(value) ||
    typeof value.id !== "string" ||
    typeof value.label !== "string" ||
    typeof value.duration !== "string" ||
    !isObject(value.scene)
  ) {
    throw new TypeError(`Interactive guide step ${index} is malformed`);
  }
  return {
    id: value.id,
    label: value.label,
    duration: value.duration,
    scene: cloneJson(value.scene, `guide.steps[${index}].scene`) as SceneRuntimeInput,
    ...(typeof value.note === "string" ? { note: value.note } : {}),
    ...(typeof value.focusNodeId === "string"
      ? { focusNodeId: value.focusNodeId }
      : {}),
  };
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function finitePositive(value: unknown, label: string, integer = false): number {
  if (
    typeof value !== "number" ||
    !Number.isFinite(value) ||
    value <= 0 ||
    (integer && !Number.isInteger(value))
  ) {
    throw new TypeError(`${label} must be a positive${integer ? " integer" : " finite number"}`);
  }
  return value;
}

function cloneJson(value: unknown, path: string): JsonValue {
  if (value === null || typeof value === "string" || typeof value === "boolean") {
    return value;
  }
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new TypeError(`${path} must contain finite numbers`);
    return value;
  }
  if (Array.isArray(value)) {
    return value.map((item, index) => cloneJson(item, `${path}[${index}]`));
  }
  if (isObject(value)) {
    const result: JsonObject = {};
    for (const [key, item] of Object.entries(value)) {
      if (item === undefined) continue;
      result[key] = cloneJson(item, `${path}.${key}`);
    }
    return result;
  }
  throw new TypeError(`${path} must be JSON-compatible`);
}
