import { describe, expect, it, vi } from "vitest";
import { bindProjection, directRealizationIds } from "@foxworth/boundary";
import { MEDIA_COMPILED_INTERACTIONS } from "../compiled.js";
import { installMediaInteractions } from "../install.js";
import { projectMediaInteractions } from "../projection.js";
import { createNodeMediaInteractionMount } from "./mount.js";
import { createNodeArrangeHandler } from "./arrange.js";
import { prepareNodeArrangementRequest } from "./prepared-arrangement.js";
import type { NodeMediaRuntimeExport } from "./mount.js";
import type { MediaArrangeStillInteractionInput } from "../contracts.js";

const request = {
  pattern: "aligned-intervals",
  spec: {
    question: "Do events overlap?", workRemoved: "Compare timelines", evidence: "observation",
    size: { width: 1920, height: 1080 }, timeRef: { unit: "s", origin: 0 },
    tracks: [{ id: "a", label: "A", intervals: [{ start: 0, end: 4 }] }, { id: "b", label: "B", intervals: [{ start: 2, end: 8 }] }],
    motion: { phase: "reveal", revealIds: ["b"], predict: "tick" },
  },
};

function setup(failRead = false) {
  const dispose = vi.fn(async () => {});
  const bytes = vi.fn(async () => { if (failRead) throw new Error("read failed"); return new Uint8Array([1, 2, 3]); });
  const exportMedia = vi.fn(async (..._args: Parameters<NodeMediaRuntimeExport>) => ({ artifacts: [{ mimeType: "image/png", sha256: "a".repeat(64), bytes }], dispose }));
  const handler = createNodeArrangeHandler({ runtime: {} as never, exportMedia: exportMedia as unknown as NodeMediaRuntimeExport });
  const call = (input: MediaArrangeStillInteractionInput) => handler({ input } as never);
  return { call, exportMedia, dispose };
}

describe("portable arrangement still handler", () => {
  it("uses host admission on every bound invocation and revokes without rendering", async () => {
    const { exportMedia } = setup();
    const mount = createNodeMediaInteractionMount<{ allowed: boolean }>({
      projectRoot: import.meta.dirname, runtime: {} as never, exportMedia: exportMedia as unknown as NodeMediaRuntimeExport,
    });
    const installed = await installMediaInteractions(mount, {
      installationId: "arrange-bound-consumer", realizationIds: directRealizationIds(MEDIA_COMPILED_INTERACTIONS, "test"),
    });
    const projection = await projectMediaInteractions({ arrange: "direct" });
    const bound = await bindProjection(projection, installed.installation, {
      admit: ({ context }) => context.allowed ? { decision: "allow" } : { decision: "deny", reason: "host denied" },
    });
    if (bound.status !== "bound") throw new Error("expected bound arrangement");
    try {
      const handle = bound.binding.resolve("media.arrange.still")!;
      const input = { request, width: 1920, height: 1080 };
      const client = bound.binding.connect();
      expect(await client.callRaw(handle, input, { allowed: false })).toMatchObject({ certainty: "not-started", result: { kind: "denied" } });
      expect(exportMedia).not.toHaveBeenCalled();
      expect(await client.callRaw(handle, input, { allowed: true })).toMatchObject({ certainty: "completed" });
      expect(exportMedia).toHaveBeenCalledOnce();
      expect(await client.callRaw(handle, { request }, { allowed: true })).toMatchObject({ certainty: "completed", result: { kind: "declared-error", code: "INVALID_INPUT" } });
      expect(exportMedia).toHaveBeenCalledOnce();
      bound.controller.revoke();
      expect(await client.callRaw(handle, input, { allowed: true })).toMatchObject({ certainty: "not-started", result: { kind: "fault", cause: "revoked" } });
      expect(exportMedia).toHaveBeenCalledOnce();
    } finally {
      bound.controller.revoke();
      installed.controller.revoke();
    }
  });

  it("uses the admitted authored media and the pattern poster, with seconds for explicit at", async () => {
    const { call, exportMedia, dispose } = setup();
    await expect(call({ request, width: 1920, height: 1080 })).resolves.toMatchObject({ width: 1920, height: 1080, bytes: "AQID" });
    expect(exportMedia.mock.calls[0]?.[2]).toMatchObject({ at: 4.8, providers: "skip" });
    await call({ request, width: 1920, height: 1080, at: 0.5 });
    expect(exportMedia.mock.calls[1]?.[2]).toMatchObject({ at: 0.5 });
    expect(dispose).toHaveBeenCalledTimes(2);
  });

  it("refuses silent square reflow before rendering, but selects an authored square edition", async () => {
    const { call, exportMedia } = setup();
    await expect(call({ request })).rejects.toMatchObject({ code: "INVALID_INPUT" });
    expect(exportMedia).not.toHaveBeenCalled();
    await call({ request: { ...request, editions: { square: { size: { width: 1080, height: 1080 } } } } });
    expect(exportMedia).toHaveBeenCalledOnce();
    expect(exportMedia.mock.calls[0]?.[1]).toMatchObject({ editions: { square: { size: { width: 1080, height: 1080 } } } });
  });

  it("disposes the bundle after a byte read failure", async () => {
    const { call, dispose } = setup(true);
    await expect(call({ request, width: 1920, height: 1080 })).rejects.toThrow("read failed");
    expect(dispose).toHaveBeenCalledOnce();
  });

  it("preserves byte-read failure and cleanup failure separately", async () => {
    const failed = setup(true);
    failed.dispose.mockRejectedValueOnce(new Error("cleanup failed"));
    await expect(failed.call({ request, width: 1920, height: 1080 })).rejects.toMatchObject({
      cause: { message: "read failed" }, errors: [{ message: "read failed" }, { message: "cleanup failed" }],
    });
    const rendered = setup();
    rendered.dispose.mockRejectedValueOnce(new Error("cleanup failed"));
    await expect(rendered.call({ request, width: 1920, height: 1080 })).rejects.toThrow("bytes rendered but bundle cleanup failed");
  });

  it("prepares supplied bytes without ambient file access, and rejects relative resources", async () => {
    const comparison = {
      pattern: "registered-comparison",
      spec: { question: "What differs?", workRemoved: "Compare states", evidence: "observation", states: [{ id: "a", label: "A", view: { src: "asset:shot" }, provenance: "capture" }, { id: "b", label: "B", view: { src: "asset:shot" }, provenance: "capture" }], frame: { scale: "shared", viewport: { width: 100, height: 100 } }, correspondence: ["object"] },
      assets: [{ id: "shot", mimeType: "image/png", bytes: "AQID" }],
    };
    const prepared = await prepareNodeArrangementRequest(comparison);
    expect(JSON.stringify(prepared.request)).toContain("data:image/png;base64,AQID");
    const relative = { ...comparison, spec: { ...comparison.spec, states: comparison.spec.states.map(state => ({ ...state, view: { src: "shot.png" } })) } };
    const { call, exportMedia } = setup();
    await expect(call({ request: relative })).rejects.toMatchObject({ code: "INVALID_INPUT" });
    expect(exportMedia).not.toHaveBeenCalled();
    const resolver = vi.fn(async () => "data:image/png;base64,AQID");
    const resolved = await prepareNodeArrangementRequest(relative, { resolveSource: resolver });
    expect(resolver).toHaveBeenCalledOnce();
    expect(resolved.identity).toMatch(/^[a-f0-9]{64}$/);
  });
});
