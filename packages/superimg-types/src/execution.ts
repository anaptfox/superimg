//! Shared execution controls for bounded, cancellable render work.

export type RenderExecutionErrorCode =
  | "aborted"
  | "deadline_exceeded"
  | "queue_full"
  | "resource_limit";

export class RenderExecutionError extends Error {
  readonly code: RenderExecutionErrorCode;

  constructor(code: RenderExecutionErrorCode, message?: string) {
    super(message ?? code);
    this.name = "RenderExecutionError";
    this.code = code;
  }
}

export interface RenderExecutionOptions {
  /** Caller-owned cancellation signal. */
  signal?: AbortSignal;
  /** Absolute wall-clock deadline in milliseconds since the Unix epoch. */
  deadlineMs?: number;
  /** Maximum time to wait for renderer/encoder cleanup after execution stops. */
  cleanupTimeoutMs?: number;
}

/** Limits applied after template resolve, before renderer allocation. */
export interface RenderLimits {
  maxWidth?: number;
  maxHeight?: number;
  maxFps?: number;
  maxDurationSeconds?: number;
  maxFrames?: number;
  maxAssets?: number;
}

export function executionErrorFromSignal(signal?: AbortSignal): RenderExecutionError {
  const reason = signal?.reason;
  if (reason instanceof RenderExecutionError) return reason;
  if (reason instanceof Error && reason.name === "TimeoutError") {
    return new RenderExecutionError("deadline_exceeded", reason.message);
  }
  return new RenderExecutionError(
    "aborted",
    reason instanceof Error ? reason.message : "Render execution was cancelled",
  );
}

export function throwIfExecutionCancelled(options?: RenderExecutionOptions): void {
  if (options?.signal?.aborted) throw executionErrorFromSignal(options.signal);
  if (options?.deadlineMs !== undefined && Date.now() >= options.deadlineMs) {
    throw new RenderExecutionError("deadline_exceeded", "Render execution deadline exceeded");
  }
}

export interface LinkedExecutionSignal {
  signal: AbortSignal;
  deadlineMs?: number;
  dispose(): void;
}

/** Link a caller signal and absolute deadline into one disposable signal. */
export function createLinkedExecutionSignal(
  options: RenderExecutionOptions = {},
): LinkedExecutionSignal {
  const controller = new AbortController();
  let timeout: ReturnType<typeof setTimeout> | undefined;

  const abortFromCaller = () => {
    if (!controller.signal.aborted) {
      controller.abort(executionErrorFromSignal(options.signal));
    }
  };

  if (options.signal?.aborted) {
    abortFromCaller();
  } else {
    options.signal?.addEventListener("abort", abortFromCaller, { once: true });
  }

  if (options.deadlineMs !== undefined && !controller.signal.aborted) {
    const remainingMs = options.deadlineMs - Date.now();
    if (remainingMs <= 0) {
      controller.abort(
        new RenderExecutionError("deadline_exceeded", "Render execution deadline exceeded"),
      );
    } else {
      timeout = setTimeout(() => {
        controller.abort(
          new RenderExecutionError("deadline_exceeded", "Render execution deadline exceeded"),
        );
      }, remainingMs);
    }
  }

  return {
    signal: controller.signal,
    ...(options.deadlineMs !== undefined ? { deadlineMs: options.deadlineMs } : {}),
    dispose() {
      if (timeout !== undefined) clearTimeout(timeout);
      options.signal?.removeEventListener("abort", abortFromCaller);
    },
  };
}

/** Race an asynchronous adapter operation against cancellation. */
export async function raceWithExecution<T>(
  promise: Promise<T>,
  options?: RenderExecutionOptions,
): Promise<T> {
  throwIfExecutionCancelled(options);
  if (!options?.signal && options?.deadlineMs === undefined) return promise;

  const linked = createLinkedExecutionSignal(options);
  try {
    if (linked.signal.aborted) throw executionErrorFromSignal(linked.signal);
    return await new Promise<T>((resolve, reject) => {
      const onAbort = () => reject(executionErrorFromSignal(linked.signal));
      linked.signal.addEventListener("abort", onAbort, { once: true });
      promise.then(
        (value) => {
          linked.signal.removeEventListener("abort", onAbort);
          resolve(value);
        },
        (error) => {
          linked.signal.removeEventListener("abort", onAbort);
          reject(error);
        },
      );
    });
  } finally {
    linked.dispose();
  }
}
