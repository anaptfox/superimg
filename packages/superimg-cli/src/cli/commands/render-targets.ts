//! Pure target resolution for the render command.
//!
//! Given a template path and CLI options, resolves the template, parses it,
//! validates --preset/--presets combinations, and builds the list of render
//! targets (one per output preset, or one for the default config).
//!
//! Throws on failure — never calls process.exit. The CLI surface in render.tsx
//! catches throws at one centralized boundary.

import { existsSync, statSync } from "node:fs";
import { dirname } from "node:path";
import type { EncodingOptions, Medium } from "@superimg/types";
import { ValidationError } from "@superimg/types";
import { resolveTemplatePath } from "../utils/resolve-template.js";
import { findProjectRoot } from "../utils/find-project-root.js";
import { loadCascadingConfig } from "../utils/config-loader.js";
import {
  parseTemplate,
  resolveRenderConfig,
  resolvePresetConfig,
  resolveAllPresets,
} from "../utils/template-config.js";
import { resolveDebugHtmlDir, resolveOutputPath } from "../utils/resolve-output-path.js";
import { loadDataInput } from "../utils/data-loader.js";
import { deriveEntrySlug } from "../utils/slug.js";
import { resolveFormat, buildEncodingOptions, type OutputFormat } from "./render-encoding.js";

export interface RenderOptions {
  output?: string;
  format?: string;
  width?: string;
  height?: string;
  fps?: string;
  frame?: string;
  preset?: string;
  presets?: boolean;
  all?: boolean;
  quality?: string;
  videoCodec?: string;
  videoBitrate?: string;
  audioCodec?: string;
  audioBitrate?: string;
  keyframeInterval?: string;
  bitrateMode?: string;
  latencyMode?: string;
  hardwareAccel?: string;
  audioBitrateMode?: string;
  fastStart?: string;
  clusterDuration?: string;
  maxColors?: string;
  gifLoop?: string;
  gifDither?: string;
  debugHtml?: boolean;
  /**
   * Optional inline JSON or path to a `.json` / `.ts` / `.js` data file.
   * Object → one render with that data. Array → one render per entry.
   * Composes with `--presets` so N entries × M presets = N×M MP4s.
   */
  data?: string;
  batchEntries?: import("@superimg/types").BatchEntry[];
  /** Exit non-zero if any video fails when using --all. Default: best-effort (exit 1 only after all complete). */
  failOnError?: boolean;
  /** Resolve and print render targets without rendering. */
  dryRun?: boolean;
  /** Output machine-readable JSON instead of human text. */
  json?: boolean;
  /**
   * Comma-separated list of container endpoint URLs for distributed chunk rendering.
   * When set, the render is split into chunks and sent to these endpoints in parallel,
   * then stitched locally with ffmpeg. Example: "https://render-a.example.com,https://render-b.example.com"
   */
  distributed?: string;
  /** Absolute execution budget for each CLI render invocation, in seconds. */
  timeout?: string;
}

export interface RenderTarget {
  name: string;
  width: number;
  height: number;
  fps: number;
  /** Duration override in seconds. Set for image templates (1 frame). */
  duration?: number;
  outputPath: string;
  outputName: string;
  debugHtmlDir: string;
  /** Resolved output format for this target (png, webp, jpeg, svg, html, gif, mp4, webm). */
  format?: OutputFormat;
  /** Per-target data override. Set when --data supplied an entry for this target. */
  data?: Record<string, unknown>;
  /** Human-readable label for progress logs, e.g. "jane-doe". */
  entryLabel?: string;
  /** Single-frame capture index for still/html output */
  frame?: number;
}

export interface ResolvedTargets {
  resolvedTemplate: string;
  templateData: Awaited<ReturnType<typeof parseTemplate>>;
  resolvedConfig: ReturnType<typeof resolveRenderConfig>;
  cascadingConfig: Awaited<ReturnType<typeof loadCascadingConfig>>;
  targets: RenderTarget[];
  /** Rasterizer family (html → Chromium, svg → resvg). */
  medium: Medium;
  /** True when the template renders N frames. */
  animated: boolean;
}



export function buildRenderTarget(args: {
  name: string;
  width: number;
  height: number;
  fps: number;
  duration?: number;
  outputPath: string;
  format?: OutputFormat;
  data?: Record<string, unknown>;
  entryLabel?: string;
  frame?: number;
}): RenderTarget {
  return {
    name: args.name,
    width: args.width,
    height: args.height,
    fps: args.fps,
    outputPath: args.outputPath,
    outputName: args.name,
    debugHtmlDir: resolveDebugHtmlDir({
      outputPath: args.outputPath,
      outputName: args.name,
    }),
    ...(args.duration !== undefined ? { duration: args.duration } : {}),
    ...(args.frame !== undefined ? { frame: args.frame } : {}),
    ...(args.format !== undefined ? { format: args.format } : {}),
    ...(args.data !== undefined ? { data: args.data } : {}),
    ...(args.entryLabel !== undefined ? { entryLabel: args.entryLabel } : {}),
  };
}

export async function resolveRenderTargets(
  template: string,
  options: RenderOptions,
  outputFormat: OutputFormat,
): Promise<ResolvedTargets> {
  const resolvedTemplate = resolveTemplatePath(template);
  const projectRoot = findProjectRoot(dirname(resolvedTemplate));
  const cascadingConfig = await loadCascadingConfig(resolvedTemplate, projectRoot);
  const templateData = await parseTemplate(resolvedTemplate, { cascadingConfig });
  // medium + animated come from the parsed config, not the filename.
  const medium = templateData.medium;
  const animated = templateData.animated;

  if (options.preset && options.presets) {
    throw new ValidationError({
      field: "--preset / --presets",
      expectedType: "exactly one flag",
      receivedValue: "both",
      suggestion: "Pass `--preset <name>` to render a single preset, or `--presets` to render all defined outputs.",
    });
  }

  const stillDefaults = !animated ? { fps: 1, duration: 1 } : undefined;
  const resolvedConfig = resolveRenderConfig({
    cli: {
      ...(options.width !== undefined ? { width: options.width } : {}),
      ...(options.height !== undefined ? { height: options.height } : {}),
      ...(options.fps !== undefined ? { fps: options.fps } : {}),
    },
    ...(templateData.templateConfig !== undefined
      ? { templateConfig: templateData.templateConfig }
      : {}),
    cascadingConfig,
    ...(stillDefaults
      ? { defaults: { ...{ width: 1920, height: 1080, fps: 1, duration: 1 }, ...stillDefaults } }
      : {}),
  });

  // Build the list of preset specs (one per target dimension/preset).
  // For default (no --presets/--preset), a single "default" spec with no name suffix.
  type PresetSpec = {
    /** Render target name (preset name, or "default"). */
    name: string;
    width: number;
    height: number;
    fps: number;
    format?: OutputFormat;
    outFile?: string;
    outDir?: string;
    /** Whether this is the no-preset default. Skips the preset suffix in filenames. */
    isDefault: boolean;
  };
  const outputs = templateData.templateConfig?.outputs;
  let presetSpecs: PresetSpec[];

  if (options.presets) {
    if (!outputs || Object.keys(outputs).length === 0) {
      throw new ValidationError({
        field: "--presets",
        expectedType: "config.outputs defined in the template",
        receivedValue: undefined,
        suggestion: "Define `outputs: { mobile: { width: 720, height: 1280 } }` in the template's config.",
      });
    }
    presetSpecs = resolveAllPresets(outputs, resolvedConfig).map((p) => ({
      name: p.name,
      width: p.width,
      height: p.height,
      fps: p.fps,
      format: p.format as OutputFormat,
      isDefault: false,
      ...(p.outFile !== undefined ? { outFile: p.outFile } : {}),
      ...(p.outDir !== undefined ? { outDir: p.outDir } : {}),
    }));
  } else if (options.preset) {
    if (!outputs || Object.keys(outputs).length === 0) {
      throw new ValidationError({
        field: "--preset",
        expectedType: "config.outputs defined in the template",
        receivedValue: options.preset,
        suggestion: "Define `outputs: { yourPreset: { width: 720, height: 1280 } }` in the template's config.",
      });
    }
    const preset = resolvePresetConfig(options.preset, outputs, resolvedConfig);
    presetSpecs = [{
      name: preset.name,
      width: preset.width,
      height: preset.height,
      fps: preset.fps,
      format: preset.format as OutputFormat,
      isDefault: false,
      ...(preset.outFile !== undefined ? { outFile: preset.outFile } : {}),
      ...(preset.outDir !== undefined ? { outDir: preset.outDir } : {}),
    }];
  } else {
    // Default sink: animated → mp4; static svg → svg markup; static html → png.
    const defaultFormat: OutputFormat = animated
      ? undefined
      : medium === "svg"
        ? "svg"
        : "png";
    presetSpecs = [{
      name: "default",
      width: resolvedConfig.width,
      height: resolvedConfig.height,
      fps: resolvedConfig.fps,
      format: outputFormat ?? defaultFormat,
      isDefault: true,
    }];
  }

  // Build the list of entry specs from --data (or a single empty entry when --data is absent).
  type EntrySpec = {
    /** Per-entry data override. `undefined` means no override (template data defaults apply). */
    data?: Record<string, unknown>;
    /** Filename suffix; empty for non-batch single renders. */
    slug: string;
  };
  let entrySpecs: EntrySpec[];

  if (options.batchEntries) {
    entrySpecs = options.batchEntries.map((e) => ({
      slug: e.slug,
      data: e.data as Record<string, unknown>,
    }));
  } else if (options.data) {
    const parsed = await loadDataInput(options.data, dirname(resolvedTemplate));
    const isBatch = Array.isArray(parsed);
    const entries = isBatch ? (parsed as unknown[]) : [parsed];
    entrySpecs = entries.map((entry, index) => {
      if (entry === null || typeof entry !== "object" || Array.isArray(entry)) {
        throw new ValidationError({
          field: "--data",
          expectedType: "object or array of objects",
          receivedValue: Array.isArray(entry) ? "nested array" : typeof entry,
          suggestion: "Each entry must be a plain object whose fields merge into the template's `data`.",
        });
      }
      return {
        data: entry as Record<string, unknown>,
        slug: isBatch ? deriveEntrySlug(entry, index, entries.length) : "",
      };
    });
  } else {
    entrySpecs = [{ slug: "" }];
  }

  // Multi-target output coercion: a single `-o <path>` is destructive when
  // we're producing N files (presets, batch, or both) — every render would
  // clobber the same path. If the user passed a path without a trailing `/`
  // and it's not already a file, treat it as a directory.
  const targetCount = entrySpecs.length * presetSpecs.length;
  let coercedOutput = options.output;
  if (coercedOutput && targetCount > 1 && !coercedOutput.endsWith("/")) {
    if (existsSync(coercedOutput) && statSync(coercedOutput).isFile()) {
      throw new ValidationError({
        field: "-o / --output",
        expectedType: "directory (multi-target run)",
        receivedValue: coercedOutput,
        suggestion: `This run produces ${targetCount} files. Pass a directory path (e.g. \`${coercedOutput}/\`) or a different parent dir.`,
      });
    }
    coercedOutput = coercedOutput + "/";
  }

  const frameOverride = options.frame !== undefined ? parseInt(options.frame, 10) : undefined;
  if (options.frame !== undefined && (frameOverride === undefined || Number.isNaN(frameOverride) || frameOverride < 0)) {
    throw new ValidationError({
      field: "--frame",
      expectedType: "non-negative integer",
      receivedValue: options.frame,
      suggestion: "Pass a frame index such as `--frame 45`.",
    });
  }

  // Cross-product: targets = entries × presets.
  const targets: RenderTarget[] = [];
  for (const entry of entrySpecs) {
    for (const preset of presetSpecs) {
      const effectiveFormat = preset.format ?? outputFormat;
      const outputPath = resolveOutputPath({
        ...(coercedOutput !== undefined ? { outputArg: coercedOutput } : {}),
        templatePath: resolvedTemplate,
        cascadingConfig,
        ...(preset.isDefault ? {} : { presetSuffix: preset.name }),
        ...(preset.outFile !== undefined ? { presetOutFile: preset.outFile } : {}),
        ...(preset.outDir !== undefined ? { presetOutDir: preset.outDir } : {}),
        ...(entry.slug ? { entrySuffix: entry.slug } : {}),
        ...(effectiveFormat !== undefined ? { format: effectiveFormat } : {}),
      });
      targets.push(buildRenderTarget({
        name: preset.name,
        width: preset.width,
        height: preset.height,
        fps: preset.fps,
        ...(!animated ? { duration: 1 } : {}),
        outputPath,
        format: effectiveFormat,
        ...(entry.data !== undefined ? { data: entry.data } : {}),
        ...(entry.slug ? { entryLabel: entry.slug } : {}),
        ...(frameOverride !== undefined ? { frame: frameOverride } : {}),
      }));
    }
  }

  return {
    resolvedTemplate,
    templateData,
    resolvedConfig,
    cascadingConfig,
    targets,
    medium,
    animated,
  };
}
