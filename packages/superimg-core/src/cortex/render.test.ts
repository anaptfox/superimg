import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import type { CortexBundle, MediaRuntimeCapabilities } from "@superimg/types";
import { createRuntime, type RuntimeAdapter } from "../runtime/index.js";
import { readByteStream } from "../runtime/bytes.js";
import { cortexArtifactRecord, CortexNoViewError, planCortexRender, startCortexExport } from "./render.js";

const capabilities: MediaRuntimeCapabilities = Object.freeze({
  schemaVersion: 0,
  check: true,
  inspect: true,
  documents: Object.freeze(["html", "svg"] as const),
  rasters: Object.freeze(["png", "jpeg", "webp"] as const),
  animated: Object.freeze(["mp4", "webm", "gif"] as const),
  collections: Object.freeze({ static: true, providers: true }),
  assets: Object.freeze({ url: true, bytes: true }),
  fonts: Object.freeze({ logical: true, frozenBytes: true }),
});

function sha256(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}

function fakeAdapter(bytes: Uint8Array = new Uint8Array([1, 2, 3, 4])): RuntimeAdapter {
  return {
    abi: "superimg-runtime-test-v0",
    capabilities,
    async inspect() {
      return { metadata: {} };
    },
    async resolveCollectionEntries({ collection }) {
      if (typeof collection.entries !== "function") return collection.entries;
      return await collection.entries();
    },
    async preflight() {
      return { findings: [], assets: [], fonts: [], dispose() {} };
    },
    async render(request) {
      return {
        as: request.options.as,
        mimeType: "image/png",
        coordinates: request.selection.coordinates,
        bytes,
      };
    },
    async exportMedia() {
      return {
        coordinates: [{ variantId: "default", editionId: "default" }],
        artifacts: [{
          path: "card.png",
          mimeType: "image/png",
          coordinates: { variantId: "default", editionId: "default", renditionId: "card" },
          bytes,
        }],
      };
    },
    async dispose() {},
  };
}

const launchBundle: CortexBundle = {
  brief: {
    question: "How did yesterday's launch go?",
    intent: "decision_support",
    audience: "owner",
  },
  atoms: [
    { kind: "event", at: "10:05", label: "LAUNCH" },
    { kind: "metric", label: "traffic", value: 430, unit: "%" },
    { kind: "event", at: "14:22", label: "hotfix" },
  ],
  evidence: [{ id: "sentry-812", source: "sentry", label: "Sentry #812" }],
};

describe("planCortexRender", () => {
  it("plans an event-story without creating a snapshot", () => {
    const plan = planCortexRender(launchBundle);
    expect(plan.match.viewId).toBe("event-story");
    expect(plan.data.headline).toBe("How did yesterday's launch go?");
    expect(cortexArtifactRecord(plan)).toEqual({
      viewId: "event-story",
      reason: plan.match.reason,
    });
  });

  it("does not invent a view for opaque custom data", () => {
    expect(() =>
      planCortexRender({
        brief: { question: "bench?", intent: "status", audience: "owner" },
        atoms: [],
        custom: { kind: "fox.superimg.render-benchmark/v2", data: {} },
      }),
    ).toThrow(CortexNoViewError);
  });
});

const metricsBundle: CortexBundle = {
  brief: {
    question: "How are we doing?",
    intent: "status",
    audience: "owner",
  },
  atoms: [
    { kind: "metric", label: "users", value: 512 },
    { kind: "metric", label: "revenue", value: 1640, unit: "USD" },
  ],
};

describe("startCortexExport", () => {
  it("exports a launch bundle as event-story without remembering", async () => {
    const payload = new Uint8Array([9, 8, 7, 6, 5]);
    const plan = planCortexRender(launchBundle);
    const record = cortexArtifactRecord(plan);
    expect(record.viewId).toBe("event-story");
    expect(record).not.toHaveProperty("remembered");
    expect(record).not.toHaveProperty("snapshotId");

    const job = startCortexExport(createRuntime(fakeAdapter(payload)), launchBundle, {
      for: ["1200x630.png"],
      at: 0,
    });
    const exported = await job.result;
    expect(job.state).toBe("succeeded");
    const artifact = exported.artifacts[0];
    expect(artifact).toBeDefined();
    const opened = await readByteStream(artifact!.stream());
    expect(opened).toEqual(payload);
    expect(artifact!.sha256).toBe(sha256(opened));
    expect(artifact!.byteLength).toBe(payload.byteLength);
    await exported.dispose();
  });

  it("exports a metrics-only bundle as daily-project-report", async () => {
    const payload = new Uint8Array([11, 22, 33]);
    const plan = planCortexRender(metricsBundle);
    expect(cortexArtifactRecord(plan).viewId).toBe("daily-project-report");
    const job = startCortexExport(createRuntime(fakeAdapter(payload)), metricsBundle, {
      for: ["1200x630.png"],
      at: 0,
    });
    const exported = await job.result;
    const artifact = exported.artifacts[0];
    const opened = await readByteStream(artifact!.stream());
    expect(artifact!.sha256).toBe(sha256(opened));
    expect(opened).toEqual(payload);
    await exported.dispose();
  });

  it("refuses opaque custom data instead of inventing a chart", async () => {
    expect(() =>
      startCortexExport(
        createRuntime(fakeAdapter()),
        {
          brief: { question: "bench?", intent: "status", audience: "owner" },
          atoms: [],
          custom: { kind: "fox.superimg.render-benchmark/v2", data: {} },
        },
        { for: ["1200x630.png"], at: 0 },
      ),
    ).toThrow(CortexNoViewError);
  });
});
