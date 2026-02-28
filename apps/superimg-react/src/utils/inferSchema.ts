//! Type inference utilities for auto-generating forms from template defaults

export type FieldType =
  | "text"
  | "number"
  | "boolean"
  | "color"
  | "url"
  | "object"
  | "array";

export interface FieldSchema {
  key: string;
  type: FieldType;
  defaultValue: unknown;
  label: string;
  children?: FieldSchema[];
}

// Regex patterns for type detection
const HEX_COLOR_PATTERN = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/;
const URL_PATTERN = /^(https?:\/\/|\/\/)/i;

/**
 * Infer field type from a value
 */
export function inferFieldType(key: string, value: unknown): FieldType {
  if (value === null || value === undefined) {
    return "text"; // Default fallback
  }

  if (typeof value === "boolean") {
    return "boolean";
  }

  if (typeof value === "number") {
    return "number";
  }

  if (typeof value === "string") {
    // Check for color first (most specific)
    if (HEX_COLOR_PATTERN.test(value)) {
      return "color";
    }
    // Check for URL
    if (URL_PATTERN.test(value)) {
      return "url";
    }
    // Default string
    return "text";
  }

  if (Array.isArray(value)) {
    return "array";
  }

  if (typeof value === "object") {
    return "object";
  }

  // Fallback for functions or other types
  return "text";
}

/**
 * Convert camelCase or snake_case to Title Case
 * Examples:
 *   "accentColor" -> "Accent Color"
 *   "background_color" -> "Background Color"
 *   "bgColor" -> "Bg Color"
 */
export function humanizeKey(key: string): string {
  return key
    // Insert space before capital letters (camelCase)
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    // Replace underscores with spaces (snake_case)
    .replace(/_/g, " ")
    // Capitalize first letter of each word
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

/**
 * Generate a form schema from template defaults
 * Recursively handles nested objects up to maxDepth
 */
export function inferSchema(
  defaults: Record<string, unknown>,
  maxDepth = 2,
  currentDepth = 0
): FieldSchema[] {
  const schema: FieldSchema[] = [];

  for (const [key, value] of Object.entries(defaults)) {
    // Skip functions and symbols
    if (typeof value === "function" || typeof value === "symbol") {
      continue;
    }

    // Skip null/undefined
    if (value === null || value === undefined) {
      continue;
    }

    const type = inferFieldType(key, value);
    const field: FieldSchema = {
      key,
      type,
      defaultValue: value,
      label: humanizeKey(key),
    };

    // Handle nested objects recursively
    if (type === "object" && currentDepth < maxDepth) {
      field.children = inferSchema(
        value as Record<string, unknown>,
        maxDepth,
        currentDepth + 1
      );
    }

    schema.push(field);
  }

  return schema;
}

/**
 * Get a flat list of all field keys (for change tracking)
 */
export function getFieldKeys(
  schema: FieldSchema[],
  prefix = ""
): string[] {
  const keys: string[] = [];

  for (const field of schema) {
    const fullKey = prefix ? `${prefix}.${field.key}` : field.key;
    keys.push(fullKey);

    if (field.children) {
      keys.push(...getFieldKeys(field.children, fullKey));
    }
  }

  return keys;
}

/**
 * Get nested value from object using dot notation
 */
export function getNestedValue(
  obj: Record<string, unknown>,
  path: string
): unknown {
  return path.split(".").reduce((current, key) => {
    if (current && typeof current === "object") {
      return (current as Record<string, unknown>)[key];
    }
    return undefined;
  }, obj as unknown);
}

/**
 * Set nested value in object using dot notation (immutable)
 */
export function setNestedValue(
  obj: Record<string, unknown>,
  path: string,
  value: unknown
): Record<string, unknown> {
  const keys = path.split(".");
  const result = { ...obj };

  let current = result;
  for (let i = 0; i < keys.length - 1; i++) {
    const key = keys[i];
    current[key] = { ...(current[key] as Record<string, unknown> || {}) };
    current = current[key] as Record<string, unknown>;
  }

  current[keys[keys.length - 1]] = value;
  return result;
}
