/** Resolve requested seconds onto the encoded frame clock used by still capture. */
export function resolveFrameIndex(opts: { frame?: number; progress?: number; fps?: number; durationSeconds?: number; totalFrames?: number }): number {
  const fps = opts.fps ?? 30;
  const duration = opts.durationSeconds ?? 5;
  const totalFrames = opts.totalFrames ?? Math.max(1, Math.ceil(duration * fps));
  if (!Number.isSafeInteger(totalFrames) || totalFrames < 1) throw new TypeError("totalFrames must be a positive safe integer");
  if (opts.frame !== undefined) return Math.max(0, Math.min(opts.frame, totalFrames - 1));
  if (opts.progress !== undefined) return totalFrames <= 1 ? 0 : Math.min(totalFrames - 1, Math.round(Math.max(0, Math.min(opts.progress, 1)) * (totalFrames - 1)));
  return 0;
}

export function resolveEncodedFrame(requestedSeconds: number, fps: number, totalFrames: number) {
  if (!Number.isFinite(requestedSeconds) || requestedSeconds < 0 || !Number.isFinite(fps) || fps <= 0 || !Number.isSafeInteger(totalFrames) || totalFrames < 1) {
    throw new TypeError("Invalid encoded frame clock");
  }
  const requestedFrame = Math.round(requestedSeconds * fps);
  const frame = resolveFrameIndex({ frame: requestedFrame, totalFrames });
  return { requestedSeconds, frame, encodedSeconds: frame / fps, clamped: frame !== requestedFrame };
}
