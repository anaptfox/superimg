import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  mkdtempSync,
  writeFileSync,
  rmSync,
  mkdirSync,
} from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  RenderIRCache,
  computeRenderKey,
  cacheEntryKey,
} from "./render-cache.js";

describe("RenderIRCache", () => {
  let root: string;

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), "si-rcache-"));
  });

  afterEach(() => {
    rmSync(root, { recursive: true, force: true });
  });

  it("computeRenderKey is stable for same format/encoding", () => {
    const a = computeRenderKey({ format: "mp4", encoding: { quality: "high" } });
    const b = computeRenderKey({ format: "mp4", encoding: { quality: "high" } });
    const c = computeRenderKey({ format: "webm", encoding: { quality: "high" } });
    expect(a).toBe(b);
    expect(a).not.toBe(c);
  });

  it("isFresh false when missing entry; true after record with existing files", () => {
    const cache = new RenderIRCache(root, "0.0.16");
    const key = cacheEntryKey("hello");
    const hashes = {
      intentHash: "i".repeat(64),
      markupHash: "m".repeat(64),
      programHash: "p".repeat(64),
    };
    const renderKey = computeRenderKey({ format: "mp4" });
    expect(cache.isFresh(key, hashes, renderKey)).toBe(false);

    const out = join(root, "hello.mp4");
    writeFileSync(out, "fake-mp4");
    cache.record(key, hashes, renderKey, [out]);
    cache.save();
    expect(cache.isFresh(key, hashes, renderKey)).toBe(true);

    // Different intent → miss
    expect(
      cache.isFresh(key, { ...hashes, intentHash: "x".repeat(64) }, renderKey),
    ).toBe(false);
  });

  it("cliVersion mismatch clears cache on load", () => {
    const cache1 = new RenderIRCache(root, "0.0.16");
    const key = cacheEntryKey("a");
    const out = join(root, "a.mp4");
    writeFileSync(out, "x");
    const hashes = {
      intentHash: "i".repeat(64),
      markupHash: "m".repeat(64),
      programHash: "p".repeat(64),
    };
    const rk = computeRenderKey({});
    cache1.record(key, hashes, rk, [out]);
    cache1.save();

    const cache2 = new RenderIRCache(root, "0.0.17");
    expect(cache2.isFresh(key, hashes, rk)).toBe(false);
  });
});
