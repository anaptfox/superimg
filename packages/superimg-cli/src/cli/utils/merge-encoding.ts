import type { EncodingOptions } from "@superimg/types";

/**
 * Deep-merge template encoding defaults with overrides.
 * Override values take precedence over base values.
 */
export function mergeEncoding(
  base: EncodingOptions | undefined,
  overrides: EncodingOptions | undefined,
): EncodingOptions | undefined {
  if (!base && !overrides) return undefined;
  if (!base) return overrides;
  if (!overrides) return base;

  return {
    format: overrides.format ?? base.format,
    video: (overrides.video || base.video) ? {
      ...base.video,
      ...overrides.video,
    } : undefined,
    audio: (overrides.audio || base.audio) ? {
      ...base.audio,
      ...overrides.audio,
    } : undefined,
    mp4: (overrides.mp4 || base.mp4) ? {
      ...base.mp4,
      ...overrides.mp4,
    } : undefined,
    webm: (overrides.webm || base.webm) ? {
      ...base.webm,
      ...overrides.webm,
    } : undefined,
  };
}
