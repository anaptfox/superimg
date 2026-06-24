import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { parseRangeHeader, serveAssetFile } from "./asset-server.js";

describe("parseRangeHeader", () => {
  it("parses bytes=start-end", () => {
    const r = parseRangeHeader("bytes=10-19", 100);
    expect(r).toEqual({ ok: true, range: { start: 10, end: 19 } });
  });

  it("parses open-ended bytes=start-", () => {
    const r = parseRangeHeader("bytes=50-", 100);
    expect(r).toEqual({ ok: true, range: { start: 50, end: 99 } });
  });

  it("parses suffix bytes=-N", () => {
    const r = parseRangeHeader("bytes=-10", 100);
    expect(r).toEqual({ ok: true, range: { start: 90, end: 99 } });
  });

  it("clamps end past file size", () => {
    const r = parseRangeHeader("bytes=90-200", 100);
    expect(r).toEqual({ ok: true, range: { start: 90, end: 99 } });
  });

  it("returns unsatisfiable when start is past EOF", () => {
    const r = parseRangeHeader("bytes=100-", 100);
    expect(r).toEqual({ ok: false, reason: "unsatisfiable" });
  });

  it("returns missing when header absent", () => {
    expect(parseRangeHeader(undefined, 100)).toEqual({ ok: false, reason: "missing" });
  });
});

describe("serveAssetFile", () => {
  let dir: string;
  let filePath: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "superimg-asset-"));
    filePath = join(dir, "clip.mp4");
    writeFileSync(filePath, Buffer.from("0123456789abcdef", "utf8"));
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it("returns full file with Accept-Ranges for mp4", () => {
    const res = serveAssetFile(filePath);
    expect(res.status).toBe(200);
    expect(res.headers["Accept-Ranges"]).toBe("bytes");
    expect(Buffer.from(res.body).toString("utf8")).toBe("0123456789abcdef");
  });

  it("returns 206 partial content for range request", () => {
    const res = serveAssetFile(filePath, "bytes=4-7");
    expect(res.status).toBe(206);
    expect(res.headers["Content-Range"]).toBe("bytes 4-7/16");
    expect(Buffer.from(res.body).toString("utf8")).toBe("4567");
  });
});