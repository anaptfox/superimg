//! Serializable JSON-shaped values for template data defaults and CLI loaders.

import type { JsonObject, JsonValue, JsonPrimitive } from "@superimg/stdlib/scene-types";
export type { JsonObject, JsonValue, JsonPrimitive } from "@superimg/stdlib/scene-types";

/** Preserve a user data shape while rejecting functions and non-JSON leaves. */
export type JsonCompatible<T> =
  T extends JsonPrimitive ? T
  : T extends readonly (infer TItem)[] ? readonly JsonCompatible<TItem>[]
  : T extends (...args: never[]) => unknown ? never
  : T extends object ? { [K in keyof T]: JsonCompatible<T[K]> }
  : never;

/** Top-level template sample / runtime data object. */
export type TemplateData = JsonObject;

export function isJsonObject(value: JsonValue): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
