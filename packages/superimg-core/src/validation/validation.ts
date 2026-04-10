//! AI Template Validation
//! Comprehensive validation for AI-generated templates with actionable feedback

import type {
  ValidationErrorCode,
  ValidationIssue,
  ValidationResult,
  ValidationOptions,
  TemplateModule,
} from "@superimg/types";
import { resolveConfigAssets } from "../shared/assets.js";
import { EASING_NAMES } from "@superimg/stdlib/tween";
import { bundleTemplateCode } from "../bundler/bundler.js";
import { compileTemplate } from "../rendering/compiler.js";
import { createRenderContext } from "../rendering/wasm.js";
import { extractTemplateMetadata } from "../shared/template-metadata.js";

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

/** Extract context around NaN/undefined in HTML output */
function extractProblemContext(html: string, needle: string): string {
  const idx = html.indexOf(needle);
  if (idx === -1) return "";
  const start = Math.max(0, idx - 30);
  const end = Math.min(html.length, idx + needle.length + 30);
  return "..." + html.slice(start, end) + "...";
}

/** Check easing names in source code */
function checkEasingNames(code: string): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const validEasings = new Set(EASING_NAMES);

  // Match tween calls with string easing: tween(a, b, p, 'easingName') or { easing: 'easingName' }
  const patterns = [
    /\.tween\([^)]*,\s*['"]([^'"]+)['"]\s*\)/g,
    /easing:\s*['"]([^'"]+)['"]/g,
  ];

  for (const pattern of patterns) {
    for (const match of code.matchAll(pattern)) {
      const easingName = match[1];
      if (easingName && !validEasings.has(easingName as any)) {
        issues.push({
          severity: "error",
          code: "INVALID_EASING_NAME",
          message: `Unknown easing function: "${easingName}"`,
          suggestion: `Use one of: ${EASING_NAMES.slice(0, 5).join(", ")}, ... (${EASING_NAMES.length} total)`,
          context: match[0],
        });
      }
    }
  }

  return issues;
}

/** Check rendered HTML for common issues */
function checkHtmlOutput(
  html: string,
  frame: number,
  progress: number
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  // Check for NaN (common animation bug)
  if (html.includes("NaN")) {
    issues.push({
      severity: "error",
      code: "ANIMATION_PRODUCES_NAN",
      message: "Render output contains NaN",
      frame,
      progress,
      context: extractProblemContext(html, "NaN"),
      suggestion: "Check for division by zero or invalid math operations",
    });
  }

  // Check for undefined in style attributes (common data bug)
  if (/style="[^"]*undefined[^"]*"/i.test(html)) {
    issues.push({
      severity: "error",
      code: "UNDEFINED_IN_OUTPUT",
      message: 'Style attribute contains "undefined"',
      frame,
      progress,
      context: extractProblemContext(html, "undefined"),
      suggestion: "Check that all data properties exist and have values",
    });
  }

  // Check for undefined anywhere (warning)
  if (html.includes("undefined") && !issues.some((i) => i.code === "UNDEFINED_IN_OUTPUT")) {
    issues.push({
      severity: "warning",
      code: "UNDEFINED_IN_OUTPUT",
      message: 'Render output contains "undefined"',
      frame,
      progress,
      context: extractProblemContext(html, "undefined"),
      suggestion: "Check that all interpolated values are defined",
    });
  }

  // Check for null in output
  if (/style="[^"]*null[^"]*"/i.test(html) || html.includes(">null<")) {
    issues.push({
      severity: "warning",
      code: "NULL_IN_OUTPUT",
      message: 'Render output contains "null"',
      frame,
      progress,
      context: extractProblemContext(html, "null"),
      suggestion: "Check that all data properties have non-null values",
    });
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
 * 1. Syntax validation (via esbuild bundling)
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

  // Phase 1: Check easing names in source (before bundling)
  if (opts.checkEasingNames) {
    issues.push(...checkEasingNames(code));
  }

  // Phase 2: Syntax validation (bundle the code)
  let bundledCode: string;
  try {
    bundledCode = await bundleTemplateCode(code);
  } catch (e) {
    const error = e as Error;
    // Extract line/column from esbuild error if available
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
        suggestion: 'Add "export default defineScene({ render(ctx) { ... } })"',
      });
    }
    if (!metadata.hasRenderExport) {
      issues.push({
        severity: "error",
        code: "MISSING_RENDER_FUNCTION",
        message: "Template must have a render function",
        suggestion: 'Add "render(ctx) { return `<div>...</div>`; }" to defineScene',
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
      suggestion: "Ensure template uses defineScene({ render(ctx) { ... } })",
    });
    return {
      valid: false,
      issues,
      validationTimeMs: performance.now() - startTime,
    };
  }

  const template = compileResult.template!;

  // Phase 5: Multi-frame render validation
  const resolvedDuration = typeof opts.duration === "string" ? parseFloat(opts.duration) || 3 : opts.duration;
  const totalFrames = Math.ceil(resolvedDuration * opts.fps);
  const mergedData = { ...(template.data ?? {}), ...(opts.data ?? {}) };

  for (const progress of opts.sampleFrames) {
    const frame = Math.min(
      Math.floor(progress * (totalFrames - 1)),
      totalFrames - 1
    );
    const ctx = createRenderContext(
      frame,
      opts.fps,
      totalFrames,
      opts.width,
      opts.height,
      mergedData
    );

    try {
      const html = await withTimeout(
        () => template.render(ctx),
        opts.renderTimeout,
        `Render timeout at frame ${frame}`
      );

      // Validate return type
      if (typeof html !== "string") {
        issues.push({
          severity: "error",
          code: "RENDER_RETURNED_NON_STRING",
          message: `render() returned ${typeof html} instead of string`,
          frame,
          progress,
          suggestion: "Ensure render() returns a template literal string",
        });
        continue;
      }

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
        issues.push(...checkHtmlOutput(html, frame, progress));
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

  // Determine validity (errors = invalid, warnings = valid)
  const hasErrors = issues.some((i) => i.severity === "error");

  return {
    valid: !hasErrors,
    issues,
    samples: samples.length > 0 ? samples : undefined,
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
    return "Check function names. Use ctx.std.tween, ctx.std.math.lerp, etc.";
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
