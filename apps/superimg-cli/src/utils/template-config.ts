//! Template config parsing utilities

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { extractTemplateMetadata } from "./template-metadata.js";

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
    durationSeconds?: number;
    outputs?: Record<string, { width?: number; height?: number; fps?: number }>;
  };
}

export interface RenderConfig {
  width?: number;
  height?: number;
  fps?: number;
  durationSeconds?: number;
  fonts?: string[];
  outputs?: Record<string, { width?: number; height?: number; fps?: number }>;
}

export interface RenderConfigDefaults {
  width: number;
  height: number;
  fps: number;
  durationSeconds: number;
}

export const DEFAULT_RENDER_CONFIG: RenderConfigDefaults = {
  width: 1920,
  height: 1080,
  fps: 30,
  durationSeconds: 5,
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
    durationSeconds?: string;
  };
  templateConfig?: RenderConfig;
  defaults?: RenderConfigDefaults;
}

/**
 * Resolve render config with explicit precedence (highest wins):
 *
 * 1. CLI flags (`--width`, `--height`, `--fps`, `--duration`)
 * 2. Template-exported `config` object (`export const config = { ... }`)
 * 3. Built-in defaults (1920x1080, 30 fps, 5 s)
 */
export function resolveRenderConfig(input: ResolveRenderConfigInput): RenderConfigDefaults {
  const defaults = input.defaults ?? DEFAULT_RENDER_CONFIG;
  const cliWidth = parsePositiveIntOrUndefined(input.cli?.width);
  const cliHeight = parsePositiveIntOrUndefined(input.cli?.height);
  const cliFps = parsePositiveIntOrUndefined(input.cli?.fps);
  const cliDuration = parsePositiveIntOrUndefined(input.cli?.durationSeconds);

  const width =
    cliWidth ??
    positiveNumberOrUndefined(input.templateConfig?.width) ??
    defaults.width;
  const height =
    cliHeight ??
    positiveNumberOrUndefined(input.templateConfig?.height) ??
    defaults.height;
  const fps =
    cliFps ??
    positiveNumberOrUndefined(input.templateConfig?.fps) ??
    defaults.fps;
  const durationSeconds =
    cliDuration ??
    positiveNumberOrUndefined(input.templateConfig?.durationSeconds) ??
    defaults.durationSeconds;

  return { width, height, fps, durationSeconds };
}

/**
 * Parse template file and extract metadata/config
 */
export function parseTemplate(templatePath: string): ParsedTemplate {
  const fullPath = resolve(templatePath);
  const templateCode = readFileSync(fullPath, "utf-8");

  // Parse metadata statically without executing template code.
  const metadata = extractTemplateMetadata(templateCode);
  if (!metadata.hasRenderExport) {
    throw new Error("Template must export a `render` function.");
  }

  const templateConfig = metadata.config;

  const resolvedConfig = resolveRenderConfig({
    templateConfig,
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
  outputs: Record<string, { width?: number; height?: number; fps?: number }>,
  baseConfig: RenderConfigDefaults
): { name: string; width: number; height: number; fps: number } {
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
  };
}

/**
 * Resolve all output presets defined in `outputs` against base config defaults.
 */
export function resolveAllPresets(
  outputs: Record<string, { width?: number; height?: number; fps?: number }>,
  baseConfig: RenderConfigDefaults
): Array<{ name: string; width: number; height: number; fps: number }> {
  return Object.keys(outputs).map((name) => resolvePresetConfig(name, outputs, baseConfig));
}
