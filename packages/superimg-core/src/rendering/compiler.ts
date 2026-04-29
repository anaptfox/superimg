//! Template compilation - evaluates pre-bundled code into TemplateModule

import type { TemplateModule, CompileError, CompileResult } from "@superimg/types";
import { TemplateCompilationError } from "@superimg/types";

export type { TemplateModule, CompileError, CompileResult } from "@superimg/types";

/**
 * Evaluates pre-bundled template code into a TemplateModule.
 * Expects IIFE-format code with __template global (output of esbuild bundling).
 *
 * Returns a CompileResult — `error` is a SuperImgError subclass (TemplateCompilationError)
 * when compilation fails. Engine layer enriches the error with sourcemap-mapped
 * location + code frame before surfacing to users.
 */
export function compileTemplate(bundledCode: string): CompileResult {
  let factory: Function;
  try {
    factory = new Function(bundledCode + "\nreturn __template;");
  } catch (e) {
    const err = e as Error;
    return {
      error: new TemplateCompilationError({
        syntaxError: err.message,
      }),
    };
  }

  let exports: any;
  try {
    exports = factory();
  } catch (e) {
    const err = e as Error;
    const tce = new TemplateCompilationError({
      syntaxError: err.message,
    });
    if (err.stack) tce.stack = err.stack;
    return { error: tce };
  }

  const def = exports?.default;
  if (!def || typeof def.render !== "function") {
    return {
      error: new TemplateCompilationError({
        syntaxError: "Template must use defineScene({ render(ctx) { ... } })",
        suggestion: "Add `export default defineScene({ render(ctx) { return '<div/>' } })` to your template.",
      }),
    };
  }

  // Migration guard: helpful error if using old `defaults` field
  if (def.defaults && !def.data) {
    return {
      error: new TemplateCompilationError({
        syntaxError: "`defaults` has been renamed to `data` in defineScene().",
        suggestion:
          "Rename `defaults` to `data`. Before: `defineScene({ defaults: { ... } })`. After: `defineScene({ data: { ... } })`.",
      }),
    };
  }

  return {
    template: {
      render: def.render,
      config: def.config,
      data: def.data,
    },
  };
}

/**
 * Tests a compiled template by running render with a test context.
 *
 * Returns a SuperImgError-shaped error (or null) — the legacy `CompileError`
 * shape is kept structurally compatible.
 */
export function validateTemplate(
  template: TemplateModule,
  testContext: import("@superimg/types").RenderContext
): CompileError | null {
  try {
    const result = template.render(testContext);
    if (typeof result !== "string") {
      return { message: "render() must return a string" };
    }
    return null;
  } catch (e) {
    return { message: `Runtime error: ${(e as Error).message}` };
  }
}
