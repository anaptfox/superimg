import type {
  AnyTemplateModule,
  ComposedTemplate,
  Medium,
  TailwindConfig,
  Duration,
} from "@superimg/types";
import { isComposedTemplate } from "@superimg/types";
import { DEFAULT_FPS, DEFAULT_HEIGHT, DEFAULT_WIDTH } from "../shared/constants.js";
import { parseDuration } from "../shared/utils.js";

export type RuntimeTemplate = AnyTemplateModule | ComposedTemplate;

export interface ResolveRuntimeTemplateInfoOptions {
  width?: number;
  height?: number;
  fps?: number;
  duration?: Duration;
  data?: Record<string, unknown>;
}

export interface RuntimeTemplateInfo {
  medium: Medium;
  isComposed: boolean;
  isAnimated: boolean;
  width: number;
  height: number;
  fps: number;
  duration: number;
  totalFrames: number;
  data: Record<string, unknown>;
  fonts: string[];
  inlineCss: string[];
  stylesheets: string[];
  tailwind?: boolean | TailwindConfig;
}

function getMedium(template: RuntimeTemplate): Medium {
  if (isComposedTemplate(template)) return template.medium;
  return template.medium;
}

function getConfig(template: RuntimeTemplate) {
  return template.config ?? {};
}

export function resolveRuntimeTemplateInfo(
  template: RuntimeTemplate,
  options: ResolveRuntimeTemplateInfoOptions = {}
): RuntimeTemplateInfo {
  const medium = getMedium(template);
  const config = getConfig(template);
  const isComposed = isComposedTemplate(template);
  const animated = isComposed ? true : template.animated;

  const width = options.width ?? config.width ?? DEFAULT_WIDTH;
  const height = options.height ?? config.height ?? DEFAULT_HEIGHT;

  let fps = options.fps ?? ("fps" in config ? config.fps : undefined) ?? DEFAULT_FPS;
  let duration: number;
  let totalFrames: number;

  if (isComposed) {
    fps = options.fps ?? template.fps;
    duration = options.duration
      ? parseDuration(options.duration, "duration", fps)
      : template.duration;
    totalFrames = Math.ceil(duration * fps);
  } else if (!animated) {
    // Static template (one frame). SVG may declare a duration for CSS animation;
    // HTML stills are fps 1 / duration 1.
    fps = 1;
    duration =
      medium === "svg" && typeof config.duration === "number" ? config.duration : 1;
    totalFrames = 1;
  } else {
    const configuredDuration =
      options.duration ??
      ("duration" in config ? config.duration : undefined);
    duration = parseDuration(configuredDuration, "duration", fps);
    totalFrames = Math.ceil(duration * fps);
  }

  return {
    medium,
    isComposed,
    isAnimated: animated,
    width,
    height,
    fps,
    duration,
    totalFrames,
    data: {
      ...("sample" in template ? template.sample ?? {} : {}),
      ...(options.data ?? {}),
    } as Record<string, unknown>,
    fonts: config.fonts ?? [],
    inlineCss: "inlineCss" in config ? config.inlineCss ?? [] : [],
    stylesheets: "stylesheets" in config ? config.stylesheets ?? [] : [],
    ...("tailwind" in config && config.tailwind !== undefined
      ? { tailwind: config.tailwind }
      : {}),
  };
}
