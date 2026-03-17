//! Template config parsing utilities

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { extractTemplateMetadata } from "@superimg/core/template-metadata";
import type { ProjectConfig, TailwindConfig, EncodingOptions } from "@superimg/types";

export interface ParsedTemplate {
  templateCode: string;
  metadata: {
    hasRenderExport: boolean;
    hasDefaultExport: boolean;
  };
  templateConfig?: RenderConfig;
  config?: {
    width?: number;
    height?: number;
    fps?: number;
    duration?: number;
    outputs?: Record<string, { width?: number; height?: number; fps?: number; outDir?: string; outFile?: string }>;
  };
}

export interface AudioConfig {
  src: string;
  loop?: boolean;
  volume?: number;
  fadeIn?: number;
  fadeOut?: number;
}

export interface RenderConfig {
  width?: number;
  height?: number;
  fps?: number;
  duration?: number;
  fonts?: string[];
  inlineCss?: string[];
  stylesheets?: string[];
  tailwind?: boolean | TailwindConfig;
  outputs?: Record<string, { width?: number; height?: number; fps?: number; outDir?: string; outFile?: string }>;
  encoding?: EncodingOptions;
  watermark?: import("@superimg/types").WatermarkValue;
  background?: import("@superimg/types").BackgroundValue;
  audio?: string | AudioConfig;
}

export interface RenderConfigDefaults {
  width: number;
  height: number;
  fps: number;
  duration: number;
}

export const DEFAULT_RENDER_CONFIG: RenderConfigDefaults = {
  width: 1920,
  height: 1080,
  fps: 30,
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
  templateConfig?: RenderConfig;
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

/** Merge fonts, inlineCss, stylesheets, tailwind from cascading config into template config */
export function mergeCascadingIntoRenderConfig(
  templateConfig: RenderConfig | undefined,
  cascadingConfig: ProjectConfig | undefined
): RenderConfig {
  const merged: RenderConfig = { ...templateConfig };
  if (cascadingConfig?.fonts?.length) {
    merged.fonts = [...(cascadingConfig.fonts ?? []), ...(templateConfig?.fonts ?? [])];
  }
  if (cascadingConfig?.inlineCss?.length) {
    merged.inlineCss = [...(cascadingConfig.inlineCss ?? []), ...(templateConfig?.inlineCss ?? [])];
  }
  if (cascadingConfig?.stylesheets?.length) {
    merged.stylesheets = [...(cascadingConfig.stylesheets ?? []), ...(templateConfig?.stylesheets ?? [])];
  }
  if (cascadingConfig?.outputs && !merged.outputs) {
    merged.outputs = cascadingConfig.outputs;
  }
  if (cascadingConfig?.watermark !== undefined && merged.watermark === undefined) {
    merged.watermark = cascadingConfig.watermark;
  }
  if (cascadingConfig?.background !== undefined && merged.background === undefined) {
    merged.background = cascadingConfig.background;
  }
  // Tailwind: template config takes precedence over cascading config
  if (merged.tailwind === undefined && cascadingConfig?.tailwind !== undefined) {
    merged.tailwind = cascadingConfig.tailwind;
  }
  return merged;
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
    throw new Error("Template must define a `render` function inside `defineScene({ render(ctx) { ... } })`.");
  }

  const rawTemplateConfig = metadata.config;
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
    config: resolvedConfig,
  };
}

/**
 * Resolve a single named output preset against base config defaults.
 * Throws if the preset name is not found in `outputs`.
 */
export function resolvePresetConfig(
  presetName: string,
  outputs: Record<string, { width?: number; height?: number; fps?: number; outDir?: string; outFile?: string }>,
  baseConfig: RenderConfigDefaults
): { name: string; width: number; height: number; fps: number; outDir?: string; outFile?: string } {
  const preset = outputs[presetName];
  if (!preset) {
    const available = Object.keys(outputs).join(", ");
    throw new Error(`Unknown preset "${presetName}". Available presets: ${available}`);
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
  outputs: Record<string, { width?: number; height?: number; fps?: number; outDir?: string; outFile?: string }>,
  baseConfig: RenderConfigDefaults
): Array<{ name: string; width: number; height: number; fps: number; outDir?: string; outFile?: string }> {
  return Object.keys(outputs).map((name) => resolvePresetConfig(name, outputs, baseConfig));
}
