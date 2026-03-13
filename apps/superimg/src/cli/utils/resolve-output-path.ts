import { existsSync, statSync } from "node:fs";
import { resolve, dirname, basename, join, relative, isAbsolute } from "node:path";
import type { ProjectConfig } from "@superimg/types";

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
  /** The absolute path to the project root */
  projectRoot: string;
  /** The cascading configuration derived for this template */
  cascadingConfig?: ProjectConfig;
  /** Preset suffix (e.g., 'youtube') */
  presetSuffix?: string;
  /** Specific outFile override from the preset config */
  presetOutFile?: string;
  /** Specific outDir override from the preset config */
  presetOutDir?: string;
}

/** 
 * Resolves the final output path for a rendered template.
 * 
 * Precedence:
 * 1. Explicit preset `outFile` (if present, resolves relative to project root or absolute)
 * 2. CLI `-o` (override everything. If ending in .mp4/.webm it's a file, otherwise it's a dir base)
 * 3. Preset `outDir` / Config `outDir` (Base directory instead of "output")
 * 
 * Default behavior (no overrides):
 * Mirrors the template's relative path inside the `output/` directory.
 */
export function resolveOutputPath({
  outputArg,
  templatePath,
  projectRoot,
  cascadingConfig,
  presetSuffix,
  presetOutFile,
  presetOutDir,
}: ResolveOutputOptions): string {
  
  // 1. Preset Exact File Override (Highest Precedence if no CLI override)
  if (presetOutFile && !outputArg) {
    return resolve(projectRoot, presetOutFile);
  }

  // Derive the inner filename
  const videoName = deriveVideoName(templatePath);
  const suffix = presetSuffix ? `-${presetSuffix}` : "";
  const defaultFilename = `${videoName}${suffix}.mp4`;

  // 2. CLI Exact File Override
  if (outputArg && !isDirectory(outputArg)) {
    // If output argument looks like a specific file, respect it directly.
    return resolve(outputArg);
  }

  // Determine the Base Output Directory (default vs config outDirs)
  let baseOutDirName = cascadingConfig?.outDir || "output";
  if (presetOutDir) {
     baseOutDirName = presetOutDir;
  }

  // Determine where to root the structure based on the CLI `-o` directory override
  const baseOutDir = outputArg 
    ? resolve(outputArg.replace(/\/$/, "")) // CLI overrides the entire base outDir
    : resolve(projectRoot, baseOutDirName);

  // Determine the mirrored path prefix relative to the project root
  const templateDir = dirname(templatePath);
  const relativeToRoot = relative(projectRoot, templateDir);
  
  // If the template is outside the project root (edge case), just drop it in the base dir without mirroring
  if (relativeToRoot.startsWith("..") || isAbsolute(relativeToRoot)) {
     return join(baseOutDir, defaultFilename);
  }

  // Construct mirrored path: <BASE_OUT_DIR>/<RELATIVE_MIRROR>/<FILENAME>
  return join(baseOutDir, relativeToRoot, defaultFilename);
}
