import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { randomUUID } from "node:crypto";
import { AssetRegistry, openRegisteredAsset, parseRangeHeader } from "./asset-server.js";

async function readBody(body: NodeJS.ReadableStream | undefined): Promise<string> {
  if (!body) return "";
  const chunks: Buffer[] = [];
  for await (const chunk of body) chunks.push(Buffer.from(chunk));
  return Buffer.concat(chunks).toString("utf8");
}

describe("parseRangeHeader", () => {
  it("parses bounded, open-ended, and suffix ranges", () => {
    expect(parseRangeHeader("bytes=10-19", 100)).toEqual({ ok: true, range: { start: 10, end: 19 } });
    expect(parseRangeHeader("bytes=50-", 100)).toEqual({ ok: true, range: { start: 50, end: 99 } });
    expect(parseRangeHeader("bytes=-10", 100)).toEqual({ ok: true, range: { start: 90, end: 99 } });
  });
  it("rejects multiple, empty-file, and unsatisfiable ranges", () => {
    expect(parseRangeHeader("bytes=0-1,4-5", 100)).toEqual({ ok: false, reason: "invalid" });
    expect(parseRangeHeader("bytes=100-", 100)).toEqual({ ok: false, reason: "unsatisfiable" });
    expect(parseRangeHeader("bytes=0-", 0)).toEqual({ ok: false, reason: "unsatisfiable" });
  });
});

describe("registered asset responses", () => {
  let dir: string;
  let filePath: string;
  let registry: AssetRegistry;
  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "superimg-asset-"));
    filePath = join(dir, "clip.mp4");
    writeFileSync(filePath, Buffer.from("0123456789abcdef", "utf8"));
    registry = new AssetRegistry();
  });
  afterEach(() => rmSync(dir, { recursive: true, force: true }));

  it("deduplicates canonical paths and rejects paths as IDs", () => {
    const id = registry.register(filePath);
    expect(registry.register(filePath)).toBe(id);
    expect(registry.size).toBe(1);
    expect(openRegisteredAsset(registry, filePath).status).toBe(400);
    expect(openRegisteredAsset(registry, randomUUID()).status).toBe(404);
  });
  it("streams only the requested byte range", async () => {
    const response = openRegisteredAsset(registry, registry.register(filePath), { range: "bytes=4-7" });
    expect(response.status).toBe(206);
    expect(response.headers["Content-Length"]).toBe("4");
    expect(response.headers["Content-Range"]).toBe("bytes 4-7/16");
    expect(await readBody(response.body)).toBe("4567");
  });
  it("serves HEAD metadata without opening a body", () => {
    const response = openRegisteredAsset(registry, registry.register(filePath), { method: "HEAD" });
    expect(response.status).toBe(200);
    expect(response.headers["Content-Length"]).toBe("16");
    expect(response.body).toBeUndefined();
  });
  it("forgets every file on cleanup", () => {
    const id = registry.register(filePath);
    registry.clear();
    expect(openRegisteredAsset(registry, id).status).toBe(404);
  });
});
