import { describe, expect, it, vi } from "vitest";
import { retainedResourcesScript } from "./retained.js";

function registry() {
  return new Function("window", `${retainedResourcesScript}; return resources;`)({}) as {
    begin(): void; retain(key: string, signature: string, create: () => { dispose(): void | Promise<void> }): void;
    end(): void; dispose(): void; flush(): Promise<void>;
  };
}
describe("retained graphics cleanup", () => {
  it("waits for asynchronous disposal after an occurrence disappears", async () => {
    const resources = registry();
    let finish!: () => void;
    const dispose = vi.fn(() => new Promise<void>(resolve => { finish = resolve; }));
    resources.begin(); resources.retain("a", "v1", () => ({ dispose })); resources.end();
    resources.begin(); resources.end();
    let settled = false;
    const flushed = resources.flush().then(() => { settled = true; });
    await Promise.resolve();
    expect(settled).toBe(false);
    finish(); await flushed;
    expect(dispose).toHaveBeenCalledOnce();
  });
  it("reports asynchronous cleanup failure at the capture boundary", async () => {
    const resources = registry();
    resources.begin(); resources.retain("a", "v1", () => ({ dispose: () => Promise.reject(new Error("cleanup failed")) })); resources.end();
    resources.dispose();
    await expect(resources.flush()).rejects.toMatchObject({ name: "AggregateError", errors: [expect.objectContaining({ message: "cleanup failed" })] });
    await expect(resources.flush()).resolves.toBeUndefined();
  });
});
