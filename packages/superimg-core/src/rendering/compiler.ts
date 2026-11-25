//! Template compilation - evaluates pre-bundled code into TemplateModule

import type {
  CompileError,
  CompileResult,
  MediaDefinition,
  TemplateBundle,
} from "@superimg/types";
import { TemplateCompilationError } from "@superimg/types";
import { isMediaElement } from "@superimg/types";
import { copyStdlibCapabilityStamp, getStampedMediaCapabilities, stampStdlibCapabilitiesFromSource } from "../shared/stdlib-capability-detection.js";
import { normalizeCompilerError } from "../errors/compiler-diagnostics.js";

export type { CompileError, CompileResult, MediaDefinition } from "@superimg/types";

/**
 * Evaluates pre-bundled template code into a TemplateModule.
 * Expects IIFE-format code with __template global (output of rolldown bundling).
 *
 * Returns a CompileResult — `error` is a SuperImgError subclass (TemplateCompilationError)
 * when compilation fails. Engine layer enriches the error with sourcemap-mapped
 * location + code frame before surfacing to users.
 */
export function compileTemplate(input: string | TemplateBundle): CompileResult {
  const bundledCode = typeof input === "string" ? input : input.code;
  const nativeModules = Object.fromEntries((typeof input === "string" ? [] : input.nativeModuleSets ?? []).map(set => [set.identity, set.outputs]));
  let factory: Function;
  try {
    factory = new Function("__superimgNativeModules", bundledCode + "\nreturn __template;");
  } catch (e) {
    return {
      error: normalizeCompilerError(e, "evaluate"),
    };
  }

  let exports: {
    default?: MediaDefinition | NonNullable<CompileResult["interactive"]>;
  };
  try {
    exports = factory(nativeModules) as {
      default?: MediaDefinition | NonNullable<CompileResult["interactive"]>;
    };
  } catch (e) {
    return { error: normalizeCompilerError(e, "evaluate") };
  }

  const def = exports?.default;
  if (
    !def ||
    (def.kind !== "media" && def.kind !== "interactive") ||
    typeof def.render !== "function"
  ) {
    return {
      error: new TemplateCompilationError({
        syntaxError:
          "Media source must export a deterministic media or interactive definition",
        suggestion:
          "Export `video(...)`, `image(...)`, `svg(...)`, `ogImage(...)`, `define(...)`, or `defineInteractive(...)` as the default value.",
      }),
    };
  }

  if (def.kind === "interactive") {
    return { interactive: def };
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

  const media: MediaDefinition = {
    kind: "media",
    media: def.media,
    fallbackFormat: def.fallbackFormat,
    medium: def.medium ?? "html",
    animated:
      typeof def.animated === "boolean"
        ? def.animated
        : animated,
    render: def.render,
    ...(def.config !== undefined ? { config: def.config } : {}),
    ...(def.sample !== undefined ? { sample: def.sample } : {}),
    ...(def.editions !== undefined ? { editions: def.editions } : {}),
    ...(def.variants !== undefined ? { variants: def.variants } : {}),
    ...(def.poster !== undefined ? { poster: def.poster } : {}),
    ...(def.composition !== undefined ? { composition: def.composition } : {}),
    ...(hasResolve ? { resolve: def.resolve } : {}),
  };

  // Full IIFE source includes helpers outside `render()` (e.g. renderCodeWindow
  // calling std.code). Capability preparation only sees render.toString() without this.
  if (getStampedMediaCapabilities(def)) copyStdlibCapabilityStamp(def, media);
  else stampStdlibCapabilitiesFromSource(media, bundledCode);

  return { media };
}

/**
 * Tests a compiled template by running render with a test context.
 *
 * Returns a minimal validation error, or null when rendering succeeds.
 */
export function validateTemplate(
  template: MediaDefinition,
  testContext: import("@superimg/types").RenderContext
): CompileError | null {
  try {
    const result = template.render(testContext);
    if (!isMediaElement(result)) {
      return { message: "render() must return a MediaElement tree" };
    }
    return null;
  } catch (e) {
    return { message: `Runtime error: ${(e as Error).message}` };
  }
}
