import { describe, expect, it, vi } from "vitest";
import { createPausableJob } from "./job.js";

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((done) => { resolve = done; });
  return { promise, resolve };
}

describe("cooperative media jobs", () => {
  it("pauses between frames and resumes without repeating timestamps", async () => {
    const gate = deferred();
    const entered = deferred();
    const paused = deferred();
    const frames: number[] = [];
    const job = createPausableJob("frames", async (context) => {
      for (let frame = 0; frame < 3; frame++) {
        if (frame === 1) { entered.resolve(); await gate.promise; }
        await context.checkpoint(frame, 3);
        frames.push(frame);
      }
      context.finalizing();
      return frames;
    });
    job.subscribe((event) => { if (event.state === "paused") paused.resolve(); });
    await entered.promise;
    await job.pause();
    expect(job.state).toBe("pausing");
    gate.resolve();
    await paused.promise;
    expect(frames).toEqual([0]);
    await job.resume();
    expect(await job.result).toEqual([0, 1, 2]);
    expect(job.state).toBe("succeeded");
  });

  it("supports an observer resuming synchronously at the pause boundary", async () => {
    const job = createPausableJob("observer", async (context) => { await context.checkpoint(); return 1; });
    job.subscribe((event) => { if (event.state === "paused") void job.resume(); });
    await job.pause();
    expect(await job.result).toBe(1);
  });

  it("resumes a pending pause before the checkpoint", async () => {
    const gate = deferred();
    const job = createPausableJob("early", async (context) => { await gate.promise; await context.checkpoint(); });
    await Promise.resolve();
    await job.pause();
    await job.resume();
    gate.resolve();
    await job.result;
    expect(job.state).toBe("succeeded");
  });

  it("cancels queued work without starting it", async () => {
    const run = vi.fn(async () => 1);
    const job = createPausableJob("queued", run);
    await job.cancel();
    await expect(job.result).rejects.toThrow();
    expect(run).not.toHaveBeenCalled();
    expect(job.state).toBe("cancelled");
  });

  it("cancels while paused and awaits cleanup during disposal", async () => {
    const cleanup = vi.fn();
    const paused = deferred();
    const job = createPausableJob("paused", async (context) => {
      try { await context.checkpoint(); } finally { cleanup(); }
    }, { deferStart: true });
    job.subscribe((event) => { if (event.state === "paused") paused.resolve(); });
    await job.pause();
    await paused.promise;
    await job.dispose();
    expect(job.state).toBe("cancelled");
    expect(cleanup).toHaveBeenCalledOnce();
  });

  it("does not pause or declare success during finalization", async () => {
    const gate = deferred();
    const finalizing = deferred();
    const job = createPausableJob("finalize", async (context) => {
      context.finalizing(); finalizing.resolve(); await gate.promise; return 7;
    });
    await finalizing.promise;
    await job.pause();
    expect(job.state).toBe("finalizing");
    gate.resolve();
    expect(await job.result).toBe(7);
    expect(job.state).toBe("succeeded");
  });

  it("rejects finalization failures and honors external cancellation", async () => {
    const job = createPausableJob("failure", async (context) => { context.finalizing(); throw new Error("mux failed"); });
    await expect(job.result).rejects.toThrow("mux failed");
    expect(job.state).toBe("failed");
    const controller = new AbortController();
    const cancelled = createPausableJob("signal", async (context) => { await context.checkpoint(); }, { signal: controller.signal });
    controller.abort();
    await expect(cancelled.result).rejects.toThrow();
    expect(cancelled.state).toBe("cancelled");
  });

  it("disposes successful artifacts once", async () => {
    const dispose = vi.fn(async () => {});
    const job = createPausableJob("artifact", async () => ({ dispose }));
    await job.result;
    await Promise.all([job.dispose(), job.dispose()]);
    expect(dispose).toHaveBeenCalledOnce();
  });
});
