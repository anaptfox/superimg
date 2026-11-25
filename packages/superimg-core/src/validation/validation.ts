//! AI Template Validation
//! Comprehensive validation for AI-generated templates with actionable feedback

import type {
  ValidationIssue,
  ValidationResult,
  ValidationOptions,
} from "@superimg/types";
import { resolveConfigAssets } from "../shared/assets.js";
import { EASING_NAMES } from "@superimg/stdlib/easing";
import { bundleTemplateCode } from "../bundler/bundler.js";
import { compileTemplate } from "../rendering/compiler.js";
import { createRenderContext } from "../rendering/create-render-context.js";
import { lowerRenderOutput } from "../rendering/lower-output.js";
import { textMeasurerForDeclarations } from "../rendering/text-measurer-declarations.js";
import { isRenderOutput } from "@superimg/types";
import { extractTemplateMetadata } from "../shared/template-metadata.js";
import {
  extractProblemContext,
  scanHtmlIssues,
  scanSourceFootguns,
  scanAllFramesEmpty,
  inferIsAnimated,
} from "./scanners.js";

export {
  scanHtmlIssues,
  scanSourceFootguns,
  scanAllFramesEmpty,
  extractProblemContext,
  inferIsAnimated,
  inferIsComposed,
} from "./scanners.js";
export type { SourceFootgunOptions } from "./scanners.js";

/** Default validation options */
const DEFAULTS: Required<Omit<ValidationOptions, "data">> = {
  sampleFrames: [0, 0.25, 0.5, 0.75, 1.0],
  renderTimeout: 1000,
  width: 1920,
  height: 1080,
  fps: 30,
  duration: 3,
  checkOutput: true,
  checkEasingNames: true,
  craft: false,
  craftStrict: false,
};

/**
 * Run a function with a timeout.
 * Note: Only catches async delays, not synchronous infinite loops.
 */
async function withTimeout<T>(
  fn: () => T,
  timeoutMs: number,
  errorMessage: string
): Promise<T> {
  return Promise.race([
    Promise.resolve().then(fn),
    new Promise<T>((_, reject) => {
      setTimeout(() => reject(new Error(errorMessage)), timeoutMs);
    }),
  ]);
}

const SPRING_AND_SEMANTIC = [
  "gentle",
  "snappy",
  "fluid",
  "playful",
  "wobbly",
  "enter",
  "exit",
  "move",
  "loop",
] as const;

/** Check easing names in source code */
function checkEasingNames(code: string): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const validEasings = new Set<string>([...EASING_NAMES, ...SPRING_AND_SEMANTIC]);

  // Match calls with string easing: interpolate(p, ir, or, 'easingName'), t.tween(a, b, 'easingName'),
  // or { easing: 'easingName' } in options objects.
  const patterns = [
    /\.(?:interpolate|tween)\([^)]*,\s*['"]([^'"]+)['"]\s*\)/g,
    /easing:\s*['"]([^'"]+)['"]/g,
  ];

  for (const pattern of patterns) {
    for (const match of code.matchAll(pattern)) {
      const easingName = match[1];
      if (easingName && !validEasings.has(easingName)) {
        issues.push({
          severity: "error",
          code: "INVALID_EASING_NAME",
          message: `Unknown easing function: "${easingName}"`,
          suggestion: `Use a named curve, spring (gentle|snappy|fluid|playful|wobbly), or semantic (enter|exit|move|loop)`,
          context: match[0],
        });
      }
    }
  }

  return issues;
}

/**
 * Extract asset-like URLs from HTML (src, href attributes).
 * Returns URLs that look like images, videos, or audio.
 */
function extractAssetUrlsFromHtml(html: string): string[] {
  const urls: string[] = [];
  // Match src="..." and href="..." - capture the value
  const srcRegex = /(?:src|href)\s*=\s*["']([^"']+)["']/gi;
  const assetExtensions = /\.(png|jpg|jpeg|gif|webp|svg|mp4|webm|mov|mp3|wav|ogg|aac|m4a)(\?|#|$)/i;
  for (const match of html.matchAll(srcRegex)) {
    const url = match[1]?.trim();
    if (url && (assetExtensions.test(url) || url.startsWith("data:") || url.startsWith("http"))) {
      urls.push(url);
    }
  }
  return urls;
}

/**
 * Detect asset URLs in HTML that are not in the declared assets list.
 * Used for soft validation warnings.
 */
export function detectUndeclaredAssets(
  html: string,
  declaredUrls: Set<string>
): string[] {
  const used = extractAssetUrlsFromHtml(html);
  return used.filter((url) => !declaredUrls.has(url));
}

/**
 * Validate an AI-generated template.
 *
 * Runs comprehensive checks:
 * 1. Syntax validation (via rolldown bundling)
 * 2. Structure validation (export default, render function)
 * 3. Multi-frame rendering (catches frame-dependent errors)
 * 4. Output validation (NaN, undefined, null)
 * 5. Stdlib usage (invalid easing names)
 *
 * @param code - Raw TypeScript template code
 * @param options - Validation options
 * @returns Validation result with issues and suggestions
 *
 * @example
 * ```ts
 * const result = await validateAITemplate(aiCode, {
 *   width: 1920,
 *   height: 1080,
 *   fps: 30,
 *   duration: 3,
 * });
 *
 * if (!result.valid) {
 *   // Feed issues back to AI
 *   const feedback = result.issues.map(i =>
 *     `[${i.code}] ${i.message}` +
 *     (i.suggestion ? `\nFix: ${i.suggestion}` : '')
 *   ).join('\n\n');
 * }
 * ```
 */
export async function validateAITemplate(
  code: string,
  options?: ValidationOptions
): Promise<ValidationResult> {
  const startTime = performance.now();
  const opts = { ...DEFAULTS, ...options };
  const issues: ValidationIssue[] = [];
  const samples: { frame: number; progress: number; html: string }[] = [];

  // Phase 1: Check easing names + footguns in source (before bundling)
  if (opts.checkEasingNames) {
    issues.push(...checkEasingNames(code));
  }
  issues.push(
    ...scanSourceFootguns(code, {
      isAnimated: inferIsAnimated(code),
    }),
  );

  // Phase 2: Syntax validation (bundle the code)
  let bundledCode: string;
  try {
    bundledCode = await bundleTemplateCode(code);
  } catch (e) {
    const error = e as Error;
    // Extract line/column from bundler error if available
    const lineMatch = error.message.match(/(\d+):(\d+)/);
    issues.push({
      severity: "error",
      code: "SYNTAX_ERROR",
      message: error.message,
      suggestion: lineMatch
        ? `Check line ${lineMatch[1]}, column ${lineMatch[2]} for syntax errors`
        : "Check for missing brackets, quotes, or semicolons",
    });
    return {
      valid: false,
      issues,
      validationTimeMs: performance.now() - startTime,
    };
  }

  // Phase 3: Structure validation
  try {
    const metadata = await extractTemplateMetadata(code);
    if (!metadata.hasDefaultExport) {
      issues.push({
        severity: "error",
        code: "MISSING_DEFAULT_EXPORT",
        message: "Template must have a default export",
        suggestion: 'Add "export default define({ render(ctx) { ... } })"',
      });
    }
    if (!metadata.hasRenderExport) {
      issues.push({
        severity: "error",
        code: "MISSING_RENDER_FUNCTION",
        message: "Template must have a render function",
        suggestion: 'Add "render(ctx) { return Html({ width: \"fill\", height: \"fill\", html: \"<div>...</div>\" }); }" to define',
      });
    }
  } catch (e) {
    // Metadata extraction failed, try compilation anyway
  }

  // Phase 4: Compile and validate structure
  const compileResult = compileTemplate(bundledCode);
  if (compileResult.error) {
    issues.push({
      severity: "error",
      code: "MISSING_RENDER_FUNCTION",
      message: compileResult.error.message,
      suggestion: "Ensure template uses define({ render(ctx) { ... } })",
    });
    return {
      valid: false,
      issues,
      validationTimeMs: performance.now() - startTime,
    };
  }

  if (!compileResult.media) {
    issues.push({
      severity: "error",
      code: "MISSING_RENDER_FUNCTION",
      message: "Validation requires deterministic media",
      suggestion: "Use the interactive checks from @foxworth/superimg/interactive/define for live experiences",
    });
    return {
      valid: false,
      issues,
      validationTimeMs: performance.now() - startTime,
    };
  }
  const template = compileResult.media;
  const { createPreparedStdlibForTemplate } = await import("../shared/stdlib-capabilities.js");
  const preparedStdlib = await createPreparedStdlibForTemplate(template);
  const measurer = await textMeasurerForDeclarations(template.config?.fonts);
  const cfg = template.config ?? {};

  // Phase 5: Multi-frame render validation
  // Prefer template config over defaults so absolute-second director phases match.
  const fps = typeof cfg.fps === "number" ? cfg.fps : opts.fps;
  const width = typeof cfg.width === "number" ? cfg.width : opts.width;
  const height = typeof cfg.height === "number" ? cfg.height : opts.height;
  let resolvedDuration = opts.duration;
  if (cfg.duration !== undefined && options?.duration === undefined) {
    if (typeof cfg.duration === "number") {
      resolvedDuration = cfg.duration;
    } else if (typeof cfg.duration === "string") {
      try {
        const { parseDuration } = await import("../shared/utils.js");
        resolvedDuration = parseDuration(cfg.duration, "duration", fps);
      } catch {
        const n = parseFloat(cfg.duration);
        if (Number.isFinite(n) && n > 0) resolvedDuration = n;
      }
    }
  } else if (typeof resolvedDuration === "string") {
    try {
      const { parseDuration } = await import("../shared/utils.js");
      resolvedDuration = parseDuration(resolvedDuration, "duration", fps);
    } catch {
      resolvedDuration = parseFloat(String(resolvedDuration)) || 3;
    }
  }
  if (typeof resolvedDuration !== "number" || !Number.isFinite(resolvedDuration) || resolvedDuration <= 0) {
    resolvedDuration = 3;
  }
  const totalFrames = template.composition?.schedule.totalFrames ?? Math.ceil(resolvedDuration * fps);
  const mergedData = { ...(template.sample ?? {}), ...(opts.data ?? {}) };

  for (const progress of opts.sampleFrames) {
    const frame = Math.min(
      Math.floor(progress * (totalFrames - 1)),
      totalFrames - 1
    );
    const ctx = createRenderContext(
      frame,
      fps,
      totalFrames,
      width,
      height,
      mergedData,
      {},
      undefined,
      undefined,
      undefined,
      undefined,
      preparedStdlib,
    );

    try {
      const output = await withTimeout(
        () => template.render(ctx),
        opts.renderTimeout,
        `Render timeout at frame ${frame}`
      );

      if (!isRenderOutput(output)) {
        issues.push({
          severity: "error",
          code: "RENDER_RETURNED_NON_TREE",
          message: `render() returned ${typeof output} instead of a MediaElement tree`,
          frame,
          progress,
          suggestion: 'Return h()/primitives, or box legacy markup with Html({ width: "fill", height: "fill", html })',
        });
        continue;
      }

      const html = lowerRenderOutput(output, template.medium, {
        width,
        height,
        ...(measurer !== undefined ? { measurer } : {}),
      });

      // Validate non-empty
      if (html.trim() === "") {
        issues.push({
          severity: "warning",
          code: "RENDER_RETURNED_EMPTY",
          message: "render() returned empty string",
          frame,
          progress,
          suggestion: "Ensure render() returns HTML content",
        });
      }

      samples.push({ frame, progress, html });

      // Check HTML output for issues
      if (opts.checkOutput) {
        issues.push(...scanHtmlIssues(html, frame, progress));
      }
    } catch (e) {
      const error = e as Error;
      if (error.message.includes("timeout")) {
        issues.push({
          severity: "error",
          code: "RENDER_TIMEOUT",
          message: `Render exceeded ${opts.renderTimeout}ms at frame ${frame}`,
          frame,
          progress,
          suggestion: "Check for infinite loops or expensive computations",
        });
      } else {
        issues.push({
          severity: "error",
          code: "RENDER_EXCEPTION",
          message: error.message,
          frame,
          progress,
          suggestion: extractSuggestionFromError(error),
        });
      }
    }
  }

  // Soft validation: warn about undeclared assets (after all samples collected)
  const resolvedAssets = resolveConfigAssets(template.config?.assets);
  const declaredUrls = new Set(resolvedAssets.map((a) => a.src));
  const allUndeclared = new Set<string>();
  for (const s of samples) {
    for (const url of detectUndeclaredAssets(s.html, declaredUrls)) {
      allUndeclared.add(url);
    }
  }
  for (const url of allUndeclared) {
    issues.push({
      severity: "warning",
      code: "UNDECLARED_ASSET",
      message: `Template uses undeclared asset: ${url}`,
      suggestion: "Consider adding to config.assets for reliable preloading",
    });
  }

  // All samples empty → hard error (agent gate)
  issues.push(...scanAllFramesEmpty(samples.map((s) => s.html)));

  // Phase 6: Motion craft heuristics (optional)
  if (opts.craft) {
    const { critiqueTemplate } = await import("../critique/motion-critique.js");
    const craft = critiqueTemplate(template, {
      source: code,
      ...(opts.data !== undefined
        ? { data: opts.data as Record<string, unknown> }
        : {}),
    });
    const codeMap = {
      HOLD_TOO_SHORT: "CRAFT_HOLD_TOO_SHORT",
      EXIT_SLOWER_THAN_ENTER: "CRAFT_EXIT_SLOWER_THAN_ENTER",
      TEXT_HOLD_SHORT: "CRAFT_TEXT_HOLD_SHORT",
      STAGGER_OVER_CAP: "CRAFT_STAGGER_OVER_CAP",
      LINEAR_POSITIONAL: "CRAFT_LINEAR_POSITIONAL",
      LONG_CONTINUOUS_MOVE: "CRAFT_LONG_CONTINUOUS_MOVE",
      NO_HOLD_PHASE: "CRAFT_NO_HOLD_PHASE",
    } as const;
    for (const issue of craft.issues) {
      const mapped = codeMap[issue.code];
      if (!mapped) continue;
      issues.push({
        severity:
          opts.craftStrict && issue.severity !== "info"
            ? "error"
            : issue.severity === "error"
              ? "error"
              : "warning",
        code: mapped,
        message: issue.message,
        suggestion: issue.suggestion,
        ...(issue.progress !== undefined ? { progress: issue.progress } : {}),
      });
    }
  }

  // Determine validity (errors = invalid, warnings = valid)
  const hasErrors = issues.some((i) => i.severity === "error");

  return {
    valid: !hasErrors,
    issues,
    ...(samples.length > 0 ? { samples } : {}),
    validationTimeMs: performance.now() - startTime,
  };
}

/** Extract a helpful suggestion from common runtime errors */
function extractSuggestionFromError(error: Error): string {
  const msg = error.message.toLowerCase();

  if (msg.includes("undefined") || msg.includes("null")) {
    return "Check that all data properties exist. Use ctx.data.property with fallbacks.";
  }
  if (msg.includes("is not a function")) {
    return "Check function names. Use ctx.director(), ctx.std.interpolate, ctx.std.math, etc.";
  }
  if (msg.includes("cannot read property") || msg.includes("cannot read properties")) {
    return "A value is undefined. Check data properties and intermediate values.";
  }

  return "Check the render function for runtime errors at this frame.";
}

/**
 * Format validation result as human-readable text for AI feedback.
 */
export function formatValidationForAI(result: ValidationResult): string {
  if (result.valid && result.issues.length === 0) {
    return "VALIDATION_PASSED";
  }

  const lines = result.issues.map((issue) => {
    let line = `[${issue.severity.toUpperCase()}] ${issue.code}`;
    if (issue.frame !== undefined) {
      line += ` at frame ${issue.frame} (${((issue.progress ?? 0) * 100).toFixed(0)}%)`;
    }
    line += `: ${issue.message}`;
    if (issue.suggestion) {
      line += `\n  Fix: ${issue.suggestion}`;
    }
    if (issue.context) {
      line += `\n  Context: ${issue.context}`;
    }
    return line;
  });

  return lines.join("\n\n");
}
