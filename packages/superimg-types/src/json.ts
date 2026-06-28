//! Serializable JSON-shaped values for template data defaults and CLI loaders.

export type JsonPrimitive = string | number | boolean | null;

export type JsonObject = { [key: string]: JsonValue };

export type JsonValue = JsonPrimitive | JsonValue[] | JsonObject;

/** Top-level template sample / runtime data object. */
export type TemplateData = JsonObject;

export function isJsonObject(value: JsonValue): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}