import { describe, expect, it, vi } from "vitest";
import { exportWithCliControls } from "./media-interactions.js";

describe("authored export controls", () => {
  it("returns a successful bundle without disposing the job before its consumer", async () => {
    const bundle = { open: vi.fn(() => new ReadableStream()) };
    const dispose = vi.fn(async () => {});
    const job = { result: Promise.resolve(bundle), subscribe: vi.fn(() => () => {}), dispose, cancel: vi.fn(), pause: vi.fn(), resume: vi.fn() };
    const result = await exportWithCliControls({} as never, {} as never, {} as never, () => job as never);
    expect(result).toBe(bundle);
    expect(dispose).not.toHaveBeenCalled();
    expect(bundle.open).toHaveBeenCalledTimes(0);
  });
});
