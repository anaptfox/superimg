//! Template config parsing utilities

import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import {
  DEFAULT_WIDTH,
  DEFAULT_HEIGHT,
  DEFAULT_FPS,
  resolveConfigAssets,
} from "@superimg/core";
import { mergeBaseConfig } from "./merge-base-config.js";
import {
  extractTemplateMetadata,
  type TemplateMetadataConfig,
} from "@superimg/core/template-metadata";
import type {
  ProjectConfig,
  ResolvedAssetDeclaration,
  TemplateConfig,
  OutputPreset,
} from "@superimg/types";
import { TemplateCompilationError, ValidationError } from "@superimg/types";
import { didYouMean } from "@superimg/core/errors";

/**
 * Bridge the statically-extracted `TemplateMetadataConfig` shape (duration is loose
 * `number | string`) to the runtime `TemplateConfig` shape (duration is `Duration`).
 * The string is already serialized from user source; downstream logic re-parses it
 * via `parsePositiveIntOrUndefined`, so passing it through as Duration is safe.
 */
export function metadataToTemplateConfig(
  config: TemplateMetadataConfig | undefined
): TemplateConfig | undefined {
  return config as TemplateConfig | undefined;
}

export interface ParsedTemplate {
  templateCode: string;
  metadata: {
    hasRenderExport: boolean;
    hasDefaultExport: boolean;
  };
  templateConfig?: TemplateConfig;
  resolvedAssets: ResolvedAssetDeclaration[];
  config: {
    width?: number;
    height?: number;
    fps?: number;
    duration?: number;
    outputs?: Record<string, OutputPreset>;
  };
}

export interface RenderConfigDefaults {
  width: number;
  height: number;
  fps: number;
  duration: number;
}

export const DEFAULT_RENDER_CONFIG: RenderConfigDefaults = {
  width: DEFAULT_WIDTH,
  height: DEFAULT_HEIGHT,
  fps: DEFAULT_FPS,
  duration: 5,
};

function positiveNumberOrUndefined(value: unknown): number | undefined {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return undefined;
  }
  return value > 0 ? value : undefined;
}

function parsePositiveIntOrUndefined(value: string | undefined): number | undefined {
  if (value === undefined) return undefined;
  const parsed = parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
}

export interface ResolveRenderConfigInput {
  cli?: {
    width?: string;
    height?: string;
    fps?: string;
    duration?: string;
  };
  templateConfig?: TemplateConfig;
  cascadingConfig?: ProjectConfig;
  defaults?: RenderConfigDefaults;
}

/**
 * Resolve render config with explicit precedence (highest wins):
 *
 * 1. CLI flags (`--width`, `--height`, `--fps`, `--duration`)
 * 2. Template-exported `config` object
 * 3. Cascading `_config.ts` (folder/project)
 * 4. Built-in defaults (1920x1080, 30 fps, 5 s)
 */
export function resolveRenderConfig(input: ResolveRenderConfigInput): RenderConfigDefaults {
  const defaults = input.defaults ?? DEFAULT_RENDER_CONFIG;
  const cliWidth = parsePositiveIntOrUndefined(input.cli?.width);
  const cliHeight = parsePositiveIntOrUndefined(input.cli?.height);
  const cliFps = parsePositiveIntOrUndefined(input.cli?.fps);
  const cliDuration = parsePositiveIntOrUndefined(input.cli?.duration);

  const width =
    cliWidth ??
    positiveNumberOrUndefined(input.templateConfig?.width) ??
    positiveNumberOrUndefined(input.cascadingConfig?.width) ??
    defaults.width;
  const height =
    cliHeight ??
    positiveNumberOrUndefined(input.templateConfig?.height) ??
    positiveNumberOrUndefined(input.cascadingConfig?.height) ??
    defaults.height;
  const fps =
    cliFps ??
    positiveNumberOrUndefined(input.templateConfig?.fps) ??
    positiveNumberOrUndefined(input.cascadingConfig?.fps) ??
    defaults.fps;
  const duration =
    cliDuration ??
    positiveNumberOrUndefined(input.templateConfig?.duration) ??
    positiveNumberOrUndefined(input.cascadingConfig?.duration) ??
    defaults.duration;

  return { width, height, fps, duration };
}

/**
 * Merge a cascading project/folder config into a template config.
 * Cascading config is the base; template config is the override layer.
 */
export function mergeCascadingIntoRenderConfig(
  templateConfig: TemplateConfig | undefined,
  cascadingConfig: ProjectConfig | undefined
): TemplateConfig {
  const layer: TemplateConfig = templateConfig ?? {};
  return mergeBaseConfig<TemplateConfig>(cascadingConfig ?? {}, layer);
}

/**
 * Parse template file and extract metadata/config.
 * Optionally merges cascadingConfig (from _config.ts) into template config.
 */
export async function parseTemplate(
  templatePath: string,
  options?: { cascadingConfig?: ProjectConfig }
): Promise<ParsedTemplate> {
  const fullPath = resolve(templatePath);
  const templateCode = readFileSync(fullPath, "utf-8");

  // Parse metadata statically without executing template code.
  const metadata = await extractTemplateMetadata(templateCode);
  if (!metadata.hasRenderExport) {
    throw new TemplateCompilationError({
      file: fullPath,
      syntaxError: "Template must define a `render` function inside `defineScene({ render(ctx) { ... } })`.",
      suggestion:
        "Add `export default defineScene({ render(ctx) { return '<div/>' } })` to your template.",
    });
  }

  const rawTemplateConfig = metadataToTemplateConfig(metadata.config);
  const resolvedAssets = resolveConfigAssets(
    rawTemplateConfig?.assets,
    dirname(fullPath)
  );

  const templateConfig = options?.cascadingConfig
    ? mergeCascadingIntoRenderConfig(rawTemplateConfig, options.cascadingConfig)
    : rawTemplateConfig;

  const resolvedConfig = resolveRenderConfig({
    templateConfig,
    cascadingConfig: options?.cascadingConfig,
  });

  return {
    templateCode,
    metadata: {
      hasRenderExport: metadata.hasRenderExport,
      hasDefaultExport: metadata.hasDefaultExport,
    },
    templateConfig,
    resolvedAssets,
    config: resolvedConfig,
  };
}

/**
 * Resolve a single named output preset against base config defaults.
 * Throws if the preset name is not found in `outputs`.
 */
export function resolvePresetConfig(
  presetName: string,
  outputs: Record<string, OutputPreset>,
  baseConfig: RenderConfigDefaults
): { name: string; width: number; height: number; fps: number; outDir?: string; outFile?: string } {
  const preset = outputs[presetName];
  if (!preset) {
    const candidates = Object.keys(outputs);
    const guess = didYouMean(presetName, candidates);
    const available = candidates.join(", ");
    throw new ValidationError({
      field: "preset",
      expectedType: "preset name",
      receivedValue: presetName,
      suggestion: guess
        ? `Did you mean "${guess}"? Available: ${available}.`
        : `Available presets: ${available}.`,
    });
  }
  return {
    name: presetName,
    width: preset.width ?? baseConfig.width,
    height: preset.height ?? baseConfig.height,
    fps: preset.fps ?? baseConfig.fps,
    outDir: preset.outDir,
    outFile: preset.outFile,
  };
}

/**
 * Resolve all output presets defined in `outputs` against base config defaults.
 */
export function resolveAllPresets(
  outputs: Record<string, OutputPreset>,
  baseConfig: RenderConfigDefaults
): Array<{ name: string; width: number; height: number; fps: number; outDir?: string; outFile?: string }> {
  return Object.keys(outputs).map((name) => resolvePresetConfig(name, outputs, baseConfig));
}
