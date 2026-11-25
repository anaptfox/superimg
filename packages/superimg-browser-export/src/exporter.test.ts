import { describe, expect, it, vi } from "vitest";
import type { MediaSession } from "@superimg/media";
import { createBrowserExporter } from "./exporter.js";
import type { BrowserCaptureBackend } from "./capture.js";

describe("createBrowserExporter", () => {
  it("renders the requested MediaSession frame before capture", async () => {
    const element = document.createElement("div");
    const session = {
      renderFrame: vi.fn(async (frame: number) => ({
        frame,
        html: "",
        compositeHtml: "",
        graph: { nodes: [], deterministicClips: [], externalEmbeds: [] },
      })),
      getSurface: () => ({
        kind: "dom",
        getElement: () => element,
      }),
    } as unknown as MediaSession;
    const backend: BrowserCaptureBackend = {
      warmup: vi.fn(),
      capture: vi.fn(async () => new ImageData(4, 3)),
    };

    const exporter = createBrowserExporter(session, {
      width: 4,
      height: 3,
      backend,
    });
    const frame = await exporter.captureFrame(7);

    expect(frame.width).toBe(4);
    expect(session.renderFrame).toHaveBeenCalledWith(7);
    expect(backend.capture).toHaveBeenCalledWith(element, {
      width: 4,
      height: 3,
      invalidate: true,
    });
  });

  it("forwards capture fidelity and region options", async () => {
    const element = document.createElement("div");
    const session = {
      renderFrame: vi.fn(async () => ({ frame: 0, html: "", compositeHtml: "", graph: { nodes: [], deterministicClips: [], externalEmbeds: [] } })),
      getSurface: () => ({ kind: "dom", getElement: () => element }),
    } as unknown as MediaSession;
    const backend: BrowserCaptureBackend = {
      warmup: vi.fn(),
      capture: vi.fn(async () => new ImageData(4, 3)),
    };

    const exporter = createBrowserExporter(session, {
      width: 4,
      height: 3,
      dpr: 1,
      scale: 2,
      quality: 0.8,
      region: { x: 1, y: 2, width: 3, height: 2 },
      reconcile: true,
      burst: true,
      backend,
    });
    await exporter.captureFrame(0);

    expect(backend.capture).toHaveBeenCalledWith(element, {
      width: 4,
      height: 3,
      dpr: 1,
      scale: 2,
      quality: 0.8,
      region: { x: 1, y: 2, width: 3, height: 2 },
      reconcile: true,
      burst: true,
      invalidate: true,
    });
  });
});

describe("artifact export ownership", () => {
  function mountedSession() {
    const element = document.createElement("div");
    let rendered = -1;
    const session = {
      renderFrame: vi.fn(async (frame: number) => { rendered = frame; return {}; }),
      getSurface: () => ({ kind: "dom", getElement: () => element }),
    } as unknown as MediaSession;
    return { session, rendered: () => rendered };
  }

  it("serializes render and artifact capture with concurrent pixel captures", async () => {
    const { session, rendered } = mountedSession();
    const blob = new Blob(["artifact"]);
    let release!: () => void;
    const firstCapture = new Promise<void>(resolve => { release = resolve; });
    const backend: BrowserCaptureBackend = {
      warmup: vi.fn(),
      capture: vi.fn(async () => { expect(rendered()).toBe(1); await firstCapture; expect(rendered()).toBe(1); return new ImageData(4, 3); }),
      captureArtifact: vi.fn(async () => { expect(rendered()).toBe(2); return blob; }),
      dispose: vi.fn(async () => {}),
    };
    const exporter = createBrowserExporter(session, { width: 4, height: 3, backend });
    const frame = exporter.captureFrame(1);
    const artifact = exporter.captureArtifact(2, { format: "webp" });
    await vi.waitFor(() => expect(backend.capture).toHaveBeenCalledTimes(1));
    expect(session.renderFrame).toHaveBeenCalledTimes(1);
    release();
    await frame;
    expect(await artifact).toBe(blob);
    expect(backend.captureArtifact).toHaveBeenCalledWith(expect.any(HTMLElement), { width: 4, height: 3, invalidate: true, format: "webp" });
    await exporter.dispose();
    expect(backend.dispose).not.toHaveBeenCalled();
    expect(blob.size).toBe(8);
  });

  it("waits for in-flight work and prevents queued renders after disposal", async () => {
    const { session } = mountedSession();
    let release!: () => void;
    const pending = new Promise<void>(resolve => { release = resolve; });
    const backend: BrowserCaptureBackend = {
      warmup: vi.fn(), capture: vi.fn(async () => { await pending; return new ImageData(4, 3); }),
      captureArtifact: vi.fn(async () => new Blob()),
    };
    const exporter = createBrowserExporter(session, { width: 4, height: 3, backend });
    const active = exporter.captureFrame(1);
    const activeRejected = expect(active).rejects.toThrow(/disposed/);
    await vi.waitFor(() => expect(backend.capture).toHaveBeenCalled());
    const queued = exporter.captureArtifact(2);
    const queuedRejected = expect(queued).rejects.toThrow(/disposed/);
    const disposal = exporter.dispose();
    let repeatedDisposalFinished = false;
    const repeatedDisposal = exporter.dispose().then(() => { repeatedDisposalFinished = true; });
    await Promise.resolve();
    expect(repeatedDisposalFinished).toBe(false);
    release();
    await Promise.all([activeRejected, queuedRejected, disposal, repeatedDisposal]);
    expect(session.renderFrame).toHaveBeenCalledTimes(1);
    expect(backend.captureArtifact).not.toHaveBeenCalled();
    await expect(exporter.captureArtifact(3)).rejects.toThrow(/disposed/);
  });

  it("recovers the capture queue after one rejected artifact", async () => {
    const { session } = mountedSession();
    const backend: BrowserCaptureBackend = {
      warmup: vi.fn(), capture: vi.fn(async () => new ImageData(4, 3)),
      captureArtifact: vi.fn(async () => { throw new Error("encoding failed"); }),
    };
    const exporter = createBrowserExporter(session, { width: 4, height: 3, backend });
    await expect(exporter.captureArtifact(1)).rejects.toThrow("encoding failed");
    expect((await exporter.captureFrame(2)).width).toBe(4);
  });

  it("rejects unsupported custom backends before rendering a frame", async () => {
    const { session } = mountedSession();
    const backend: BrowserCaptureBackend = { warmup: vi.fn(), capture: vi.fn() };
    const exporter = createBrowserExporter(session, { width: 4, height: 3, backend });
    await expect(exporter.captureArtifact(1)).rejects.toThrow(/does not support/);
    expect(session.renderFrame).not.toHaveBeenCalled();
  });
});
