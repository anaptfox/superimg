//! The arrangement door: a portable request becomes exportable media.
//!
//! Generic over the pattern registry. A new arrangement reaches every door —
//! CLI, operation, plugin — by being registered in stdlib, with no change
//! here. Admission stays where the invariants live: callers run
//! `checkArrangeRequest` and refuse, rather than shipping a generic card.

import { image, video } from "@superimg/types";
import type { Duration, ImageDefinition, VideoDefinition } from "@superimg/types";
import {
  findArrangePattern,
  renderArrangeRequest,
  type ArrangeRequest,
} from "@superimg/stdlib/arrange";
import type { IntervalMotionPhase } from "@superimg/stdlib/arrange";
import { parseDuration } from "../shared/utils.js";
import { resolveFrameIndex } from "../shared/frame-clock.js";
import { createTimeline } from "../shared/create-timeline.js";

/** Square by default: chat stills are the reason this door exists. */
const DEFAULT_SIZE = Object.freeze({ width: 1080, height: 1080 });
const DEFAULT_DURATION: Duration = "6s";

export interface ArrangeMediaOptions {
  /** Duration for a motion pattern. Static patterns ignore it. */
  readonly duration?: Duration;
  /** Overrides the spec's own size. */
  readonly size?: { readonly width: number; readonly height: number };
}

export class ArrangePatternUnknownError extends Error {
  readonly code = "UNKNOWN_PATTERN" as const;
  constructor(readonly pattern: string) {
    super(`Unknown arrangement pattern '${pattern}'`);
    this.name = "ArrangePatternUnknownError";
  }
}

/**
 * Hold, then ask, then answer. Same thresholds the Cortex event story uses,
 * so a phased arrangement reads identically through either door.
 */
export function arrangePhaseAt(progress: number): IntervalMotionPhase {
  if (progress >= 0.65) return "reveal";
  if (progress >= 0.3) return "predict";
  return "hold";
}

/**
 * Build exportable media for one request. Motion patterns become video so the
 * phases can play; everything else is a still. Rendering does not admit the
 * request — call `checkArrangeRequest` first and refuse on failures.
 */
export function arrangeMedia(
  request: ArrangeRequest,
  options: ArrangeMediaOptions = {},
): ImageDefinition | VideoDefinition {
  const entry = findArrangePattern(request.pattern);
  if (entry === undefined) throw new ArrangePatternUnknownError(request.pattern);
  const size = options.size ?? request.spec.size ?? DEFAULT_SIZE;
  const editions = request.editions;

  // The arrangement shell paints at `spec.size`, so the spec has to carry the
  // stage it is actually being rendered onto. Reading it from the render
  // context — not from the authored size — is what makes one request fill a
  // square chat still and a wide slide alike, instead of painting 1080 of
  // paper onto a 1920 canvas and leaving the rest blank.
  const onStage = (width: number, height: number): ArrangeRequest =>
    ({ ...request, spec: { ...request.spec, size: { width, height } } }) as ArrangeRequest;

  if (!entry.motion) {
    return image({ size, ...(editions === undefined ? {} : { editions }), render: (ctx) => renderArrangeRequest(onStage(ctx.width, ctx.height)) });
  }
  const duration = options.duration ?? DEFAULT_DURATION;
  const fps = 30;
  const seconds = parseDuration(duration, "duration", fps);
  const totalFrames = Math.max(1, Math.ceil(seconds * fps));
  const posterSeconds = entry.posterProgress === undefined ? undefined : seconds * entry.posterProgress;
  const posterFrame = posterSeconds === undefined ? 0 : resolveFrameIndex({ frame: Math.round(posterSeconds * fps), fps, durationSeconds: seconds });
  // A single encoded frame cannot establish a distinct answer reveal even
  // though the renderer's inclusive one-frame timeline reports progress 1.
  const posterProgress = totalFrames <= 1 ? 0 : createTimeline(posterFrame, fps, totalFrames).progress;
  const poster = posterSeconds !== undefined && arrangePhaseAt(posterProgress) === "reveal"
    ? `${Number(posterSeconds.toPrecision(12))}s` as Duration
    : undefined;
  return video({
    size,
    duration,
    ...(editions === undefined ? {} : { editions }),
    ...(poster === undefined ? {} : { poster }),
    render: (ctx) =>
      renderArrangeRequest(
        onStage(ctx.width, ctx.height),
        arrangePhaseAt(ctx.timeline.progress),
      ),
  });
}

export {
  ARRANGE_PATTERNS,
  arrangePattern,
  checkArrangeRequest,
  findArrangePattern,
  parseArrangeRequest,
  ArrangeRequestError,
  type ArrangeAsset,
  type ArrangePattern,
  type ArrangePatternId,
  type ArrangeRequest,
} from "@superimg/stdlib/arrange";
export { ArrangeError, type ArrangeFailure } from "@superimg/stdlib/arrange";
