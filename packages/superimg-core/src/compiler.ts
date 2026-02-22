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

    // Handle named exports (exports.render), default export (exports.default),
    // and direct function (exports is the render function)
    let render = exports?.render;
    let config = exports?.config;
    let defaults = exports?.defaults;

    // Default export: exports.default can be a function or object with render
    const def = exports?.default;
    if (def !== undefined) {
      if (typeof def === "function") {
        render = def;
      } else if (def && typeof def.render === "function") {
        render = def.render;
        config = config ?? def.config;
        defaults = defaults ?? def.defaults;
      }
    }

    // Direct function (e.g. IIFE returning the function)
    if (typeof exports === "function") {
      render = exports;
    }

    if (typeof render !== "function") {
      return { error: { message: "Template must export a 'render' function" } };
    }

    return {
      template: {
        render,
        config,
        defaults,
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
