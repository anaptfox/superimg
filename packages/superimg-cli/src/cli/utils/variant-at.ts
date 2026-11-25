//! Resolve TemplateVariant `at` freeze points to a frame index.

/**
 * Parse variant `at` into a frame index for still capture from an animated template.
 * - number in [0, 1] → progress
 * - number > 1 → frame index
 * - "35%" → progress
 * - "frame:12" → frame 12
 */
export function resolveVariantFrame(
  at: number | `${number}%` | `frame:${number}` | undefined,
  fps: number,
  durationSeconds: number,
): number | undefined {
  if (at === undefined) return undefined;
  const totalFrames = Math.max(1, Math.ceil(durationSeconds * fps));

  if (typeof at === "string") {
    if (at.endsWith("%")) {
      const pct = parseFloat(at.slice(0, -1));
      if (!Number.isFinite(pct)) return undefined;
      const progress = Math.min(1, Math.max(0, pct / 100));
      return totalFrames <= 1 ? 0 : Math.round(progress * (totalFrames - 1));
    }
    if (/^frame:\d+$/i.test(at)) {
      const frame = parseInt(at.slice(6), 10);
      return Number.isFinite(frame) ? Math.max(0, Math.min(totalFrames - 1, frame)) : undefined;
    }
    return undefined;
  }

  if (at >= 0 && at <= 1) {
    return totalFrames <= 1 ? 0 : Math.round(at * (totalFrames - 1));
  }
  if (Number.isFinite(at) && at > 1) {
    return Math.max(0, Math.min(totalFrames - 1, Math.floor(at)));
  }
  return undefined;
}
