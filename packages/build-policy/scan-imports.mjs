/**
 * Line-oriented import/export scanning for dist/ policy checks.
 * Strips string literals first so embedded source (e.g. RUNTIME_CODE) cannot
 * trigger false positives like import('hast') inside JSDoc typedefs.
 */

export const LINE_IMPORT_RE =
  /^import\s+(?:type\s+)?(?:(?:\{[^}]*\}|\*\s+as\s+\w+|\w+)\s+from\s+|)['"]([^'"]+)['"]/;
export const LINE_EXPORT_RE =
  /^export\s+(?:type\s+)?(?:\{[^}]*\}|\*)\s+from\s+['"]([^'"]+)['"]/;
export const LINE_DYNAMIC_RE = /import\s*\(\s*['"]([^'"]+)['"]\s*\)/g;

/** Replace string literal bodies so regexes cannot match embedded source text. */
export function stripStringLiterals(line) {
  return line
    .replace(/"(?:\\.|[^"\\])*"/g, '""')
    .replace(/'(?:\\.|[^'\\])*'/g, "''")
    .replace(/`(?:\\.|[^`\\])*`/g, "``");
}

export function isCommentLine(trimmed) {
  return trimmed.startsWith("*") || trimmed.startsWith("//");
}

/** Collect bare specifiers from one source line (after comment filtering). */
export function collectLineImports(trimmed, specs) {
  const code = stripStringLiterals(trimmed);

  const staticImport = code.match(LINE_IMPORT_RE);
  if (staticImport) specs.add(staticImport[1]);

  const sideEffect = code.match(/^import\s+['"]([^'"]+)['"]/);
  if (sideEffect) specs.add(sideEffect[1]);

  const reExport = code.match(LINE_EXPORT_RE);
  if (reExport) specs.add(reExport[1]);

  LINE_DYNAMIC_RE.lastIndex = 0;
  let dynamic;
  while ((dynamic = LINE_DYNAMIC_RE.exec(code))) {
    specs.add(dynamic[1]);
  }
}