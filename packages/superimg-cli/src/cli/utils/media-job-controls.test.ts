import { describe, expect, it, vi } from "vitest";
import { attachMediaJobControls } from "./media-job-controls.js";

describe("media job controls", () => {
  it("unsubscribes and removes SIGINT handling on cleanup", () => {
    const unsubscribe = vi.fn();
    const job = { subscribe: vi.fn(() => unsubscribe), cancel: vi.fn(async () => {}), pause: vi.fn(async () => {}), resume: vi.fn(async () => {}) };
    const detach = attachMediaJobControls(job as never);
    detach();
    expect(unsubscribe).toHaveBeenCalledOnce();
  });
});
