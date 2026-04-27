import { existsSync, statSync } from "node:fs";
import { resolve, dirname, basename, join, isAbsolute } from "node:path";
import type { ProjectConfig, OutputFormat } from "@superimg/types";

/** Check if path is a directory (exists and is dir, or ends with /) */
export function isDirectory(path: string): boolean {
  if (path.endsWith("/")) return true;
  try {
    return existsSync(path) && statSync(path).isDirectory();
  } catch {
    return false;
  }
}

/** Extract video name from template path (e.g., "intro.video.ts" -> "intro") */
export function deriveVideoName(templatePath: string): string {
  const base = basename(templatePath);
  return base.replace(/\.video\.(ts|js|jsx|tsx)$/, "");
}

interface ResolveOutputOptions {
  /** The CLI -o / --output argument */
  outputArg?: string;
  /** The absolute path to the parsed template */
  templatePath: string;
  /** The cascading configuration derived for this template */
  cascadingConfig?: ProjectConfig;
  /** Preset suffix (e.g., 'youtube') */
  presetSuffix?: string;
  /** Specific outFile override from the preset config */
  presetOutFile?: string;
  /** Specific outDir override from the preset config */
  presetOutDir?: string;
  /** Output format — determines file extension */
  format?: OutputFormat;
}

/**
 * Resolve the final output path for a rendered template.
 *
 * Outputs land *next to the template* by default — easier to find, easier to
 * clean. For `examples/developer/http-trace/http-trace.video.ts`, the rendered
 * MP4 goes to `examples/developer/http-trace/output/http-trace.mp4`.
 *
 * Precedence (highest first):
 *   1. `presetOutFile` — exact path declared by an output preset
 *      (template-dir-relative unless absolute). Skipped if CLI `-o` is set.
 *   2. CLI `-o <file>` — exact destination file.
 *   3. CLI `-o <dir>` — `<dir>/<name>.<ext>` (flat — no mirroring).
 *   4. `presetOutDir` — `<templateDir>/<presetOutDir>/<name>.<ext>` (or absolute).
 *   5. `cascadingConfig.outDir` — `<templateDir>/<outDir>/<name>.<ext>` (or absolute).
 *   6. Default — `<templateDir>/output/<name>.<ext>`.
 */
export function resolveOutputPath({
  outputArg,
  templatePath,
  cascadingConfig,
  presetSuffix,
  presetOutFile,
  presetOutDir,
  format,
}: ResolveOutputOptions): string {
  const templateDir = dirname(templatePath);

  // 1. Preset exact-file override (template-dir-relative, or absolute).
  if (presetOutFile && !outputArg) {
    return resolve(templateDir, presetOutFile);
  }

  const videoName = deriveVideoName(templatePath);
  const suffix = presetSuffix ? `-${presetSuffix}` : "";
  const ext = format === "gif" ? ".gif" : format === "webm" ? ".webm" : ".mp4";
  const filename = `${videoName}${suffix}${ext}`;

  // 2. CLI exact-file override.
  if (outputArg && !isDirectory(outputArg)) {
    return resolve(outputArg);
  }

  // 3. CLI directory override — flat, no mirroring.
  if (outputArg) {
    return resolve(outputArg.replace(/\/$/, ""), filename);
  }

  // 4 & 5. Preset / config outDir, template-dir-relative (or absolute).
  const outDir = presetOutDir ?? cascadingConfig?.outDir ?? "output";
  return isAbsolute(outDir) ? join(outDir, filename) : join(templateDir, outDir, filename);
}

interface ResolveDebugHtmlDirOptions {
  /** The resolved render output file path */
  outputPath: string;
  /** Named output target, e.g. a preset name */
  outputName: string;
}

/**
 * Resolve the debug HTML directory next to the final render output.
 *
 * For `<templateDir>/output/promo.mp4`, the corresponding frame HTML lives in:
 * `<templateDir>/output/.superimg/debug/default/`
 */
export function resolveDebugHtmlDir({
  outputPath,
  outputName,
}: ResolveDebugHtmlDirOptions): string {
  return join(dirname(outputPath), ".superimg", "debug", outputName);
}
