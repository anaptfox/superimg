/** A live-preview request spans host preparation as well as Player.load(). */
export interface PreviewRequest {
  readonly signal: AbortSignal;
  readonly frame: number;
  readonly wasPlaying: boolean;
  isCurrent(): boolean;
  checkpoint(): void;
}

/** Kept per live Player; independent thumbnails never share this gate. */
export class PreviewRequestGate {
  private epoch = 0;
  private pending: { request: PreviewRequest; controller: AbortController } | null = null;

  constructor(private readonly cancelPendingLoad: () => void) {}

  get revision(): number { return this.epoch; }

  begin(frame: number, wasPlaying: boolean, explicitPlayhead = false): PreviewRequest {
    // A second reload observes the pause made by the first one. Retain the
    // original playback intent until the newest request finishes.
    const resume = wasPlaying || (this.pending?.request.wasPlaying ?? false);
    const heldFrame = explicitPlayhead ? frame : (this.pending?.request.frame ?? frame);
    this.invalidate();
    const epoch = this.epoch;
    const controller = new AbortController();
    const request: PreviewRequest = {
      signal: controller.signal,
      frame: heldFrame,
      wasPlaying: resume,
      isCurrent: () => this.epoch === epoch && !controller.signal.aborted,
      checkpoint: () => {
        controller.signal.throwIfAborted();
        if (this.epoch !== epoch) throw new DOMException("Preview request superseded", "AbortError");
      },
    };
    this.pending = { request, controller };
    return request;
  }

  finish(request: PreviewRequest): void {
    if (this.pending?.request === request) this.pending = null;
  }

  invalidate(): boolean {
    const resume = this.pending?.request.wasPlaying ?? false;
    this.pending?.controller.abort();
    this.pending = null;
    this.epoch++;
    this.cancelPendingLoad();
    return resume;
  }
}

/** Never let a delayed fetch/import start a newer Player transaction. */
export async function loadPreviewCandidate<T, R>(
  request: PreviewRequest,
  prepare: (signal: AbortSignal) => Promise<T>,
  present: (template: T) => Promise<R>,
): Promise<{ template: T; result: R }> {
  const template = await prepare(request.signal);
  request.checkpoint();
  const result = await present(template);
  request.checkpoint();
  return { template, result };
}
