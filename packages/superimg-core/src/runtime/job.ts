import {
  RuntimeCancelledError,
  type JobEvent,
  type JobState,
  type PausableJob,
} from "@superimg/types";

export interface JobContext {
  readonly signal: AbortSignal;
  checkpoint(completed?: number, total?: number): Promise<void>;
  finalizing(): void;
  preflight(tracks: readonly import("@superimg/types").ConversionTrackPlan[]): Promise<void>;
}

/** In-memory, cooperative job state. Checkpoints are the only pause boundary. */
export function createPausableJob<T>(
  id: string,
  run: (context: JobContext) => Promise<T>,
  options: { signal?: AbortSignal; deferStart?: boolean } = {},
): PausableJob<T> {
  let state: JobState = "queued";
  let reason: string | undefined;
  const listeners = new Set<(event: JobEvent) => void>();
  const controller = new AbortController();
  let resume: (() => void) | undefined;
  let pauseRequested = false;
  let disposed: Promise<void> | undefined;
  let tracks: readonly import("@superimg/types").ConversionTrackPlan[] | undefined;

  const emit = (completed?: number, total?: number, error?: unknown) => {
    const event: JobEvent = Object.freeze({
      schemaVersion: 0,
      kind: "@foxworth/superimg/job",
      jobId: id,
      state,
      ...(completed !== undefined ? { completed } : {}),
      ...(total !== undefined ? { total } : {}),
      ...(error !== undefined ? { error: { message: error instanceof Error ? error.message : String(error) } } : {}),
      ...(reason !== undefined ? { reason } : {}),
      ...(tracks !== undefined ? { tracks } : {}),
    });
    for (const listener of listeners) {
      try { listener(event); } catch { /* observers cannot affect a job */ }
    }
  };
  const transition = (next: JobState, completed?: number, total?: number, error?: unknown) => {
    state = next;
    emit(completed, total, error);
  };
  const checkpoint = async (completed?: number, total?: number): Promise<void> => {
    if (controller.signal.aborted) throw new RuntimeCancelledError({ operation: "job", ...(reason !== undefined ? { reason } : {}) });
    if (!pauseRequested) {
      if (state === "queued" || state === "finalizing") transition("running", completed, total);
      else if (state === "running") emit(completed, total);
      return;
    }
    const waiting = new Promise<void>((resolve) => { resume = resolve; });
    transition("paused", completed, total);
    await waiting;
    resume = undefined;
    if (controller.signal.aborted) throw new RuntimeCancelledError({ operation: "job", ...(reason !== undefined ? { reason } : {}) });
    transition("running", completed, total);
  };

  const result = Promise.resolve().then(async () => {
    try {
      if (controller.signal.aborted) throw new RuntimeCancelledError({ operation: "job", ...(reason !== undefined ? { reason } : {}) });
      if (!pauseRequested && !options.deferStart) transition("running");
      if (pauseRequested && !options.deferStart) await checkpoint();
      const value = await run({
        signal: controller.signal, checkpoint, finalizing: () => transition("finalizing"),
        async preflight(value) { tracks = Object.freeze(value.map((track) => Object.freeze({ ...track }))); emit(); await checkpoint(); },
      });
      if (controller.signal.aborted) {
        await disposeValue(value);
        throw new RuntimeCancelledError({ operation: "job" });
      }
      transition("succeeded");
      return value;
    } catch (error) {
      transition(error instanceof RuntimeCancelledError || controller.signal.aborted ? "cancelled" : "failed", undefined, undefined, error);
      throw error;
    } finally {
      options.signal?.removeEventListener("abort", abort);
    }
  });

  const job: PausableJob<T> = Object.freeze({
    id,
    get state() { return state; },
    result,
    async pause() {
      if (state !== "queued" && state !== "running") return;
      pauseRequested = true;
      transition("pausing");
    },
    async resume() {
      if (state !== "paused" && state !== "pausing") return;
      pauseRequested = false;
      if (resume !== undefined) resume();
      else transition("running");
    },
    async cancel(nextReason?: string) {
      if (state === "succeeded" || state === "failed" || state === "cancelled") return;
      reason = nextReason;
      controller.abort();
      if (resume !== undefined) resume();
    },
    dispose() {
      disposed ??= (async () => {
        await job.cancel("disposed");
        await disposeValue(await result.catch(() => undefined));
        listeners.clear();
      })();
      return disposed;
    },
    subscribe(listener: (event: JobEvent) => void) {
      listeners.add(listener);
      try { listener(Object.freeze({ schemaVersion: 0, kind: "@foxworth/superimg/job", jobId: id, state, ...(reason !== undefined ? { reason } : {}) })); } catch { /* ignore */ }
      return () => listeners.delete(listener);
    },
    [Symbol.asyncDispose]: async () => { await job.dispose(); },
  });
  const abort = () => { void job.cancel("aborted"); };
  if (options.signal?.aborted) abort();
  else options.signal?.addEventListener("abort", abort, { once: true });
  // Jobs may be observed through events before their result is awaited.
  void result.catch(() => {});
  return job;
}

async function disposeValue(value: unknown): Promise<void> {
  if (typeof value === "object" && value !== null && "dispose" in value && typeof value.dispose === "function") {
    await value.dispose();
  }
}
