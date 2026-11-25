//! Template config parsing utilities

import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import {
  DEFAULT_WIDTH,
  DEFAULT_HEIGHT,
  DEFAULT_FPS,
  resolveConfigAssets,
  parseDuration,
} from "@superimg/core";
import { mergeBaseConfig } from "./merge-base-config.js";
import {
  extractTemplateMetadata,
  type TemplateMetadataConfig,
} from "@superimg/core/template-metadata";
import {
  googleFont,
  type ProjectConfig,
  type ResolvedAssetDeclaration,
  type TemplateConfig,
} from "@superimg/types";
import {
  TemplateCompilationError,
  inferTemplateAnimated,
} from "@superimg/types";
import { analyzeMediaSource } from "@superimg/core/source-analysis";

/**
 * Bridge the statically-extracted `TemplateMetadataConfig` shape (duration is loose
 * `number | string`) to the runtime `TemplateConfig` shape (duration is `Duration`).
 * The string is already serialized from user source; downstream logic re-parses it
 * via `parsePositiveIntOrUndefined`, so passing it through as Duration is safe.
 */
export function metadataToTemplateConfig(
  config: TemplateMetadataConfig | undefined
): TemplateConfig | undefined {
  if (config === undefined) return undefined;
  const { fonts, duration, ...rest } = config;
  return {
    ...rest,
    ...(duration !== undefined ? { duration: duration as NonNullable<TemplateConfig["duration"]> } : {}),
    ...(fonts !== undefined ? { fonts: fonts.map((spec) => googleFont(spec)) } : {}),
  } as TemplateConfig;
}

export interface ParsedTemplate {
  templateCode: string;
  metasample: {
    hasRenderExport: boolean;
    hasDefaultExport: boolean;
  };
  /** Rasterizer family — from `define({ medium })`, default "html". */
  medium: "html" | "svg";
  /** True when the config declares both fps and duration (renders N frames). */
  animated: boolean;
  templateConfig?: TemplateConfig;
  resolvedAssets: ResolvedAssetDeclaration[];
  config: {
    width?: number;
    height?: number;
    fps?: number;
    duration?: number;
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
    (input.templateConfig?.duration === undefined ? undefined : parseDuration(input.templateConfig.duration, "duration", fps)) ??
    (input.cascadingConfig?.duration === undefined ? undefined : parseDuration(input.cascadingConfig.duration, "duration", fps)) ??
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
  const source = readFileSync(fullPath, "utf-8");
  const descriptor = analyzeMediaSource(source, fullPath);
  const templateCode = descriptor.mediaProjection.code;

  // Parse metadata statically without executing template code.
  const metadata = await extractTemplateMetadata(templateCode);
  if (!metadata.hasRenderExport) {
    throw new TemplateCompilationError({
      file: fullPath,
      syntaxError: "Template must define a `render` function inside `define({ render(ctx) { ... } })`.",
      suggestion:
        'Import `define` and `Html` from "@foxworth/superimg", then add `export default define({ render() { return Html({ html: "<div/>" }); } })`.',
    });
  }

  const rawTemplateConfig = metadataToTemplateConfig(metadata.config);
  const resolvedAssets = resolveConfigAssets(
    rawTemplateConfig?.assets,
    dirname(fullPath)
  );

  const templateConfig = options?.cascadingConfig
    ? mergeCascadingIntoRenderConfig(rawTemplateConfig, options.cascadingConfig)
    : (rawTemplateConfig ?? {});

  const resolvedConfig = resolveRenderConfig({
    templateConfig,
    ...(options?.cascadingConfig !== undefined
      ? { cascadingConfig: options.cascadingConfig }
      : {}),
  });

  // Static metadata carries no `animated` stamp, so this is inference-only —
  // same shared rule as IR/engine/runtime.
  const animated = inferTemplateAnimated({
    ...(metadata.config !== undefined ? { config: metadata.config } : {}),
  });

  return {
    templateCode,
    metasample: {
      hasRenderExport: metadata.hasRenderExport,
      hasDefaultExport: metadata.hasDefaultExport,
    },
    medium: metadata.medium ?? "html",
    animated,
    templateConfig,
    resolvedAssets,
    config: resolvedConfig,
  };
}
