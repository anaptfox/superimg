//! Template compilation - evaluates pre-bundled code into TemplateModule

import type { TemplateModule, CompileError, CompileResult } from "@superimg/types";

export type { TemplateModule, CompileError, CompileResult } from "@superimg/types";

/**
 * Evaluates pre-bundled template code into a TemplateModule.
 * Expects IIFE-format code with __template global (output of esbuild bundling).
 */
export function compileTemplate(bundledCode: string): CompileResult {
  try {
    const factory = new Function(bundledCode + "\nreturn __template;");
    const exports = factory();

    const def = exports?.default;
    if (!def || typeof def.render !== "function") {
      return { error: { message: "Template must use defineScene({ render(ctx) { ... } })" } };
    }

    // Migration guard: helpful error if using old `defaults` field
    if (def.defaults && !def.data) {
      throw new Error(
        "`defaults` has been renamed to `data` in defineScene().\n\n" +
        "  Before:  defineScene({ defaults: { ... } })\n" +
        "  After:   defineScene({ data: { ... } })\n"
      );
    }

    return {
      template: {
        render: def.render,
        config: def.config,
        data: def.data,
      },
    };
  } catch (e) {
    const error = e as Error;
    return { error: { message: error.message } };
  }
}

/**
 * Tests a compiled template by running render with a test context.
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
