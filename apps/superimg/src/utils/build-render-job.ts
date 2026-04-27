import type {
  Duration,
  EncodingOptions,
  ResolvedAssetDeclaration,
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
}

export interface BuildRenderJobInput {
  parsed: ParsedTemplate;
  bundledCode: string;
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
      width: overrides.width != null ? String(overrides.width) : undefined,
      height: overrides.height != null ? String(overrides.height) : undefined,
      fps: overrides.fps != null ? String(overrides.fps) : undefined,
      duration: overrides.duration != null ? String(overrides.duration) : undefined,
    },
    templateConfig: input.parsed.templateConfig,
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
    templateCode: input.bundledCode,
    duration: durationOverride ?? resolvedConfig.duration,
    width: widthOverride ?? resolvedConfig.width,
    height: heightOverride ?? resolvedConfig.height,
    fps: fpsOverride ?? resolvedConfig.fps,
    fonts: input.parsed.templateConfig?.fonts,
    inlineCss: input.parsed.templateConfig?.inlineCss,
    stylesheets: input.parsed.templateConfig?.stylesheets,
    outputName: "default",
    encoding: overrides.encoding,
    data: overrides.data,
    tailwind: input.parsed.templateConfig?.tailwind,
    watermark: input.parsed.templateConfig?.watermark,
    background: input.parsed.templateConfig?.background,
    audio: resolvedAudio,
  };

  return { job, resolvedAssets };
}
