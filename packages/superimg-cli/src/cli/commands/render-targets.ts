//! Pure target resolution for the render command.
//!
//! Given a template path and CLI options, resolves the template, parses it,
//! validates --preset/--presets combinations, and builds the list of render
//! targets (one per output preset, or one for the default config).
//!
//! Throws on failure — never calls process.exit. The CLI surface in render.tsx
//! catches throws at one centralized boundary.

import { dirname } from "node:path";
import type { EncodingOptions } from "@superimg/types";
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
}

export interface RenderTarget {
  name: string;
  width: number;
  height: number;
  fps: number;
  outputPath: string;
  outputName: string;
  debugHtmlDir: string;
}

export interface ResolvedTargets {
  resolvedTemplate: string;
  templateData: Awaited<ReturnType<typeof parseTemplate>>;
  resolvedConfig: ReturnType<typeof resolveRenderConfig>;
  cascadingConfig: Awaited<ReturnType<typeof loadCascadingConfig>>;
  targets: RenderTarget[];
}

export type OutputFormat = "mp4" | "webm" | "gif" | undefined;

export function resolveFormat(opts: RenderOptions): OutputFormat {
  if (opts.format) {
    const f = opts.format.toLowerCase();
    if (f === "mp4" || f === "webm" || f === "gif") return f;
    console.warn(`Warning: Unknown format "${opts.format}". Valid: mp4, webm, gif. Using default.`);
    return undefined;
  }
  if (opts.output?.endsWith(".webm")) return "webm";
  if (opts.output?.endsWith(".gif")) return "gif";
  return undefined;
}

export function buildEncodingOptions(opts: RenderOptions): EncodingOptions | undefined {
  const format = resolveFormat(opts);
  const hasEncoding =
    format ||
    opts.quality ||
    opts.videoCodec ||
    opts.videoBitrate ||
    opts.audioCodec ||
    opts.audioBitrate ||
    opts.keyframeInterval ||
    opts.bitrateMode ||
    opts.latencyMode ||
    opts.hardwareAccel ||
    opts.audioBitrateMode ||
    opts.fastStart ||
    opts.clusterDuration ||
    opts.maxColors ||
    opts.gifLoop ||
    opts.gifDither;

  if (!hasEncoding) return undefined;

  const encoding: EncodingOptions = {};
  if (format) encoding.format = format;
  const validVideoCodecs = ["avc", "vp9", "av1"];
  const validAudioCodecs = ["aac", "opus"];
  const validQuality = ["very-low", "low", "medium", "high", "very-high"];
  const validBitrateModes = ["constant", "variable"];
  const validLatencyModes = ["quality", "realtime"];
  const validHwAccel = ["no-preference", "prefer-hardware", "prefer-software"];
  const validFastStart = ["false", "in-memory", "fragmented"];

  if (opts.quality || opts.videoCodec || opts.videoBitrate || opts.keyframeInterval || opts.bitrateMode || opts.latencyMode || opts.hardwareAccel) {
    encoding.video = {};
    if (opts.videoCodec) {
      const codec = opts.videoCodec.toLowerCase();
      if (validVideoCodecs.includes(codec)) {
        encoding.video.codec = codec as "avc" | "vp9" | "av1";
      } else {
        console.warn(`Warning: Unknown video codec "${opts.videoCodec}". Valid: ${validVideoCodecs.join(", ")}. Using default.`);
      }
    }
    if (opts.videoBitrate) {
      const bps = parseInt(opts.videoBitrate, 10);
      if (!isNaN(bps)) encoding.video.bitrate = bps;
    } else if (opts.quality) {
      if (validQuality.includes(opts.quality)) {
        encoding.video.bitrate = opts.quality as "very-low" | "low" | "medium" | "high" | "very-high";
      } else {
        console.warn(`Warning: Unknown quality "${opts.quality}". Valid: ${validQuality.join(", ")}. Using default.`);
      }
    }
    if (opts.keyframeInterval) {
      const sec = parseFloat(opts.keyframeInterval);
      if (!isNaN(sec)) encoding.video.keyFrameInterval = sec;
    }
    if (opts.bitrateMode) {
      const mode = opts.bitrateMode.toLowerCase();
      if (validBitrateModes.includes(mode)) {
        encoding.video.bitrateMode = mode as "constant" | "variable";
      } else {
        console.warn(`Warning: Unknown bitrate mode "${opts.bitrateMode}". Valid: ${validBitrateModes.join(", ")}. Using default.`);
      }
    }
    if (opts.latencyMode) {
      const mode = opts.latencyMode.toLowerCase();
      if (validLatencyModes.includes(mode)) {
        encoding.video.latencyMode = mode as "quality" | "realtime";
      } else {
        console.warn(`Warning: Unknown latency mode "${opts.latencyMode}". Valid: ${validLatencyModes.join(", ")}. Using default.`);
      }
    }
    if (opts.hardwareAccel) {
      const hint = opts.hardwareAccel.toLowerCase();
      if (validHwAccel.includes(hint)) {
        encoding.video.hardwareAcceleration = hint as "no-preference" | "prefer-hardware" | "prefer-software";
      } else {
        console.warn(`Warning: Unknown hardware acceleration "${opts.hardwareAccel}". Valid: ${validHwAccel.join(", ")}. Using default.`);
      }
    }
  }

  if (opts.audioCodec || opts.audioBitrate || opts.audioBitrateMode) {
    encoding.audio = {};
    if (opts.audioCodec) {
      const codec = opts.audioCodec.toLowerCase();
      if (validAudioCodecs.includes(codec)) {
        encoding.audio.codec = codec as "aac" | "opus";
      } else {
        console.warn(`Warning: Unknown audio codec "${opts.audioCodec}". Valid: ${validAudioCodecs.join(", ")}. Using default.`);
      }
    }
    if (opts.audioBitrate) {
      const bps = parseInt(opts.audioBitrate, 10);
      if (!isNaN(bps)) encoding.audio.bitrate = bps;
    }
    if (opts.audioBitrateMode) {
      const mode = opts.audioBitrateMode.toLowerCase();
      if (validBitrateModes.includes(mode)) {
        encoding.audio.bitrateMode = mode as "constant" | "variable";
      } else {
        console.warn(`Warning: Unknown audio bitrate mode "${opts.audioBitrateMode}". Valid: ${validBitrateModes.join(", ")}. Using default.`);
      }
    }
  }

  if (opts.fastStart) {
    const mode = opts.fastStart.toLowerCase();
    if (validFastStart.includes(mode)) {
      encoding.mp4 = {
        fastStart: mode === "false" ? false : mode as "in-memory" | "fragmented",
      };
    } else {
      console.warn(`Warning: Unknown fast start mode "${opts.fastStart}". Valid: ${validFastStart.join(", ")}. Using default.`);
    }
  }

  if (opts.clusterDuration) {
    const sec = parseFloat(opts.clusterDuration);
    if (!isNaN(sec)) {
      encoding.webm = { minimumClusterDuration: sec };
    }
  }

  if (opts.maxColors || opts.gifLoop || opts.gifDither) {
    encoding.gif = {};
    if (opts.maxColors) {
      const n = parseInt(opts.maxColors, 10);
      if (!isNaN(n) && n >= 2 && n <= 256) encoding.gif.maxColors = n;
      else console.warn(`Warning: --max-colors must be 2-256. Using default (256).`);
    }
    if (opts.gifLoop) {
      const n = parseInt(opts.gifLoop, 10);
      if (!isNaN(n)) encoding.gif.loop = n;
    }
    if (opts.gifDither) {
      encoding.gif.dither = opts.gifDither;
    }
  }

  // Apply WebM smart defaults when no explicit video options were set
  if (format === "webm") {
    if (!encoding.video) encoding.video = {};
    if (!encoding.video.codec) encoding.video.codec = ["vp9", "av1"];
  }

  return encoding;
}

export function buildRenderTarget(args: {
  name: string;
  width: number;
  height: number;
  fps: number;
  outputPath: string;
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
  };
}

/**
 * Resolve a template + CLI options into the concrete render targets.
 * Throws on parse / validation failure. Callers handle exit codes.
 */
export async function resolveRenderTargets(
  template: string,
  options: RenderOptions,
  outputFormat: OutputFormat,
): Promise<ResolvedTargets> {
  const resolvedTemplate = resolveTemplatePath(template);
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

  const resolvedConfig = resolveRenderConfig({
    cli: {
      width: options.width,
      height: options.height,
      fps: options.fps,
    },
    templateConfig: templateData.templateConfig,
    cascadingConfig,
  });

  const outputs = templateData.templateConfig?.outputs;
  let targets: RenderTarget[];

  if (options.presets) {
    if (!outputs || Object.keys(outputs).length === 0) {
      throw new ValidationError({
        field: "--presets",
        expectedType: "config.outputs defined in the template",
        receivedValue: undefined,
        suggestion: "Define `outputs: { mobile: { width: 720, height: 1280 } }` in the template's config.",
      });
    }
    const presets = resolveAllPresets(outputs, resolvedConfig);
    targets = presets.map((p) => {
      const outputPath = resolveOutputPath({
        outputArg: options.output,
        templatePath: resolvedTemplate,
        cascadingConfig,
        presetSuffix: p.name,
        presetOutFile: p.outFile,
        presetOutDir: p.outDir,
        format: outputFormat,
      });
      return buildRenderTarget({
        name: p.name,
        width: p.width,
        height: p.height,
        fps: p.fps,
        outputPath,
      });
    });
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
    const outputPath = resolveOutputPath({
      outputArg: options.output,
      templatePath: resolvedTemplate,
      cascadingConfig,
      presetSuffix: preset.name,
      presetOutFile: preset.outFile,
      presetOutDir: preset.outDir,
      format: outputFormat,
    });
    targets = [buildRenderTarget({
      name: preset.name,
      width: preset.width,
      height: preset.height,
      fps: preset.fps,
      outputPath,
    })];
  } else {
    const outputPath = resolveOutputPath({
      outputArg: options.output,
      templatePath: resolvedTemplate,
      cascadingConfig,
      format: outputFormat,
    });
    targets = [buildRenderTarget({
      name: "default",
      width: resolvedConfig.width,
      height: resolvedConfig.height,
      fps: resolvedConfig.fps,
      outputPath,
    })];
  }

  return {
    resolvedTemplate,
    templateData,
    resolvedConfig,
    cascadingConfig,
    targets,
  };
}
