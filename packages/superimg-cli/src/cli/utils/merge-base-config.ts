import type { BaseConfig } from "@superimg/types";

/**
 * Merge one config layer into a base.
 *
 * Rules:
 * - Scalar fields (width, height, fps, etc.): layer wins if defined; base otherwise.
 * - Arrays (fonts, inlineCss, stylesheets): concatenate (base first, then layer).
 * - Objects (outputs, tailwind, watermark, background, audio): layer wins if defined
 *   (no deep merge).
 *
 * Subtype extensions (fields on T that aren't part of BaseConfig) ride along via the
 * spread and are preserved from whichever side set them last.
 */
export function mergeBaseConfig<T extends BaseConfig>(base: BaseConfig, layer: T): T {
  const merged: T = { ...base, ...layer };

  // If layer explicitly has `undefined` (vs missing), the spread overwrote the
  // base value. Restore the base value for those cases.
  if (layer.width === undefined) merged.width = base.width;
  if (layer.height === undefined) merged.height = base.height;
  if (layer.fps === undefined) merged.fps = base.fps;
  if (layer.duration === undefined) merged.duration = base.duration;
  if (layer.outputs === undefined) merged.outputs = base.outputs;
  if (layer.tailwind === undefined) merged.tailwind = base.tailwind;
  if (layer.watermark === undefined) merged.watermark = base.watermark;
  if (layer.background === undefined) merged.background = base.background;
  if (layer.audio === undefined) merged.audio = base.audio;

  if (base.fonts?.length || layer.fonts?.length) {
    merged.fonts = [...(base.fonts ?? []), ...(layer.fonts ?? [])];
  }
  if (base.inlineCss?.length || layer.inlineCss?.length) {
    merged.inlineCss = [...(base.inlineCss ?? []), ...(layer.inlineCss ?? [])];
  }
  if (base.stylesheets?.length || layer.stylesheets?.length) {
    merged.stylesheets = [...(base.stylesheets ?? []), ...(layer.stylesheets ?? [])];
  }

  return merged;
}
