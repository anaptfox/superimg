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
import type { EncodingOptions } from "@superimg/types";
import { ValidationError } from "@superimg/types";
import { resolveTemplatePath } from "../utils/resolve-template.js";
import { findProjectRoot } from "../utils/find-project-root.js";
import { loadCascadingConfig } from "../utils/config-loader.js";
import type { TemplateKind } from "../utils/discover-videos.js";
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
}

export interface ResolvedTargets {
  resolvedTemplate: string;
  templateData: Awaited<ReturnType<typeof parseTemplate>>;
  resolvedConfig: ReturnType<typeof resolveRenderConfig>;
  cascadingConfig: Awaited<ReturnType<typeof loadCascadingConfig>>;
  targets: RenderTarget[];
  kind: TemplateKind;
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
}): RenderTarget {
  return {
    name: args.name,
    width: args.width,
    height: args.height,
    fps: args.fps,
    duration: args.duration,
    outputPath: args.outputPath,
    outputName: args.name,
    debugHtmlDir: resolveDebugHtmlDir({
      outputPath: args.outputPath,
      outputName: args.name,
    }),
    format: args.format,
    data: args.data,
    entryLabel: args.entryLabel,
  };
}

/**
 * Resolve a template + CLI options into the concrete render targets.
 * Throws on parse / validation failure. Callers handle exit codes.
 */
function inferKindFromPath(p: string): TemplateKind {
  if (p.endsWith(".image.ts")) return "image";
  if (p.endsWith(".gif.ts")) return "gif";
  if (p.endsWith(".svg.ts")) return "svg";
  return "video";
}

export async function resolveRenderTargets(
  template: string,
  options: RenderOptions,
  outputFormat: OutputFormat,
): Promise<ResolvedTargets> {
  const resolvedTemplate = resolveTemplatePath(template);
  const kind = inferKindFromPath(resolvedTemplate);
  const projectRoot = findProjectRoot(dirname(resolvedTemplate));
  const cascadingConfig = await loadCascadingConfig(resolvedTemplate, projectRoot);
  const templateData = await parseTemplate(resolvedTemplate, { cascadingConfig });

  if (options.preset && options.presets) {
    throw new ValidationError({
      field: "--preset / --presets",
      expectedType: "exactly one flag",
      receivedValue: "both",
      suggestion: "Pass `--preset <name>` to render a single preset, or `--presets` to render all defined outputs.",
    });
  }

  const stillDefaults = (kind === "image" || kind === "svg") ? { fps: 1, duration: 1 } : undefined;
  const resolvedConfig = resolveRenderConfig({
    cli: {
      width: options.width,
      height: options.height,
      fps: options.fps,
    },
    templateConfig: templateData.templateConfig,
    cascadingConfig,
    defaults: stillDefaults
      ? { ...{ width: 1920, height: 1080, fps: 1, duration: 1 }, ...stillDefaults }
      : undefined,
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
      outFile: p.outFile,
      outDir: p.outDir,
      isDefault: false,
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
      outFile: preset.outFile,
      outDir: preset.outDir,
      isDefault: false,
    }];
  } else {
    const defaultFormat: OutputFormat = kind === "image" ? "png" : kind === "gif" ? "gif" : kind === "svg" ? "svg" : undefined;
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
    /** Per-entry data override. `undefined` means "use companion data / no override". */
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

  // Cross-product: targets = entries × presets.
  const targets: RenderTarget[] = [];
  for (const entry of entrySpecs) {
    for (const preset of presetSpecs) {
      const effectiveFormat = preset.format ?? outputFormat;
      const outputPath = resolveOutputPath({
        outputArg: coercedOutput,
        templatePath: resolvedTemplate,
        cascadingConfig,
        presetSuffix: preset.isDefault ? undefined : preset.name,
        presetOutFile: preset.outFile,
        presetOutDir: preset.outDir,
        entrySuffix: entry.slug || undefined,
        format: effectiveFormat,
      });
      targets.push(buildRenderTarget({
        name: preset.name,
        width: preset.width,
        height: preset.height,
        fps: preset.fps,
        duration: (kind === "image" || kind === "svg") ? 1 : undefined,
        outputPath,
        format: effectiveFormat,
        data: entry.data,
        entryLabel: entry.slug || undefined,
      }));
    }
  }

  return {
    resolvedTemplate,
    templateData,
    resolvedConfig,
    cascadingConfig,
    targets,
    kind,
  };
}
