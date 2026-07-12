//! Template compilation - evaluates pre-bundled code into TemplateModule

import type { TemplateModule, CompileError, CompileResult } from "@superimg/types";
import { TemplateCompilationError } from "@superimg/types";

export type { TemplateModule, CompileError, CompileResult } from "@superimg/types";

/**
 * Evaluates pre-bundled template code into a TemplateModule.
 * Expects IIFE-format code with __template global (output of rolldown bundling).
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

  let exports: { default?: TemplateModule };
  try {
    exports = factory() as { default?: TemplateModule };
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
        syntaxError: "Template must use define({ render(ctx) { ... } })",
        suggestion: "Add `export default define({ render(ctx) { return '<div/>' } })` to your template.",
      }),
    };
  }

  // Migration guard: helpful error if using old `data` field
  if (def.data && !def.sample) {
    return {
      error: new TemplateCompilationError({
        syntaxError: "`data` has been renamed to `sample` in define().",
        suggestion:
          "Rename `data` to `sample`. Before: `define({ data: { ... } })`. After: `define({ sample: { ... } })`.",
      }),
    };
  }

  // Derive medium/animated if the runtime identity stamp is missing (e.g. a
  // hand-built module object). define() normally provides both.
  const config = def.config;
  const hasResolve = typeof def.resolve === "function";
  const animated =
    typeof def.animated === "boolean"
      ? def.animated
      : !!config &&
        typeof config.fps === "number" &&
        (config.duration != null || hasResolve);

  const template: TemplateModule = {
    medium: def.medium ?? "html",
    animated:
      typeof def.animated === "boolean"
        ? def.animated
        : def.type === "composed"
          ? true
          : animated,
    render: def.render,
    config: def.config,
    sample: def.sample,
    ...(hasResolve ? { resolve: def.resolve } : {}),
  };

  // Preserve composed-template identity (scene list, totalFrames, helpers).
  if (def.type === "composed") {
    Object.assign(template, {
      type: def.type,
      scenes: def.scenes,
      totalFrames: def.totalFrames,
      duration: def.duration,
      fps: def.fps,
      getScene: def.getScene,
      getSceneById: def.getSceneById,
      getSceneAtFrame: def.getSceneAtFrame,
      getCheckpoints: def.getCheckpoints,
    });
  }

  return { template };
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
