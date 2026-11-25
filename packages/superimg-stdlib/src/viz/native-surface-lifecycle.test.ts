import { describe, expect, it, vi } from "vitest";
import { createNativeSurfaceLifecycle } from "./native-surface-lifecycle.js";
import type { NativeSurfaceHost, NativeSurfaceInstance } from "@superimg/types";

const host = (signal: AbortSignal): NativeSurfaceHost => ({ canvas: {} as HTMLCanvasElement, width: 100, height: 50, dpr: 1, assets: {}, signal });
function deferred<T>() { let resolve!: (value: T) => void; const promise = new Promise<T>(r => { resolve = r; }); return { promise, resolve }; }

describe("native surface occurrence lifecycle", () => {
  it("creates once, serializes samples and disposes once", async () => {
    const waiting = deferred<void>();
    const calls: number[] = [];
    const instance = { sample: vi.fn(async ({ seconds }: { seconds: number }) => { calls.push(seconds); if (seconds === 1) await waiting.promise; }), dispose: vi.fn() };
    const create = vi.fn(() => instance);
    const lifecycle = createNativeSurfaceLifecycle({ create }, host(new AbortController().signal));
    const first = lifecycle.sample({ seconds: 1, data: {} });
    const second = lifecycle.sample({ seconds: 2, data: {} });
    await vi.waitFor(() => expect(calls).toEqual([1]));
    waiting.resolve();
    await Promise.all([first, second]);
    await Promise.all([lifecycle.dispose(), lifecycle.dispose()]);
    expect(calls).toEqual([1, 2]);
    expect(create).toHaveBeenCalledOnce();
    expect(instance.dispose).toHaveBeenCalledOnce();
  });
  it("disposes a late-created instance after cancellation and does not sample it", async () => {
    const waiting = deferred<NativeSurfaceInstance<{}>>();
    const controller = new AbortController();
    const create = vi.fn(() => waiting.promise);
    const instance = { sample: vi.fn(), dispose: vi.fn() };
    const lifecycle = createNativeSurfaceLifecycle({ create }, host(controller.signal));
    const sample = lifecycle.sample({ seconds: 1, data: {} });
    await vi.waitFor(() => expect(create).toHaveBeenCalledOnce());
    controller.abort();
    waiting.resolve(instance);
    await expect(sample).rejects.toThrow();
    await lifecycle.dispose();
    expect(instance.sample).not.toHaveBeenCalled();
    expect(instance.dispose).toHaveBeenCalledOnce();
  });
  it("disposes after a failed sample and preserves the primary error", async () => {
    const error = new Error("draw failed");
    const instance = { sample: vi.fn().mockRejectedValue(error), dispose: vi.fn() };
    const lifecycle = createNativeSurfaceLifecycle({ create: () => instance }, host(new AbortController().signal));
    await expect(lifecycle.sample({ seconds: 1, data: {} })).rejects.toBe(error);
    expect(instance.dispose).toHaveBeenCalledOnce();
    await expect(lifecycle.sample({ seconds: 2, data: {} })).rejects.toThrow(/disposed/);
    expect(instance.sample).toHaveBeenCalledOnce();
  });
  it("reports both sampling and cleanup failures", async () => {
    const instance = { sample: vi.fn().mockRejectedValue(new Error("draw failed")), dispose: vi.fn().mockRejectedValue(new Error("cleanup failed")) };
    const lifecycle = createNativeSurfaceLifecycle({ create: () => instance }, host(new AbortController().signal));
    await expect(lifecycle.sample({ seconds: 1, data: {} })).rejects.toMatchObject({ name: "AggregateError", errors: [expect.objectContaining({ message: "draw failed" }), expect.objectContaining({ message: "cleanup failed" })] });
  });
});
