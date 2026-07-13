import { describe, expect, it, vi } from "vitest";
import { CompileQueue, CompileSupersededError } from "./compile-queue.js";

describe("CompileQueue", () => {
  it("keeps only the latest pending task for a caller", async () => {
    const queue = new CompileQueue(1);
    const key = {};
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const firstRun = vi.fn(async () => {
      await gate;
      return "first";
    });
    const staleRun = vi.fn(async () => "stale");
    const latestRun = vi.fn(async () => "latest");

    const first = queue.enqueue(key, firstRun);
    const stale = queue.enqueue(key, staleRun);
    const staleResult = expect(stale).rejects.toBeInstanceOf(CompileSupersededError);
    const latest = queue.enqueue(key, latestRun);
    release();

    await expect(first).resolves.toBe("first");
    await staleResult;
    await expect(latest).resolves.toBe("latest");
    expect(staleRun).not.toHaveBeenCalled();
  });

  it("does not supersede pending work from a different caller", async () => {
    const queue = new CompileQueue(1);
    const order: string[] = [];

    await Promise.all([
      queue.enqueue({}, async () => order.push("one")),
      queue.enqueue({}, async () => order.push("two")),
    ]);

    expect(order).toEqual(["one", "two"]);
  });
});
