import { describe, expect, it, vi } from "vitest";
import { createDevSourceCache } from "./dev-source-cache.js";

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

describe("dev source compilation generations", () => {
  it("shares one current compile and serves fresh output to a superseded request", async () => {
    const old = deferred<string>(), current = deferred<string>();
    const compile = vi.fn().mockReturnValueOnce(old.promise).mockReturnValueOnce(current.promise);
    const cache = createDevSourceCache<string>(compile);
    const first = cache.get();
    cache.invalidate();
    const latest = cache.get();
    const concurrent = cache.get();
    current.resolve("camera looks toward roofs");
    expect(await latest).toEqual({ generation: 1, value: "camera looks toward roofs" });
    old.resolve("camera looks toward sky");
    expect(await first).toEqual(await latest);
    expect(await concurrent).toEqual(await latest);
    expect(await cache.get()).toEqual(await latest);
    expect(compile).toHaveBeenCalledTimes(2);
  });

  it("does not surface a superseded compile error after a newer source succeeds", async () => {
    const old = deferred<string>(), current = deferred<string>();
    const cache = createDevSourceCache<string>(vi.fn().mockReturnValueOnce(old.promise).mockReturnValueOnce(current.promise));
    const first = cache.get();
    cache.invalidate();
    const latest = cache.get();
    current.resolve("fixed helper");
    await latest;
    old.reject(new Error("missing helper in old generation"));
    expect(await first).toEqual({ generation: 1, value: "fixed helper" });
  });

  it("reports current compile failure and can recover on the next request", async () => {
    const compile = vi.fn().mockRejectedValueOnce(new Error("missing helper")).mockResolvedValueOnce("added helper");
    const cache = createDevSourceCache<string>(compile);
    await expect(cache.get()).rejects.toThrow("missing helper");
    expect(await cache.get()).toEqual({ generation: 0, value: "added helper" });
  });
  it("discards cached and in-flight bundles when compiler behavior changes", async () => {
    let version = 1;
    const old = deferred<string>();
    const compile = vi.fn().mockResolvedValueOnce("old cached bundle").mockReturnValueOnce(old.promise).mockRejectedValueOnce(new Error("unresolved import"));
    const cache = createDevSourceCache<string>(compile, () => version);
    expect((await cache.get()).value).toBe("old cached bundle");
    version = 2;
    const pending = cache.get();
    expect(compile).toHaveBeenCalledTimes(2);
    version = 3;
    old.resolve("old in-flight bundle");
    await expect(pending).rejects.toThrow("unresolved import");
    expect(compile).toHaveBeenCalledTimes(3);
  });

});
