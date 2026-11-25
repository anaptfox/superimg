import { readFile, access } from "node:fs/promises";
import { createHash } from "node:crypto";
import { expect, it, vi } from "vitest";
import { createRuntime } from "@superimg/core/runtime";
import { svg, MEDIA_ELEMENT, collection, type MediaElement } from "@superimg/types";
import { createNodeRuntimeAdapter } from "../runtime/adapter.js";
import { captureValueReview } from "./review-operation.js";

const element = (type: string, props: Record<string, unknown>, ...children: MediaElement[]): MediaElement => ({ $$typeof: MEDIA_ELEMENT, type, props, children });
it("captures real value pixels with selected clock, hashes and owned disposal", async () => {
  const runtime = createRuntime(createNodeRuntimeAdapter());
  const media = svg({ size: { width: 96, height: 64 }, render: () => element("Vector", { width: "fill", height: "fill", viewBox: { x: 0, y: 0, width: 96, height: 64 } }, element("VectorPath", { d: "M0 0H96V64H0Z", fill: "#663399" })) });
  try {
    const result = await captureValueReview(media, { runtime });
    const frame = result.packet.beats[0]!.evidence[0]!;
    expect(result.packet.visual.status).toBe("unreviewed");
    expect(frame.sha256).toBe(createHash("sha256").update(await readFile(frame.path)).digest("hex"));
    expect((await readFile(frame.path)).subarray(0, 8)).toEqual(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
    await result.dispose();
    await result.dispose();
    await expect(access(frame.path)).rejects.toMatchObject({ code: "ENOENT" });
  } finally { await runtime.dispose(); }
});
it("does not invoke a provider collection during value review", async () => {
  const provider = vi.fn(async () => [{ id: "x" }]);
  const media = collection({ entries: provider, media: svg<{ id: string }>({ render: () => element("Vector", { width: 10, height: 10 }) }) });
  const runtime = createRuntime(createNodeRuntimeAdapter());
  try { await expect(captureValueReview(media, { runtime })).rejects.toThrow(); expect(provider).not.toHaveBeenCalled(); }
  finally { await runtime.dispose(); }
});

it("captures a trusted source and records its compiled bundle identity", async () => {
  const { captureSourceReview } = await import("./review-operation.js");
  const { resolve } = await import("node:path");
  const root = resolve(import.meta.dirname, "../../../..");
  const runtime = createRuntime(createNodeRuntimeAdapter());
  try {
    const result = await captureSourceReview(root, "packages/superimg-cli/src/__fixtures__/svg-text-no-font.media.ts", { runtime });
    expect(result.packet.sourceIdentity).toMatchObject({ mediaBundleHash: expect.stringMatching(/^[a-f0-9]{64}$/) });
    expect(result.packet.coverage.fullFrameCaptures).toBeGreaterThan(0);
    await result.dispose();
  } finally { await runtime.dispose(); }
});
