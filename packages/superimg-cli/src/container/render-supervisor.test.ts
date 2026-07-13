import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";
import { RenderSupervisor } from "./render-supervisor.js";

const workerPath = fileURLToPath(
  new URL("./render-supervisor.test-worker.cjs", import.meta.url),
);

describe("RenderSupervisor", () => {
  let supervisor: RenderSupervisor | undefined;

  afterEach(async () => {
    await supervisor?.close();
    supervisor = undefined;
  });

  it("bounds the queue and replaces a non-cooperative worker", async () => {
    supervisor = new RenderSupervisor({
      concurrency: 1,
      maxQueued: 1,
      cancellationGraceMs: 20,
      workerReadyTimeoutMs: 2_000,
      workerPath,
    });
    await supervisor.start();

    const controller = new AbortController();
    const stuck = supervisor.run<Uint8Array>(
      { type: "render", template: "hang" },
      { signal: controller.signal },
    );
    const queued = supervisor.run<Uint8Array>({ type: "render", template: "next" });
    await expect(
      supervisor.run({ type: "render", template: "overflow" }),
    ).rejects.toMatchObject({ code: "queue_full" });

    controller.abort();
    await expect(stuck).rejects.toMatchObject({ code: "aborted" });
    await expect(queued).resolves.toEqual(new Uint8Array([1, 2, 3]));
  }, 5_000);

  it("expires queued work without dispatching it", async () => {
    supervisor = new RenderSupervisor({
      concurrency: 1,
      maxQueued: 1,
      cancellationGraceMs: 20,
      workerReadyTimeoutMs: 2_000,
      workerPath,
    });
    await supervisor.start();

    const active = supervisor.run<Uint8Array>({ type: "render", template: "active" });
    const queued = supervisor.run<Uint8Array>(
      { type: "render", template: "queued" },
      { deadlineMs: Date.now() + 1 },
    );

    await expect(queued).rejects.toMatchObject({ code: "deadline_exceeded" });
    await expect(active).resolves.toEqual(new Uint8Array([1, 2, 3]));
    expect(supervisor.queuedCount).toBe(0);
  });

  it("hard-stops a worker that ignores its execution deadline", async () => {
    supervisor = new RenderSupervisor({
      concurrency: 1,
      maxQueued: 1,
      cancellationGraceMs: 20,
      workerReadyTimeoutMs: 2_000,
      workerPath,
    });
    await supervisor.start();

    const stuck = supervisor.run<Uint8Array>(
      { type: "render", template: "hang" },
      { deadlineMs: Date.now() + 10 },
    );
    const queued = supervisor.run<Uint8Array>({ type: "render", template: "after-timeout" });

    await expect(stuck).rejects.toMatchObject({ code: "deadline_exceeded" });
    await expect(queued).resolves.toEqual(new Uint8Array([1, 2, 3]));
  }, 5_000);
});
