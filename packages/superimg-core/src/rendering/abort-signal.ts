//! Turn an AbortSignal into RuntimeCancelledError and race it against a wait.

import { RuntimeCancelledError } from "@superimg/types";

export function isAbortError(error: unknown, signal?: AbortSignal): boolean {
  if (signal?.aborted === true) return true;
  if (error instanceof RuntimeCancelledError) return true;
  const name = error instanceof Error ? error.name : undefined;
  return name === "AbortError" || name === "TimeoutError";
}

export function cancellationError(error?: unknown): RuntimeCancelledError {
  return error instanceof RuntimeCancelledError ? error : new RuntimeCancelledError();
}

/** Reject when `signal` aborts, including a wait that never settles on its own. */
export function raceSignal<T>(promise: Promise<T>, signal?: AbortSignal): Promise<T> {
  if (signal?.aborted === true) return Promise.reject(new RuntimeCancelledError());
  if (signal === undefined) return promise;
  return new Promise<T>((resolve, reject) => {
    const onAbort = () => {
      signal.removeEventListener("abort", onAbort);
      reject(new RuntimeCancelledError());
    };
    signal.addEventListener("abort", onAbort, { once: true });
    promise.then(
      (value) => {
        signal.removeEventListener("abort", onAbort);
        if (signal.aborted) reject(new RuntimeCancelledError());
        else resolve(value);
      },
      (error: unknown) => {
        signal.removeEventListener("abort", onAbort);
        reject(isAbortError(error, signal) ? cancellationError(error) : error);
      },
    );
  });
}
