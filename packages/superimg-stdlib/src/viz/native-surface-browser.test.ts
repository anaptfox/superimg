import { describe, expect, it, vi } from "vitest";
import { sampleNativeSurface, type RetainedNativeResources } from "./native-surface-browser.js";
import type { NativeSurfaceHost } from "@superimg/types";

describe("native surface retained bridge", () => {
  it("reuses one admitted instance and replaces a subsequent frame's canvas", async () => {
    let previous: { signature: string; value: { dispose(): void | Promise<void> } } | undefined;
    const resources: RetainedNativeResources = { discard() { previous = undefined; }, retain(key, signature, create) {
      expect(key).toBe("art");
      if (!previous || previous.signature !== signature) previous = { signature, value: create() };
      return previous.value as ReturnType<typeof create>;
    } };
    const firstCanvas = { replaceWith: vi.fn() } as unknown as HTMLCanvasElement;
    const nextCanvas = { replaceWith: vi.fn() } as unknown as HTMLCanvasElement;
    const host: NativeSurfaceHost = { canvas: firstCanvas, width: 100, height: 50, dpr: 1, signal: new AbortController().signal, assets: {} };
    const sample = vi.fn(), dispose = vi.fn(), create = vi.fn(() => ({ sample, dispose }));
    await sampleNativeSurface({ resources, key: "art", moduleIdentity: "revision", module: { create }, host, frame: { seconds: 0, data: {} } });
    await sampleNativeSurface({ resources, key: "art", moduleIdentity: "revision", module: { create }, host: { ...host, canvas: nextCanvas }, frame: { seconds: 1, data: {} } });
    expect(create).toHaveBeenCalledOnce();
    expect(sample).toHaveBeenCalledTimes(2);
    expect(nextCanvas.replaceWith).toHaveBeenCalledWith(firstCanvas);
    await previous!.value.dispose();
    expect(dispose).toHaveBeenCalledOnce();
  });
  it("discards a failed instance so a later frame can recover", async () => {
    let current: { dispose(): void | Promise<void> } | undefined;
    const resources: RetainedNativeResources = {
      retain(_key, _signature, create) { if (!current) current = create(); return current as ReturnType<typeof create>; },
      discard(value) { if (current === value) current = undefined; },
    };
    const host: NativeSurfaceHost = { canvas: { replaceWith: vi.fn() } as unknown as HTMLCanvasElement, width: 10, height: 10, dpr: 1, signal: new AbortController().signal, assets: {} };
    let count = 0;
    const dispose = vi.fn();
    const module = { create() { count++; return { sample() { if (count === 1) throw new Error("failed"); }, dispose }; } };
    const input = { resources, key: "art", moduleIdentity: "v1", module, host, frame: { seconds: 0, data: {} } };
    await expect(sampleNativeSurface(input)).rejects.toThrow("failed");
    await expect(sampleNativeSurface(input)).resolves.toBe(host.canvas);
    expect(count).toBe(2);
    expect(dispose).toHaveBeenCalledOnce();
  });
});
