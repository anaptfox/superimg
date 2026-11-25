//! Loop seam comparison for temporal: "loop" templates (semantic + optional visual).

import {
  createRenderContext,
  lowerRenderOutput,
  type RenderTemplateFrameOptions,
} from "@superimg/core";

export interface LoopSeamIssue {
  severity: "error" | "warning";
  code: string;
  message: string;
  suggestion?: string;
  progress?: number;
}

function sortedEqual(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  const sa = [...a].sort();
  const sb = [...b].sort();
  return sa.every((v, i) => v === sb[i]);
}

export interface SeamSample {
  progress: number;
  text: string[];
  colors: string[];
  htmlBytes: number;
  /** Optional full HTML for structural fingerprint. */
  html?: string;
  error?: { message: string };
}

/**
 * The cycle closes at virtual frame N, after the N encoded frames 0…N−1.
 * renderTemplateFrame deliberately clamps encoded frame selectors, so this
 * diagnostic builds the existing authored context directly. It is never encoded.
 */
export function renderLoopBoundary(
  options: RenderTemplateFrameOptions & {
    fps: number;
    totalFrames: number;
    width: number;
    height: number;
  },
): { html: string; frame: number; progress: number; timelineSeconds: number } {
  const { template, fps, totalFrames, width, height } = options;
  if ("composition" in template && template.composition) {
    // time() clamps its occurrence clock; calling it at N would simply inspect
    // the last encoded frame again, not establish the authored closure.
    throw new Error("Retained compositions do not expose a virtual cycle boundary");
  }
  if (!Number.isSafeInteger(totalFrames) || totalFrames < 1 || !Number.isFinite(fps) || fps <= 0) {
    throw new Error("Loop boundary requires a positive integer frame count and finite fps");
  }
  const ctx = createRenderContext(
    totalFrames, fps, totalFrames, width, height,
    { ...(template.sample ?? {}), ...(options.data ?? {}) },
    options.assets ?? {}, options.assetResolver, template.config?.width,
    undefined, undefined, options.preparedStdlib,
  );
  const html = lowerRenderOutput(template.render(ctx), template.medium, {
    width, height,
    ...(options.measurer !== undefined ? { measurer: options.measurer } : {}),
  });
  return { html, frame: ctx.timeline.frame, progress: ctx.timeline.progress, timelineSeconds: ctx.timeline.seconds };
}

/** Collapse whitespace / strip volatile noise for structural compare. */
export function htmlStructuralFingerprint(html: string): string {
  return html
    .replace(/\s+/g, " ")
    .replace(/scale\([^)]+\)/gi, "scale(*)")
    .replace(/\d+\.\d{3,}/g, (n) => Number(n).toFixed(2))
    .trim();
}

export function pickSeamEndpoints(samples: SeamSample[]): {
  start: SeamSample | null;
  end: SeamSample | null;
} {
  const ok = samples.filter((s) => !s.error);
  const start = ok.reduce<SeamSample | null>((best, s) => {
    if (best === null || Math.abs(s.progress - 0) < Math.abs(best.progress - 0)) return s;
    return best;
  }, null);
  const end = ok.reduce<SeamSample | null>((best, s) => {
    if (best === null || Math.abs(s.progress - 1) < Math.abs(best.progress - 1)) return s;
    return best;
  }, null);
  return { start, end };
}

/**
 * Compare authored cycle-boundary samples at progress 0 and 1. The end
 * must be virtual frame N, not the last encoded frame N−1.
 * Text/colors exact set equality; optional HTML structural fingerprint.
 */
export function checkLoopSeam(samples: SeamSample[]): LoopSeamIssue[] {
  const issues: LoopSeamIssue[] = [];
  const { start, end } = pickSeamEndpoints(samples);

  if (!start || !end || start.progress !== 0 || end.progress !== 1) {
    issues.push({
      severity: "error",
      code: "LOOP_SEAM_BROKEN",
      message: 'temporal: "loop" requires the start and virtual cycle boundary to verify closure',
      suggestion: "Run check without --summary so the start and virtual frame N are sampled",
    });
    return issues;
  }

  const textOk = sortedEqual(start.text, end.text);
  const colorsOk = sortedEqual(start.colors, end.colors);
  let htmlOk = true;
  if (start.html !== undefined && end.html !== undefined) {
    htmlOk =
      htmlStructuralFingerprint(start.html) === htmlStructuralFingerprint(end.html);
  }

  if (!textOk || !colorsOk || !htmlOk) {
    const parts: string[] = [];
    if (!textOk) parts.push("text tokens");
    if (!colorsOk) parts.push("colors");
    if (!htmlOk) parts.push("HTML structure");
    issues.push({
      severity: "error",
      code: "LOOP_SEAM_BROKEN",
      message: `Loop seam mismatch at the virtual cycle boundary (${parts.join(", ")} differ)`,
      suggestion:
        "Design motion to return to the start pose; prefer std.loop/oscillate/pingpong; avoid one-shot enter/exit that does not close",
      progress: 1,
    });
  }

  return issues;
}

/**
 * Mean absolute pixel difference (0–255) between two PNG buffers via sharp.
 * Returns null if images cannot be compared (size mismatch / decode error).
 */
export async function meanPixelDelta(
  pngA: Buffer | Uint8Array,
  pngB: Buffer | Uint8Array,
): Promise<{ mae: number; width: number; height: number } | null> {
  const sharp = (await import("sharp")).default;
  const [imgA, imgB] = await Promise.all([
    sharp(pngA).ensureAlpha().raw().toBuffer({ resolveWithObject: true }),
    sharp(pngB).ensureAlpha().raw().toBuffer({ resolveWithObject: true }),
  ]);
  if (
    imgA.info.width !== imgB.info.width ||
    imgA.info.height !== imgB.info.height ||
    imgA.info.channels !== imgB.info.channels
  ) {
    return null;
  }
  const a = imgA.data;
  const b = imgB.data;
  let sum = 0;
  const n = a.length;
  for (let i = 0; i < n; i++) {
    sum += Math.abs(a[i]! - b[i]!);
  }
  return {
    mae: sum / n,
    width: imgA.info.width,
    height: imgA.info.height,
  };
}

/** Default MAE threshold (0–255). ~2 allows subpixel antialias / float rounding. */
export const DEFAULT_SEAM_VISUAL_MAE = 2.5;

export function checkLoopSeamVisual(
  mae: number | null,
  threshold = DEFAULT_SEAM_VISUAL_MAE,
  neighbors?: { before: number | null; after: number | null },
): LoopSeamIssue[] {
  if (mae === null || !Number.isFinite(mae) || mae < 0 ||
    (neighbors !== undefined && [neighbors.before, neighbors.after].some((value) => value === null || !Number.isFinite(value) || value < 0))) {
    return [
      {
        severity: "error",
        code: "LOOP_SEAM_VISUAL",
        message: "Could not compare seam frames (size mismatch or decode failure)",
        suggestion: "Ensure wrap and neighboring frames share the same canvas size",
      },
    ];
  }
  // A moving periodic scene has a normal last→first frame step. Permit that
  // measured local motion, rather than demanding a duplicated endpoint. This
  // is a bounded local discontinuity heuristic, not a proof of motion quality.
  const adjacent = neighbors === undefined ? 0 : Math.max(neighbors.before!, neighbors.after!);
  const limit = threshold + 1.5 * adjacent;
  if (mae > limit) {
    return [
      {
        severity: "error",
        code: "LOOP_SEAM_VISUAL",
        message: `Visual loop wrap MAE ${mae.toFixed(2)} exceeds local limit ${limit.toFixed(2)} (tolerance ${threshold}, neighboring maximum ${adjacent.toFixed(2)})`,
        suggestion:
          "Inspect the last→first step alongside the preceding and following steps; close any sudden wrap discontinuity",
        progress: 1,
      },
    ];
  }
  return [];
}
