//! Loop-friendly encoding defaults when config.temporal === "loop".

import type { EncodingOptions, TemporalMode } from "@superimg/types";

/**
 * When the template is a seamless loop, prefer a modest keyframe interval so
 * restarts are clean. Does not set infinite-loop container flags — players own
 * that via playbackMode / temporal.
 */
export function loopFriendlyEncoding(
  temporal: TemporalMode | undefined,
  base: EncodingOptions | undefined,
): EncodingOptions | undefined {
  if (temporal !== "loop") return base;

  return {
    ...base,
    video: {
      ...base?.video,
      // Prefer keyframes at least every ~2s so loop restart is not mid-GOP only
      keyFrameInterval: base?.video?.keyFrameInterval ?? 2,
    },
  };
}
