import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const execaMock = vi.hoisted(() => vi.fn());

vi.mock("execa", () => ({ execa: execaMock }));

import { renderDistributed } from "./render-distributed.js";

function infoResponse(totalFrames = 8): Response {
  return Response.json({
    totalFrames,
    fps: 1,
    durationSeconds: totalFrames,
    width: 320,
    height: 180,
  });
}

describe("renderDistributed", () => {
  let directory: string;

  beforeEach(() => {
    directory = mkdtempSync(join(tmpdir(), "superimg-distributed-test-"));
    execaMock.mockReset();
    execaMock.mockImplementation(async (_command: string, args: string[]) => {
      const outputPath = args.at(-1);
      if (!outputPath) throw new Error("missing ffmpeg output path");
      writeFileSync(outputPath, new Uint8Array([9, 8, 7]));
      return { stdout: "", stderr: "" };
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    rmSync(directory, { recursive: true, force: true });
  });

  it("enforces concurrency independently for each endpoint", async () => {
    const active = new Map<string, number>();
    const maximum = new Map<string, number>();
    const fetchMock = vi.fn(async (input: string | URL | Request) => {
      const url = new URL(typeof input === "string" || input instanceof URL ? input : input.url);
      if (url.pathname.startsWith("/info/")) return infoResponse(8);
      const endpoint = url.origin;
      const current = (active.get(endpoint) ?? 0) + 1;
      active.set(endpoint, current);
      maximum.set(endpoint, Math.max(maximum.get(endpoint) ?? 0, current));
      await new Promise((resolve) => setTimeout(resolve, 5));
      active.set(endpoint, current - 1);
      return new Response(new Uint8Array([1, 2, 3]));
    });
    vi.stubGlobal("fetch", fetchMock);

    const outputPath = join(directory, "result.mp4");
    await renderDistributed({
      endpoints: ["https://one.test", "https://two.test"],
      templateName: "demo",
      outputPath,
      chunkSeconds: 1,
      perEndpointConcurrency: 1,
    });

    expect(maximum.get("https://one.test")).toBe(1);
    expect(maximum.get("https://two.test")).toBe(1);
    expect(readFileSync(outputPath)).toEqual(Buffer.from([9, 8, 7]));
    expect(execaMock).toHaveBeenCalledOnce();
  });

  it("cancels sibling endpoint work after a terminal chunk failure", async () => {
    let slowRequestAborted = false;
    const fetchMock = vi.fn(
      async (input: string | URL | Request, init?: RequestInit): Promise<Response> => {
        const url = new URL(typeof input === "string" || input instanceof URL ? input : input.url);
        if (url.pathname.startsWith("/info/")) return infoResponse(4);
        if (url.origin === "https://fail.test") {
          await new Promise((resolve) => setTimeout(resolve, 5));
          return new Response("failed", { status: 500 });
        }
        return await new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () => {
            slowRequestAborted = true;
            reject(init.signal?.reason ?? new Error("aborted"));
          }, { once: true });
        });
      },
    );
    vi.stubGlobal("fetch", fetchMock);

    const outputPath = join(directory, "failed.mp4");
    await expect(renderDistributed({
      endpoints: ["https://fail.test", "https://slow.test"],
      templateName: "demo",
      outputPath,
      chunkSeconds: 1,
    })).rejects.toThrow(/Chunk/);

    expect(slowRequestAborted).toBe(true);
    expect(execaMock).not.toHaveBeenCalled();
    expect(() => readFileSync(outputPath)).toThrow();
  });

  it("rejects oversized chunk responses before invoking ffmpeg", async () => {
    vi.stubGlobal("fetch", vi.fn(async (input: string | URL | Request) => {
      const url = new URL(typeof input === "string" || input instanceof URL ? input : input.url);
      return url.pathname.startsWith("/info/")
        ? infoResponse(1)
        : new Response(new Uint8Array([1, 2, 3, 4]));
    }));

    await expect(renderDistributed({
      endpoints: ["https://one.test"],
      templateName: "demo",
      outputPath: join(directory, "oversized.mp4"),
      maxChunkBytes: 3,
    })).rejects.toThrow(/exceeds 3 bytes/);
    expect(execaMock).not.toHaveBeenCalled();
  });

  it("rejects excessive chunk counts before allocating chunk work", async () => {
    const fetchMock = vi.fn(async () => infoResponse(100));
    vi.stubGlobal("fetch", fetchMock);

    await expect(renderDistributed({
      endpoints: ["https://one.test"],
      templateName: "demo",
      outputPath: join(directory, "too-many.mp4"),
      chunkSeconds: 1,
      maxChunks: 2,
    })).rejects.toThrow(/100 chunks/);
    expect(fetchMock).toHaveBeenCalledOnce();
    expect(execaMock).not.toHaveBeenCalled();
  });
});
