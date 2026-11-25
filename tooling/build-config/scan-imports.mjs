/** Syntax-aware ESM import/export scanning for generated package policy checks. */

import { parse } from "es-module-lexer/minimal/js";

/**
 * Collect statically resolvable import and re-export specifiers from JavaScript.
 *
 * `es-module-lexer` understands comments, strings, and template substitutions,
 * so embedded source text is ignored while real `import()` expressions inside
 * `${...}` are still reported. Non-literal dynamic imports and `import.meta`
 * have no resolvable specifier and are intentionally omitted.
 */
export function collectSourceImports(source) {
  const [imports] = parse(source);
  const specifiers = new Set();

  for (const record of imports) {
    if (typeof record.n === "string") specifiers.add(record.n);
  }

  return specifiers;
}
