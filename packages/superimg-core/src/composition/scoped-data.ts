//! Validate collection/Player data at the named-occurrence boundary.

import type { JsonObject } from "@superimg/types";

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function snapshotJson(value: unknown, path: string, stack: Set<object>): unknown {
  if (value === null || typeof value === "string" || typeof value === "boolean") return value;
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value !== "object") throw new TypeError(`composition: ${path} must be JSON data`);
  if (stack.has(value)) throw new TypeError(`composition: ${path} contains a cycle`);
  stack.add(value);
  try {
    if (Array.isArray(value)) {
      return Object.freeze(value.map((child, index) => snapshotJson(child, `${path}[${index}]`, stack)));
    }
    return Object.freeze(Object.fromEntries(
      Object.entries(value).map(([key, child]) => [key, snapshotJson(child, `${path}.${key}`, stack)]),
    ));
  } finally {
    stack.delete(value);
  }
}

/** Copy and freeze nested JSON so a child cannot mutate another occurrence's input. */
export function snapshotJsonObject(value: unknown, path: string): Readonly<JsonObject> {
  if (!isObject(value)) throw new TypeError(`composition: ${path} must be a JSON object`);
  return snapshotJson(value, path, new Set<object>()) as Readonly<JsonObject>;
}

/** Entry data may target leaves by qualified path; arbitrary root fields are rejected. */
export function scopedCompositionData(
  input: Record<string, unknown> | undefined,
  leafPaths: readonly string[],
): Readonly<Record<string, JsonObject>> {
  if (input === undefined || Object.keys(input).length === 0) return {};
  if (!isObject(input)) throw new TypeError("composition: entry data must be an object");
  const extras = Object.keys(input).filter((key) => key !== "id" && key !== "uses");
  if (extras.length > 0) throw new TypeError(`composition: root data keys ${extras.join(", ")} are not supported; use named uses`);
  if (input.id !== undefined && (typeof input.id !== "string" || input.id.length === 0)) {
    throw new TypeError("composition: entry id must be a non-empty string");
  }
  if (input.uses === undefined) return {};
  if (!isObject(input.uses)) throw new TypeError("composition: uses must be a map of named child data");
  const known = new Set(leafPaths);
  const result: Record<string, JsonObject> = {};
  for (const [path, patch] of Object.entries(input.uses)) {
    if (!known.has(path)) throw new TypeError(`composition: data target \"${path}\" is not a selected leaf`);
    if (!isObject(patch)) throw new TypeError(`composition: uses.${path} must be a JSON object`);
    result[path] = snapshotJsonObject(patch, `uses.${path}`) as JsonObject;
  }
  return Object.freeze(result);
}
