//! Low-level JSON parsing primitives shared by portable.ts and
//! portable-specs.ts. Mirrors the style of `@superimg/types`'
//! `parseCortexBundle`: a typed error carrying a path, reject-unknown-keys,
//! exhaustive validation, no validation library.

export class ArrangeRequestError extends Error {
  readonly code = "INVALID_REQUEST" as const;
  constructor(readonly path: string, message: string) {
    super(message);
    this.name = "ArrangeRequestError";
  }
}

export function asRecord(value: unknown, path: string): Record<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new ArrangeRequestError(path || "/", `${path || "request"} must be an object`);
  }
  return value as Record<string, unknown>;
}

export function asArray(value: unknown, path: string): unknown[] {
  if (!Array.isArray(value)) {
    throw new ArrangeRequestError(path, `${path} must be an array`);
  }
  return value;
}

export function requiredString(value: unknown, path: string): string {
  if (typeof value !== "string") {
    throw new ArrangeRequestError(path, `${path} must be a string`);
  }
  return value;
}

export function optionalString(value: unknown, path: string): string | undefined {
  if (value === undefined) return undefined;
  return requiredString(value, path);
}

export function requiredFiniteNumber(value: unknown, path: string): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new ArrangeRequestError(path, `${path} must be a finite number`);
  }
  return value;
}

export function optionalFiniteNumber(value: unknown, path: string): number | undefined {
  if (value === undefined) return undefined;
  return requiredFiniteNumber(value, path);
}

export function optionalBoolean(value: unknown, path: string): boolean | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== "boolean") {
    throw new ArrangeRequestError(path, `${path} must be a boolean`);
  }
  return value;
}

export function requiredEnum<T extends string>(
  value: unknown,
  allowed: ReadonlySet<T>,
  path: string,
): T {
  if (typeof value !== "string" || !allowed.has(value as T)) {
    throw new ArrangeRequestError(path, `${path} must be one of: ${[...allowed].join(", ")}`);
  }
  return value as T;
}

export function optionalEnum<T extends string>(
  value: unknown,
  allowed: ReadonlySet<T>,
  path: string,
): T | undefined {
  if (value === undefined) return undefined;
  return requiredEnum(value, allowed, path);
}

export function optionalStringArray(value: unknown, path: string): string[] | undefined {
  if (value === undefined) return undefined;
  return asArray(value, path).map((item, index) => requiredString(item, `${path}.${index}`));
}

export function rejectUnknownKeys(
  value: Record<string, unknown>,
  allowed: ReadonlySet<string>,
  path: string,
): void {
  for (const key of Object.keys(value)) {
    if (!allowed.has(key)) {
      const where = path ? `${path}.${key}` : key;
      throw new ArrangeRequestError(where, `Unknown field '${where}'`);
    }
  }
}

const URL_SCHEME = /^[a-zA-Z][a-zA-Z0-9+.-]*:/;
const DRIVE_LETTER = /^[a-zA-Z]:/;

/**
 * Enforces the src trust rule for a portable specimen view — a security
 * boundary. `asset:<id>` must resolve against a supplied asset; a relative
 * path must not escape the project: no leading '/', no '\\' UNC prefix, no
 * drive letter, no '..' segment, and no URL scheme (asset: is the one
 * allowed scheme-shaped form).
 */
export function validatePortableSrc(
  src: string,
  assetIds: ReadonlySet<string>,
  path: string,
): void {
  if (src.startsWith("asset:")) {
    const id = src.slice("asset:".length);
    if (!id || !assetIds.has(id)) {
      throw new ArrangeRequestError(path, `${path} references unknown asset '${id}'`);
    }
    return;
  }
  if (DRIVE_LETTER.test(src)) {
    throw new ArrangeRequestError(
      path,
      `${path} must not use a drive letter (use asset:<id> or a relative path)`,
    );
  }
  if (URL_SCHEME.test(src)) {
    throw new ArrangeRequestError(
      path,
      `${path} must not use a URL scheme (use asset:<id> or a relative path)`,
    );
  }
  if (src.startsWith("/")) {
    throw new ArrangeRequestError(path, `${path} must not be an absolute path`);
  }
  if (src.startsWith("\\\\")) {
    throw new ArrangeRequestError(path, `${path} must not be a UNC path`);
  }
  if (src.split(/[\\/]/).includes("..")) {
    throw new ArrangeRequestError(path, `${path} must not contain '..' segments`);
  }
}
