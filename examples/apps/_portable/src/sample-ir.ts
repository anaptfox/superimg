import { createMediaIR, type MediaIR } from "@superimg/types";

/** Shared experimental Media IR for framework examples. */
export function makeSampleMediaIR(
  sourceId: string,
  width = 960,
  height = 540,
): MediaIR {
  return createMediaIR({ sourceId, width, height });
}
