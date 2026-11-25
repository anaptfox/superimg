//! Map rolldown MISSING_EXPORT on the public template entries to a SuperImg error.

import { TemplateCompilationError } from "@superimg/types";

interface MissingExport {
  name: string;
  exporter?: string;
  file?: string;
  line?: number;
  column?: number;
}

const QUOTED_MISSING =
  /["']([^"']+)["'] is not exported by ["']([^"']+)["'](?:, imported by ["']([^"']+)["'])?/;
const BARE_MISSING =
  /["']([^"']+)["'] is not exported by ([^,]+)(?:, imported by ["']([^"']+)["'])?/;

/** Bare specifier the template imported, when the exporter is a public entry. */
function specifierForExporter(exporter: string | undefined): string | null {
  if (!exporter) return null;
  const portable = exporter
    .trim()
    .replace(/^["']|["']$/g, "")
    .replace(/\\/g, "/")
    .split("?")[0] ?? "";
  if (portable.includes("template-public")) return "@foxworth/superimg";
  if (portable === "\0superimg-virtual") return "@foxworth/superimg";
  if (portable.includes("superimg-interactive") || /\/interactive\/define\.(?:js|ts|mjs)$/.test(portable)) {
    return "@foxworth/superimg/interactive/define";
  }
  if (
    /\/node_modules\/@foxworth\/superimg\/dist\/index\.js$/.test(portable) ||
    /\/node_modules\/@foxworth\/superimg\/index\.js$/.test(portable) ||
    /\/superimg\/dist\/index\.js$/.test(portable)
  ) {
    return "@foxworth/superimg";
  }
  return null;
}

function parseMissingExport(value: object): MissingExport | null {
  const record = value as {
    code?: unknown;
    message?: unknown;
    binding?: unknown;
    exporter?: unknown;
    id?: unknown;
    loc?: { file?: string; line?: number; column?: number };
  };
  const message = typeof record.message === "string" ? record.message : "";
  const quoted = QUOTED_MISSING.exec(message);
  const bare = quoted ? null : BARE_MISSING.exec(message);
  const name =
    (typeof record.binding === "string" && record.binding) ||
    quoted?.[1] ||
    bare?.[1] ||
    "";
  const looksMissing = record.code === "MISSING_EXPORT" || quoted !== null || bare !== null;
  if (!looksMissing || name.length === 0) return null;
  const exporter =
    (typeof record.exporter === "string" && record.exporter) ||
    quoted?.[2] ||
    bare?.[2];
  const file =
    record.loc?.file ??
    quoted?.[3] ??
    bare?.[3] ??
    (typeof record.id === "string" ? record.id : undefined);
  return {
    name,
    ...(exporter ? { exporter } : {}),
    ...(file ? { file } : {}),
    ...(record.loc?.line !== undefined ? { line: record.loc.line } : {}),
    ...(record.loc?.column !== undefined ? { column: record.loc.column } : {}),
  };
}

function collectMissingExports(error: unknown, out: MissingExport[], seen: Set<unknown>): void {
  if (!error || typeof error !== "object" || seen.has(error)) return;
  seen.add(error);
  const parsed = parseMissingExport(error);
  if (parsed) out.push(parsed);
  const record = error as { errors?: unknown; cause?: unknown };
  if (Array.isArray(record.errors)) {
    for (const child of record.errors) collectMissingExports(child, out, seen);
  }
  if (record.cause) collectMissingExports(record.cause, out, seen);
}

/** Rethrow rolldown's MISSING_EXPORT on `superimg` as TEMPLATE_MISSING_EXPORT. */
export function rethrowBundleFailure(error: unknown): never {
  const missing: MissingExport[] = [];
  collectMissingExports(error, missing, new Set());
  for (const item of missing) {
    const specifier = specifierForExporter(item.exporter);
    if (!specifier) continue;
    const wrapped = new TemplateCompilationError({
      syntaxError: `'${specifier}' has no export named '${item.name}'`,
      suggestion: `Import a name that '${specifier}' exports.`,
      ...(item.file ? { file: item.file } : {}),
      ...(item.line !== undefined ? { line: item.line } : {}),
      ...(item.column !== undefined ? { column: item.column } : {}),
    });
    (wrapped as { code: string }).code = "TEMPLATE_MISSING_EXPORT";
    throw wrapped;
  }
  throw error;
}
