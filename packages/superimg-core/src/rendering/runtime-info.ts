import type {
  AnyTemplateModule,
  ComposedTemplate,
  TemplateKind,
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
  kind: TemplateKind;
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

function getKind(template: RuntimeTemplate): TemplateKind {
  return isComposedTemplate(template) ? "video" : template.kind;
}

function getConfig(template: RuntimeTemplate) {
  return template.config ?? {};
}

export function resolveRuntimeTemplateInfo(
  template: RuntimeTemplate,
  options: ResolveRuntimeTemplateInfoOptions = {}
): RuntimeTemplateInfo {
  const kind = getKind(template);
  const config = getConfig(template);
  const isComposed = isComposedTemplate(template);

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
  } else if (kind === "image") {
    fps = 1;
    duration = 1;
    totalFrames = 1;
  } else if (kind === "svg") {
    fps = 1;
    duration = "duration" in config && typeof config.duration === "number" ? config.duration : 1;
    totalFrames = 1;
  } else {
    const configuredDuration =
      options.duration ??
      ("duration" in config ? config.duration : undefined);
    duration = parseDuration(configuredDuration, "duration", fps);
    totalFrames = Math.ceil(duration * fps);
  }

  return {
    kind,
    isComposed,
    isAnimated: kind === "video" || kind === "gif",
    width,
    height,
    fps,
    duration,
    totalFrames,
    data: {
      ...("data" in template ? template.data ?? {} : {}),
      ...(options.data ?? {}),
    } as Record<string, unknown>,
    fonts: config.fonts ?? [],
    inlineCss: "inlineCss" in config ? config.inlineCss ?? [] : [],
    stylesheets: "stylesheets" in config ? config.stylesheets ?? [] : [],
    tailwind: "tailwind" in config ? config.tailwind : undefined,
  };
}
