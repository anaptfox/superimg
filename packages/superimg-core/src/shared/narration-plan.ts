import type {
  MeasuredNarrationSegment,
  NarrationPlan,
  NarrationTimingOptions,
} from "@superimg/types";

/** Manifest directory is relative to the authored media file, not process cwd. */
export function preparedNarrationAudio(
  plan: NarrationPlan,
  manifestDirectory: string,
) {
  if (plan.schemaVersion !== 1 || plan.kind !== "narration-plan") {
    throw new TypeError("Unsupported narration plan");
  }
  if (plan.findings.some((finding) => finding.severity === "error")) {
    throw new Error("Narration timing has unresolved overflow");
  }
  return {
    ...plan.audio,
    clips: plan.audio.clips.map((clip) => {
      const src = `${manifestDirectory.replace(/\/$/, "")}/${clip.src}`;
      return { ...clip, src, source: { kind: "file" as const, src } };
    }),
  };
}

function nonnegative(value: number, path: string): number {
  if (!Number.isFinite(value) || value < 0) {
    throw new TypeError(`${path} must be finite and non-negative`);
  }
  return value;
}

/** Quantize cumulative absolute boundaries once; preserve sample-exact speech lengths. */
export function planNarration(
  segments: readonly MeasuredNarrationSegment[],
  options: NarrationTimingOptions,
): NarrationPlan {
  if (!Number.isFinite(options.fps) || options.fps <= 0 || options.fps > 1000) {
    throw new TypeError("fps must be positive and at most 1000");
  }
  if (options.mode !== "natural" && options.mode !== "fixed") {
    throw new TypeError("Unknown narration timing mode");
  }
  if (segments.length === 0) {
    throw new TypeError("Narration needs at least one segment");
  }
  const plan: NarrationPlan = {
    schemaVersion: 1,
    kind: "narration-plan",
    mode: options.mode,
    fps: options.fps,
    totalFrames: 0,
    durationSeconds: 0,
    segments: [],
    phases: {},
    audio: { clips: [] },
    findings: [],
  };
  const ids = new Set<string>();
  let exactEnd = 0;
  for (const segment of segments) {
    if (
      !/^[A-Za-z][A-Za-z0-9_-]*$/.test(segment.id) || ids.has(segment.id) ||
      ["__proto__", "constructor", "prototype"].includes(segment.id)
    ) {
      throw new TypeError(
        `Invalid or duplicate narration segment id: ${segment.id}`,
      );
    }
    ids.add(segment.id);
    if (!segment.src) throw new TypeError(`${segment.id}.src is required`);
    if (
      !Number.isSafeInteger(segment.sampleFrames) ||
      segment.sampleFrames <= 0 ||
      !Number.isSafeInteger(segment.sampleRate) || segment.sampleRate <= 0
    ) {
      throw new TypeError(
        `${segment.id} needs positive integer sampleFrames and sampleRate`,
      );
    }
    const speechDurationSeconds = segment.sampleFrames / segment.sampleRate;
    const before = nonnegative(
      segment.beforeSeconds ?? 0,
      `${segment.id}.beforeSeconds`,
    );
    const after = nonnegative(
      segment.afterSeconds ?? 0,
      `${segment.id}.afterSeconds`,
    );
    const required = before + speechDurationSeconds + after;
    if (options.mode === "fixed" && segment.budgetSeconds === undefined) {
      throw new TypeError(
        `${segment.id}.budgetSeconds is required in fixed mode`,
      );
    }
    const duration = options.mode === "fixed"
      ? nonnegative(segment.budgetSeconds!, `${segment.id}.budgetSeconds`)
      : required;
    if (duration === 0) {
      throw new TypeError(`${segment.id} must have positive duration`);
    }
    const startFrame = plan.totalFrames;
    exactEnd = options.mode === "natural"
      ? startFrame / options.fps + duration
      : exactEnd + duration;
    // Fixed budgets keep cumulative rounding. Natural scenes reserve enough whole frames
    // for every sample and pause; their explicit padding is part of the frozen plan.
    const endFrame = Math.ceil(exactEnd * options.fps - 1e-9);
    if (!Number.isSafeInteger(endFrame) || endFrame <= startFrame) {
      throw new TypeError(
        `${segment.id} has no video frame or exceeds the frame range`,
      );
    }
    const startSeconds = startFrame / options.fps;
    const endSeconds = endFrame / options.fps;
    const speechStartSeconds = startSeconds + before;
    const available = Math.min(duration, endSeconds - startSeconds);
    const overflowSeconds = Math.max(0, required - available);
    // Rounding can consume a fraction of a sample; do not classify that as overflow.
    if (overflowSeconds > 1 / segment.sampleRate) {
      plan.findings.push({
        code: "NARRATION_OVERFLOW",
        severity: "error",
        segmentId: segment.id,
        overflowSeconds,
        message: `${segment.id} exceeds its scene by ${
          overflowSeconds.toFixed(6)
        } seconds; adjust the budget or explicitly regenerate speech`,
      });
    }
    if (segment.transcript) {
      let last = 0;
      for (const word of segment.transcript) {
        if (
          typeof word.text !== "string" || !Number.isFinite(word.start) ||
          !Number.isFinite(word.end) ||
          word.start < last || word.end < word.start ||
          word.end > speechDurationSeconds + 1 / segment.sampleRate
        ) {
          throw new TypeError(
            `${segment.id} has invalid clip-relative transcript timing`,
          );
        }
        last = word.end;
      }
    }
    plan.segments.push({
      id: segment.id,
      startFrame,
      endFrame,
      startSeconds,
      endSeconds,
      speechStartSeconds,
      speechDurationSeconds,
      paddingSeconds: Math.max(0, endSeconds - startSeconds - required),
    });
    plan.phases[segment.id] = `${endSeconds - startSeconds}s`;
    plan.audio.clips.push({
      id: segment.id,
      src: segment.src,
      source: { kind: "file", src: segment.src },
      role: "voice",
      at: `${speechStartSeconds}s`,
      duration: `${speechDurationSeconds}s`,
      ...(segment.transcript
        ? { transcript: segment.transcript.map((word) => ({ ...word })) }
        : {}),
    });
    plan.totalFrames = endFrame;
  }
  plan.durationSeconds = plan.totalFrames / options.fps;
  return plan;
}
