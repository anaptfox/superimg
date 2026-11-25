import type {
  AnyTemplateModule,
  Medium,
  TailwindConfig,
  Duration,
  RetainedComposition,
} from "@superimg/types";
import { inferTemplateAnimated, isGoogleFontDeclaration } from "@superimg/types";
import { DEFAULT_FPS, DEFAULT_HEIGHT, DEFAULT_WIDTH } from "../shared/constants.js";
import { parseDuration } from "../shared/utils.js";
import { scopedCompositionData } from "../composition/scoped-data.js";
import { fontBytesDataUrl, fontFaceCss, fontMimeType } from "./font-css.js";

export type RuntimeTemplate = AnyTemplateModule;

export interface ResolveRuntimeTemplateInfoOptions {
  width?: number;
  height?: number;
  fps?: number;
  duration?: Duration;
  data?: Record<string, unknown>;
}

export interface RuntimeTemplateInfo {
  medium: Medium;
  isAnimated: boolean;
  width: number;
  height: number;
  fps: number;
  duration: number;
  totalFrames: number;
  data: Record<string, unknown>;
  fonts: string[];
  /** Portable explicit font faces. Filesystem declarations require host resolution. */
  fontCss: string[];
  inlineCss: string[];
  stylesheets: string[];
  tailwind?: boolean | TailwindConfig;
}

function getMedium(template: RuntimeTemplate): Medium {
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
  // Shared inference — the IR compiles its clock from the same rule, and the
  // Player rejects any load where the two clocks disagree (IR_CLOCK_MISMATCH).
  const animated = inferTemplateAnimated(template);

  const width = options.width ?? config.width ?? DEFAULT_WIDTH;
  const height = options.height ?? config.height ?? DEFAULT_HEIGHT;
  const composition = "composition" in template
    ? template.composition as RetainedComposition | undefined
    : undefined;

  let fps = options.fps ?? ("fps" in config ? config.fps : undefined) ?? DEFAULT_FPS;
  let duration: number;
  let totalFrames: number;

  if (!animated) {
    // Static template (one frame). SVG may declare a duration for CSS animation;
    // HTML stills are fps 1 / duration 1.
    fps = 1;
    duration =
      medium === "svg" && config.duration !== undefined
        ? parseDuration(config.duration, "duration", fps)
        : 1;
    totalFrames = 1;
  } else {
    const configuredDuration =
      options.duration ??
      ("duration" in config ? config.duration : undefined);
    duration = parseDuration(configuredDuration, "duration", fps);
    if (composition) {
      const schedule = composition.schedule;
      if (fps !== schedule.fps || width !== composition.outputSize.width || height !== composition.outputSize.height) {
        throw new TypeError("composition: this timed projection requires its authored size and fps");
      }
      if (options.duration !== undefined && Math.abs(duration * fps - schedule.totalFrames) > 1e-7) {
        throw new TypeError("composition: duration override would change the retained frame schedule");
      }
      scopedCompositionData(options.data, schedule.leaves.map((leaf) => leaf.path));
      totalFrames = schedule.totalFrames;
      duration = totalFrames / fps;
    } else {
      totalFrames = Math.ceil(duration * fps);
    }
  }

  return {
    medium,
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
    fonts: (config.fonts ?? []).flatMap((font) => isGoogleFontDeclaration(font) ? [font.spec.trim()] : []),
    fontCss: (config.fonts ?? []).flatMap((font) => {
      if (isGoogleFontDeclaration(font)) return [];
      if (typeof font.src === "string") {
        const url = font.src.trim();
        // A browser must never reinterpret a filesystem font as a page-relative URL.
        return /^https?:\/\//i.test(url) ? [fontFaceCss(font, url)] : [];
      }
      const bytes = font.src instanceof Uint8Array ? font.src : new Uint8Array(font.src);
      const mimeType = fontMimeType(bytes);
      return [fontFaceCss({ ...font, mimeType }, fontBytesDataUrl(bytes, mimeType))];
    }),
    inlineCss: "inlineCss" in config ? config.inlineCss ?? [] : [],
    stylesheets: "stylesheets" in config ? config.stylesheets ?? [] : [],
    ...("tailwind" in config && config.tailwind !== undefined
      ? { tailwind: config.tailwind }
      : {}),
  };
}
