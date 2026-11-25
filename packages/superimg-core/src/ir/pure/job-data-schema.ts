//! Minimal JSON Schema checks for async job data (draft, no Ajv dependency).
//! Supports type / required / properties / additionalProperties enough to
//! reject invalid job payloads when TemplatePackage.inputSchema is present.

import { MediaIRError } from "./errors.js";

type JsonSchemaLike = {
  type?: string | string[];
  required?: string[];
  properties?: Record<string, JsonSchemaLike>;
  additionalProperties?: boolean | JsonSchemaLike;
  enum?: unknown[];
  items?: JsonSchemaLike;
  minimum?: number;
  maximum?: number;
  minLength?: number;
  maxLength?: number;
};

function typeOf(value: unknown): string {
  if (value === null) return "null";
  if (Array.isArray(value)) return "array";
  return typeof value;
}

function matchesType(value: unknown, expected: string | string[]): boolean {
  const types = Array.isArray(expected) ? expected : [expected];
  const actual = typeOf(value);
  for (const t of types) {
    if (t === "integer") {
      if (typeof value === "number" && Number.isInteger(value)) return true;
      continue;
    }
    if (t === actual) return true;
  }
  return false;
}

function validateNode(
  value: unknown,
  schema: JsonSchemaLike,
  path: string,
  errors: string[],
): void {
  if (schema.type !== undefined && !matchesType(value, schema.type)) {
    errors.push(
      `${path}: expected type ${Array.isArray(schema.type) ? schema.type.join("|") : schema.type}, got ${typeOf(value)}`,
    );
    return;
  }

  if (schema.enum !== undefined) {
    const ok = schema.enum.some(
      (candidate) => JSON.stringify(candidate) === JSON.stringify(value),
    );
    if (!ok) {
      errors.push(`${path}: value not in enum`);
      return;
    }
  }

  if (typeof value === "string") {
    if (schema.minLength !== undefined && value.length < schema.minLength) {
      errors.push(`${path}: string shorter than minLength ${schema.minLength}`);
    }
    if (schema.maxLength !== undefined && value.length > schema.maxLength) {
      errors.push(`${path}: string longer than maxLength ${schema.maxLength}`);
    }
  }

  if (typeof value === "number") {
    if (schema.minimum !== undefined && value < schema.minimum) {
      errors.push(`${path}: number below minimum ${schema.minimum}`);
    }
    if (schema.maximum !== undefined && value > schema.maximum) {
      errors.push(`${path}: number above maximum ${schema.maximum}`);
    }
  }

  if (Array.isArray(value) && schema.items) {
    for (let i = 0; i < value.length; i++) {
      validateNode(value[i], schema.items, `${path}[${i}]`, errors);
    }
  }

  if (
    value !== null &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    (schema.properties || schema.required || schema.additionalProperties !== undefined)
  ) {
    const obj = value as Record<string, unknown>;
    const required = schema.required ?? [];
    for (const key of required) {
      if (!(key in obj) || obj[key] === undefined) {
        errors.push(`${path}.${key}: required property missing`);
      }
    }
    const properties = schema.properties ?? {};
    for (const [key, child] of Object.entries(properties)) {
      if (key in obj && obj[key] !== undefined) {
        validateNode(obj[key], child, path === "$" ? `$.${key}` : `${path}.${key}`, errors);
      }
    }
    if (schema.additionalProperties === false) {
      for (const key of Object.keys(obj)) {
        if (!(key in properties)) {
          errors.push(`${path}.${key}: additional property not allowed`);
        }
      }
    } else if (
      schema.additionalProperties &&
      typeof schema.additionalProperties === "object"
    ) {
      for (const key of Object.keys(obj)) {
        if (!(key in properties)) {
          validateNode(
            obj[key],
            schema.additionalProperties,
            `${path}.${key}`,
            errors,
          );
        }
      }
    }
  }
}

/**
 * Validate job data against a package inputSchema (minimal JSON Schema subset).
 * Throws MediaIRError with code details schema_invalid when validation fails.
 * No-op when schema is absent/null.
 */
export function validateJobDataAgainstSchema(
  data: unknown,
  inputSchema: unknown | undefined | null,
): void {
  if (inputSchema == null) return;
  if (typeof inputSchema !== "object" || Array.isArray(inputSchema)) {
    throw new MediaIRError(
      "invalid_schema",
      "Package inputSchema must be a JSON Schema object",
      { code: "schema_invalid" },
    );
  }
  const errors: string[] = [];
  validateNode(data, inputSchema as JsonSchemaLike, "$", errors);
  if (errors.length > 0) {
    throw new MediaIRError(
      "invalid_schema",
      `Job data failed package inputSchema: ${errors.slice(0, 8).join("; ")}`,
      { code: "schema_invalid", errors },
    );
  }
}
