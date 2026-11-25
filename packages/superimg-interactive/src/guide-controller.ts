//! Interactive-owned ordered guide navigation.

import type {
  GuideCheckpoint,
  GuideLayout,
  SceneGuide,
  SceneRuntimeInput,
} from "./contracts.js";

export interface InteractiveGuideHost {
  readonly currentFrame: number;
  readonly fps: number;
  readonly duration: number;
  seekFrame(frame: number): void | Promise<void>;
}

export type InteractiveStepListener = (
  step: GuideCheckpoint | null,
  index: number,
) => void;

export class InteractiveGuideController {
  private guide: SceneGuide | null = null;
  private layout: GuideLayout | null = null;
  private lastStepId: string | null = null;
  private readonly listeners = new Set<InteractiveStepListener>();

  constructor(private readonly host: InteractiveGuideHost) {}

  load(guide: SceneGuide | null | undefined): void {
    const layout = guide
      ? layoutInteractiveGuide(guide, this.host.duration, this.host.fps)
      : null;
    this.guide = guide ?? null;
    this.layout = layout;
    this.lastStepId = null;
  }

  get raw(): SceneGuide | null {
    return this.guide;
  }

  get resolved(): GuideLayout | null {
    return this.layout;
  }

  get steps(): readonly GuideCheckpoint[] {
    return this.layout?.checkpoints ?? [];
  }

  get currentStep(): GuideCheckpoint | null {
    return interactiveStepAtFrame(this.layout, this.host.currentFrame);
  }

  get currentIndex(): number {
    const step = this.currentStep;
    return step && this.layout
      ? this.layout.checkpoints.findIndex((item) => item.stepId === step.stepId)
      : -1;
  }

  onStepChange(listener: InteractiveStepListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  async goToStep(stepId: string): Promise<void> {
    const index = this.layout?.checkpoints.findIndex(
      (item) => item.stepId === stepId,
    ) ?? -1;
    if (index < 0 || !this.layout) {
      throw new RangeError(`Unknown interactive guide step \"${stepId}\"`);
    }
    const step = this.layout.checkpoints[index]!;
    const previousStepId = this.lastStepId;
    this.lastStepId = step.stepId;
    try {
      await this.host.seekFrame(step.startFrame);
    } catch (error) {
      this.lastStepId = previousStepId;
      throw error;
    }
    this.emit(step, index);
  }

  async next(): Promise<void> {
    const next = this.steps[this.currentIndex + 1];
    if (next) await this.goToStep(next.stepId);
  }

  async previous(): Promise<void> {
    const index = this.currentIndex;
    const previous = this.steps[Math.max(0, index - 1)];
    if (previous) await this.goToStep(previous.stepId);
  }

  onFrame(frame: number): void {
    const step = interactiveStepAtFrame(this.layout, frame);
    const stepId = step?.stepId ?? null;
    if (stepId === this.lastStepId) return;
    this.lastStepId = stepId;
    const index = step && this.layout
      ? this.layout.checkpoints.findIndex((item) => item.stepId === step.stepId)
      : -1;
    this.emit(step, index);
  }

  private emit(step: GuideCheckpoint | null, index: number): void {
    for (const listener of this.listeners) listener(step, index);
  }
}

export function layoutInteractiveGuide(
  guide: SceneGuide,
  durationSeconds: number,
  fps: number,
): GuideLayout {
  if (!guide.steps.length) throw new Error("Guide has no steps");
  const seen = new Set<string>();
  const durations = guide.steps.map((step) => {
    if (!step.id || step.id.trim() !== step.id) throw new Error("Guide step id must be non-empty and trimmed");
    if (seen.has(step.id)) throw new Error(`Duplicate guide step id \"${step.id}\"`);
    seen.add(step.id);
    return parseInteractiveDuration(step.duration, fps);
  });
  const sum = durations.reduce((total, value) => total + value, 0);
  if (Math.abs(sum - durationSeconds) > 1 / fps + 1e-9) {
    throw new Error(`Guide durations sum to ${sum}s but clock duration is ${durationSeconds}s`);
  }
  const totalFrames = Math.max(1, Math.ceil(durationSeconds * fps));
  if (guide.steps.length > totalFrames) throw new Error("Guide requires at least one frame per step");
  const frames = durations.map((value) => Math.max(1, Math.floor((value / sum) * totalFrames)));
  let used = frames.reduce((total, value) => total + value, 0);
  while (used > totalFrames) {
    const index = frames.reduce((best, value, i) => value > frames[best]! ? i : best, 0);
    if (frames[index]! <= 1) throw new Error("Guide requires at least one frame per step");
    frames[index]!--;
    used--;
  }
  frames[frames.length - 1]! += totalFrames - used;
  let startFrame = 0;
  let startSeconds = 0;
  const checkpoints = guide.steps.map((step, index) => {
    const frameCount = frames[index]!;
    const checkpoint: GuideCheckpoint = {
      stepId: step.id,
      label: step.label,
      ...(step.note !== undefined ? { note: step.note } : {}),
      scene: step.scene,
      ...(step.focusNodeId !== undefined ? { focusNodeId: step.focusNodeId } : {}),
      startFrame,
      endFrame: startFrame + frameCount,
      startSeconds,
      durationSeconds: durations[index]!,
    };
    startFrame += frameCount;
    startSeconds += durations[index]!;
    return checkpoint;
  });
  return { guideId: guide.id, totalSeconds: durationSeconds, totalFrames, fps, checkpoints };
}

export function interactiveStepAtFrame(
  layout: GuideLayout | null | undefined,
  frame: number,
): GuideCheckpoint | null {
  if (!layout) return null;
  return layout.checkpoints.find((step) => frame >= step.startFrame && frame < step.endFrame)
    ?? layout.checkpoints.at(-1)
    ?? null;
}

export function interactiveSceneAtFrame(
  layout: GuideLayout,
  frame: number,
): SceneRuntimeInput | undefined {
  return interactiveStepAtFrame(layout, frame)?.scene;
}

export function parseInteractiveDuration(value: string, fps: number): number {
  const match = /^([0-9]+(?:\.[0-9]+)?)(ms|s|f)$/.exec(value);
  if (!match) throw new Error(`Invalid guide duration \"${value}\"`);
  const amount = Number(match[1]);
  if (!(amount > 0) || !Number.isFinite(amount)) throw new Error("Guide duration must be positive");
  return match[2] === "ms" ? amount / 1000 : match[2] === "f" ? amount / fps : amount;
}
