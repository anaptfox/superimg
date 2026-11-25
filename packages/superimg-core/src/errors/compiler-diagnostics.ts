import { isSuperImgError, TemplateCompilationError, type SuperImgError, type CompilerDiagnostic, type JsonObject } from "@superimg/types";

const clean = (value: string) => value.replace(/\u001b\[[0-9;]*m/g, "");
const record = (value: unknown): Record<string, unknown> | undefined => typeof value === "object" && value !== null ? value as Record<string, unknown> : undefined;
const string = (value: unknown): string | undefined => typeof value === "string" ? value : undefined;
const number = (value: unknown): number | undefined => typeof value === "number" && Number.isFinite(value) ? value : undefined;

/** Rolldown aggregates and OXC records share one JSON-safe diagnostic contract. */
export function compilerDiagnostics(error: unknown, stage: CompilerDiagnostic["stage"], file?: string): CompilerDiagnostic[] {
  const records: CompilerDiagnostic[] = [];
  const seen = new Set<object>();
  const visit = (value: unknown): void => {
    const item = record(value);
    if (!item || seen.has(item)) return;
    seen.add(item);
    const retained = item.compilerDiagnostics ?? record(item.details)?.compilerDiagnostics;
    if (Array.isArray(retained) && retained.length) { records.push(...retained as CompilerDiagnostic[]); return; }
    if (Array.isArray(item.errors) && item.errors.length) { item.errors.forEach(visit); return; }
    const loc = record(item.loc ?? item.location);
    const sourceFile = string(loc?.file ?? item.filename ?? item.id) ?? file;
    const line = number(loc?.line);
    const column = number(loc?.column);
    const help = string(item.helpMessage ?? item.help);
    const plugin = string(item.plugin);
    const labels = (Array.isArray(item.labels) ? item.labels : item.range ? [item.range] : []).flatMap((value) => {
      const label = record(value);
      const start = number(label?.start);
      const end = number(label?.end);
      const message = string(label?.message);
      return start !== undefined && end !== undefined ? [{ start, end, ...(message ? { message } : {}) }] : [];
    });
    const code = string(item.code ?? item.kind) ?? "TEMPLATE_COMPILATION_ERROR";
    records.push({ code, severity: item.severity === "Warning" || item.severity === "warning" ? "warning" : "error",
      stage: /^(?:MISSING_EXPORT|UNRESOLVED_IMPORT|UNRESOLVED_ENTRY)$/.test(code) ? "resolve" : stage,
      message: clean(string(item.message) ?? String(value)),
      ...(sourceFile ? { file: sourceFile } : {}), ...(line !== undefined ? { line } : {}), ...(column !== undefined ? { column } : {}),
      ...(labels.length ? { labels } : {}), ...(help ? { help } : {}), ...(plugin ? { plugin } : {}) });
  };
  visit(error);
  if (!records.length) records.push({ code: "TEMPLATE_COMPILATION_ERROR", severity: "error", stage, message: clean(String(error)), ...(file ? { file } : {}) });
  return records;
}

/** Preserve native/source codes and every record across CLI JSON and React. */
export function normalizeCompilerError(error: unknown, stage: CompilerDiagnostic["stage"], file?: string): SuperImgError {
  const diagnostics = compilerDiagnostics(error, stage, file);
  const primary = diagnostics[0]!;
  const result = isSuperImgError(error) ? error : new TemplateCompilationError({ syntaxError: primary.message,
    ...(primary.file ? { file: primary.file } : {}), ...(primary.line !== undefined ? { line: primary.line } : {}), ...(primary.column !== undefined ? { column: primary.column } : {}), ...(primary.help ? { suggestion: primary.help } : {}) });
  if (!isSuperImgError(error) && typeof record(error)?.code === "string") Object.assign(result, { code: record(error)!.code });
  if (!isSuperImgError(error) && error instanceof Error && error.stack) result.stack = error.stack;
  Object.assign(result, { compilerDiagnostics: Object.freeze(diagnostics) });
  Object.assign(result.details, { compilerDiagnostics: diagnostics as unknown as JsonObject[] });
  return result;
}
