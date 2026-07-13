import { describe, expect, it, vi } from "vitest";
import {
  RenderExecutionError,
  executionErrorFromSignal,
  type RenderExecutionOptions,
} from "@superimg/types";
import type { RenderSupervisorRequest } from "./render-supervisor.js";
import {
  createContainerApp,
  type ContainerManifest,
  type ContainerRenderQueue,
} from "./app.js";

function manifest(): ContainerManifest {
  return { demo: {} as ContainerManifest[string] };
}

function appWith(
  run: ContainerRenderQueue["run"],
  overrides: Partial<Parameters<typeof createContainerApp>[0]> = {},
) {
  return createContainerApp({
    manifest: manifest(),
    supervisor: { activeCount: 0, queuedCount: 0, run },
    renderTimeoutMs: 1_000,
    cancellationGraceMs: 20,
    maxRequestBytes: 1_024,
    maxOutputBytes: 4_096,
    renderLimits: { maxFrames: 100 },
    getFfmpegVersion: async () => "test",
    ...overrides,
  });
}

describe("container HTTP app", () => {
  it("returns immutable bytes only after a successful supervised render", async () => {
    const run = vi.fn(async () => new Uint8Array([1, 2, 3]));
    const app = appWith(run);
    const response = await app.request("/render", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        template: "demo",
        startFrame: 0,
        endFrame: 1,
        encoding: { format: "webm", audio: { codec: "opus" } },
      }),
    });

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("video/webm");
    expect(response.headers.get("cache-control")).toContain("immutable");
    expect(new Uint8Array(await response.arrayBuffer())).toEqual(new Uint8Array([1, 2, 3]));
    const request = run.mock.calls[0]?.[0] as RenderSupervisorRequest;
    expect(request.type).toBe("render");
    if (request.type === "render") {
      expect(request.encoding).toEqual({ format: "webm" });
      expect(request.maxOutputBytes).toBe(4_096);
    }
  });

  it("rejects oversized request bodies before queue admission", async () => {
    const run = vi.fn(async () => new Uint8Array());
    const app = appWith(run, { maxRequestBytes: 16 });
    const response = await app.request("/render", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ template: "demo", data: { value: "too large" } }),
    });

    expect(response.status).toBe(413);
    expect(await response.json()).toMatchObject({ error: "resource_limit" });
    expect(run).not.toHaveBeenCalled();
  });

  it("maps queue saturation and deadlines to service HTTP statuses", async () => {
    const queueFull = appWith(async () => {
      throw new RenderExecutionError("queue_full", "full");
    });
    const timeout = appWith(async () => {
      throw new RenderExecutionError("deadline_exceeded", "late");
    });
    const init = {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ template: "demo" }),
    };

    expect((await queueFull.request("/render", init)).status).toBe(503);
    expect((await timeout.request("/render", init)).status).toBe(504);
  });

  it("propagates client disconnect cancellation into supervised work", async () => {
    let started!: () => void;
    const workStarted = new Promise<void>((resolve) => { started = resolve; });
    let receivedSignal: AbortSignal | undefined;
    const run = async <T>(
      _request: RenderSupervisorRequest,
      options: RenderExecutionOptions = {},
    ): Promise<T> => {
      receivedSignal = options.signal;
      started();
      return await new Promise<T>((_resolve, reject) => {
        options.signal?.addEventListener("abort", () => {
          reject(executionErrorFromSignal(options.signal));
        }, { once: true });
      });
    };
    const app = appWith(run);
    const controller = new AbortController();
    const request = new Request("http://container.test/render", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ template: "demo" }),
      signal: controller.signal,
    });
    const responsePromise = app.fetch(request);
    await workStarted;
    controller.abort();
    const response = await responsePromise;

    expect(receivedSignal?.aborted).toBe(true);
    expect(response.status).toBe(499);
  });
});
