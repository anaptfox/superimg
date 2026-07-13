import { describe, expect, it } from "vitest";
import { mapBounded } from "./bounded-pool.js";

describe("mapBounded", () => {
  it("never exceeds configured concurrency", async () => {
    let active = 0;
    let maximum = 0;
    const results = await mapBounded(
      [1, 2, 3, 4, 5, 6],
      { concurrency: 2 },
      async (value) => {
        active += 1;
        maximum = Math.max(maximum, active);
        await new Promise((resolve) => setTimeout(resolve, 5));
        active -= 1;
        return value * 2;
      },
    );
    expect(maximum).toBe(2);
    expect(results).toEqual([2, 4, 6, 8, 10, 12]);
  });

  it("does not start queued work after cancellation", async () => {
    const controller = new AbortController();
    const started: number[] = [];
    const work = mapBounded(
      [1, 2, 3, 4],
      { concurrency: 1, signal: controller.signal },
      async (value) => {
        started.push(value);
        controller.abort();
        return value;
      },
    );
    await expect(work).rejects.toMatchObject({ code: "aborted" });
    expect(started).toEqual([1]);
  });

  it("cancels sibling workers on the first terminal error", async () => {
    const observedAbort: boolean[] = [];
    const work = mapBounded(
      [1, 2, 3],
      { concurrency: 2, stopOnError: true },
      async (value, _index, _worker, signal) => {
        if (value === 1) {
          await new Promise((resolve) => setTimeout(resolve, 0));
          throw new Error("boom");
        }
        await new Promise<void>((resolve) => {
          signal.addEventListener("abort", () => {
            observedAbort.push(true);
            resolve();
          }, { once: true });
        });
        return value;
      },
    );
    await expect(work).rejects.toThrow("boom");
    expect(observedAbort).toEqual([true]);
  });
});
