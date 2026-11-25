import type { EncodingOptions } from "@superimg/types";

/**
 * Deep-merge template encoding defaults with overrides.
 * Override values take precedence over base values.
 * Nested objects: video, audio, mp4, webm, gif, capture, still.
 */
export function mergeEncoding(
  base: EncodingOptions | undefined,
  overrides: EncodingOptions | undefined,
): EncodingOptions | undefined {
  if (!base && !overrides) return undefined;
  if (!base) return overrides;
  if (!overrides) return base;

  const format = overrides.format ?? base.format;
  const video = (overrides.video || base.video)
    ? { ...base.video, ...overrides.video }
    : undefined;
  const audio = (overrides.audio || base.audio)
    ? { ...base.audio, ...overrides.audio }
    : undefined;
  const mp4 = (overrides.mp4 || base.mp4)
    ? { ...base.mp4, ...overrides.mp4 }
    : undefined;
  const webm = (overrides.webm || base.webm)
    ? { ...base.webm, ...overrides.webm }
    : undefined;
  const gif = (overrides.gif || base.gif)
    ? { ...base.gif, ...overrides.gif }
    : undefined;
  const capture = (overrides.capture || base.capture)
    ? { ...base.capture, ...overrides.capture }
    : undefined;
  const still = (overrides.still || base.still)
    ? { ...base.still, ...overrides.still }
    : undefined;

  return {
    ...(format !== undefined ? { format } : {}),
    ...(video !== undefined ? { video } : {}),
    ...(audio !== undefined ? { audio } : {}),
    ...(mp4 !== undefined ? { mp4 } : {}),
    ...(webm !== undefined ? { webm } : {}),
    ...(gif !== undefined ? { gif } : {}),
    ...(capture !== undefined ? { capture } : {}),
    ...(still !== undefined ? { still } : {}),
  };
}
