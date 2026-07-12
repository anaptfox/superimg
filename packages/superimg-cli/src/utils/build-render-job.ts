import type {
  Duration,
  EncodingOptions,
  ResolvedAssetDeclaration,
  TemplateBundle,
} from "@superimg/types";
import {
  resolveRenderConfig,
  type ParsedTemplate,
} from "../cli/utils/template-config.js";
import { prepareAssets, resolveAudioUrl } from "./prepare-assets.js";

export interface BuildRenderJobOverrides {
  width?: number;
  height?: number;
  fps?: number;
  duration?: Duration;
  data?: Record<string, unknown>;
  encoding?: EncodingOptions;
  /** Per-target output name (preset name). Defaults to "default". */
  outputName?: string;
}

export interface BuildRenderJobInput {
  parsed: ParsedTemplate;
  templateBundle: TemplateBundle;
  templateDir: string;
  assetBaseUrl: string;
  /**
   * Pre-discovered assets from the template's `assets/` folder. Callers that
   * render repeatedly (e.g. `loadTemplate`) should discover once and reuse.
   */
  autoDiscovered: ResolvedAssetDeclaration[];
  overrides?: BuildRenderJobOverrides;
}

function positiveNumberOrUndefined(value: number | undefined): number | undefined {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
    return undefined;
  }
  return value;
}

/**
 * Build the render job object shared by `loadTemplate` and `renderVideo`.
 * Returns the job and the resolved assets passed to `createRenderPlan`.
 */
export function buildRenderJob(input: BuildRenderJobInput) {
  const overrides = input.overrides ?? {};

  const resolvedConfig = resolveRenderConfig({
    cli: {
      ...(overrides.width != null ? { width: String(overrides.width) } : {}),
      ...(overrides.height != null ? { height: String(overrides.height) } : {}),
      ...(overrides.fps != null ? { fps: String(overrides.fps) } : {}),
      ...(overrides.duration != null ? { duration: String(overrides.duration) } : {}),
    },
    ...(input.parsed.templateConfig !== undefined
      ? { templateConfig: input.parsed.templateConfig }
      : {}),
  });

  const resolvedAssets = prepareAssets({
    autoDiscovered: input.autoDiscovered,
    configAssets: input.parsed.resolvedAssets,
    assetBaseUrl: input.assetBaseUrl,
  });

  const resolvedAudio = resolveAudioUrl(
    input.parsed.templateConfig?.audio,
    input.templateDir,
    input.assetBaseUrl
  );

  // Guard overrides: non-positive values fall back to resolvedConfig. This matches
  // resolveRenderConfig's precedence rules and preserves renderVideo's prior
  // behavior where duration/width/height/fps === 0 fell through to defaults.
  const widthOverride = positiveNumberOrUndefined(overrides.width);
  const heightOverride = positiveNumberOrUndefined(overrides.height);
  const fpsOverride = positiveNumberOrUndefined(overrides.fps);
  const durationOverride =
    typeof overrides.duration === "number"
      ? positiveNumberOrUndefined(overrides.duration)
      : overrides.duration;

  const job = {
    templateBundle: input.templateBundle,
    duration: durationOverride ?? resolvedConfig.duration,
    width: widthOverride ?? resolvedConfig.width,
    height: heightOverride ?? resolvedConfig.height,
    fps: fpsOverride ?? resolvedConfig.fps,
    outputName: overrides.outputName ?? "default",
    ...(input.parsed.templateConfig?.fonts !== undefined
      ? { fonts: input.parsed.templateConfig.fonts }
      : {}),
    ...(input.parsed.templateConfig?.inlineCss !== undefined
      ? { inlineCss: input.parsed.templateConfig.inlineCss }
      : {}),
    ...(input.parsed.templateConfig?.stylesheets !== undefined
      ? { stylesheets: input.parsed.templateConfig.stylesheets }
      : {}),
    ...(overrides.encoding !== undefined ? { encoding: overrides.encoding } : {}),
    ...(overrides.data !== undefined ? { data: overrides.data } : {}),
    ...(input.parsed.templateConfig?.tailwind !== undefined
      ? { tailwind: input.parsed.templateConfig.tailwind }
      : {}),
    ...(input.parsed.templateConfig?.watermark !== undefined
      ? { watermark: input.parsed.templateConfig.watermark }
      : {}),
    ...(input.parsed.templateConfig?.background !== undefined
      ? { background: input.parsed.templateConfig.background }
      : {}),
    ...(resolvedAudio !== undefined ? { audio: resolvedAudio } : {}),
  };

  // Only keys the caller passed in overrides (CLI/API) — soft defaults stay on job only.
  const explicitOverrides: {
    width?: number;
    height?: number;
    fps?: number;
    duration?: Duration;
  } = {
    ...(widthOverride !== undefined && overrides.width != null
      ? { width: widthOverride }
      : {}),
    ...(heightOverride !== undefined && overrides.height != null
      ? { height: heightOverride }
      : {}),
    ...(fpsOverride !== undefined && overrides.fps != null ? { fps: fpsOverride } : {}),
    ...(durationOverride !== undefined && overrides.duration != null
      ? { duration: durationOverride }
      : {}),
  };

  return {
    job,
    resolvedAssets,
    ...(Object.keys(explicitOverrides).length > 0
      ? { explicitOverrides }
      : {}),
  };
}
