import type { RenderExecutionOptions } from "@superimg/types";
import {
  createLinkedExecutionSignal,
  throwIfExecutionCancelled,
} from "@superimg/types";

export interface BoundedPoolOptions extends RenderExecutionOptions {
  concurrency: number;
  stopOnError?: boolean;
}

/**
 * Map work through a fixed number of workers. No item is started after the
 * linked execution is cancelled, and the first error can cancel sibling work.
 */
export async function mapBounded<T, R>(
  items: readonly T[],
  options: BoundedPoolOptions,
  worker: (
    item: T,
    itemIndex: number,
    workerIndex: number,
    signal: AbortSignal,
  ) => Promise<R>,
): Promise<R[]> {
  const requestedConcurrency = Number.isFinite(options.concurrency)
    ? Math.floor(options.concurrency)
    : 1;
  const concurrency = Math.max(1, Math.min(items.length || 1, requestedConcurrency));
  const failureController = new AbortController();
  const callerLinked = createLinkedExecutionSignal(options);
  const linked = createLinkedExecutionSignal({
    signal: failureController.signal,
    ...(options.deadlineMs !== undefined ? { deadlineMs: options.deadlineMs } : {}),
  });
  const onCallerAbort = () => failureController.abort(callerLinked.signal.reason);
  if (callerLinked.signal.aborted) onCallerAbort();
  else callerLinked.signal.addEventListener("abort", onCallerAbort, { once: true });
  const results = new Array<R>(items.length);
  let nextIndex = 0;
  let firstError: unknown;

  try {
    const workers = Array.from({ length: concurrency }, async (_, workerIndex) => {
      while (true) {
        throwIfExecutionCancelled({ signal: linked.signal, deadlineMs: options.deadlineMs });
        if (firstError !== undefined && options.stopOnError) return;
        const itemIndex = nextIndex++;
        if (itemIndex >= items.length) return;
        const item = items[itemIndex];
        if (item === undefined) return;
        try {
          results[itemIndex] = await worker(item, itemIndex, workerIndex, linked.signal);
        } catch (error) {
          firstError ??= error;
          if (options.stopOnError) {
            failureController.abort(error);
            return;
          }
        }
      }
    });
    const settled = await Promise.allSettled(workers);
    if (firstError !== undefined) throw firstError;
    const rejected = settled.find((result): result is PromiseRejectedResult => result.status === "rejected");
    if (rejected) throw rejected.reason;
    return results;
  } finally {
    callerLinked.signal.removeEventListener("abort", onCallerAbort);
    callerLinked.dispose();
    linked.dispose();
  }
}
