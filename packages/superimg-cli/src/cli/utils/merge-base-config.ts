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
  const restore = <K extends keyof BaseConfig>(key: K) => {
    if (layer[key] === undefined) {
      if (base[key] !== undefined) {
        merged[key] = base[key] as T[K];
      } else {
        delete merged[key];
      }
    }
  };
  restore("width");
  restore("height");
  restore("fps");
  restore("duration");
  restore("outputs");
  restore("tailwind");
  restore("watermark");
  restore("background");
  restore("audio");

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
