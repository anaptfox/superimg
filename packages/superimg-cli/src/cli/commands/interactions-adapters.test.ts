import { googleFont } from "@foxworth/superimg";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createCliMediaInteractionSession: vi.fn(),
  dispatch: vi.fn(),
  dispose: vi.fn(),
  findProjectRoot: vi.fn(() => "/project"),
  resolveTemplatePath: vi.fn(() => "/project/card.media.ts"),
  resolveTemplatePathOrSole: vi.fn(() => "/project/card.media.ts"),
}));

vi.mock("../utils/media-interactions.js", () => ({
  createCliMediaInteractionSession: mocks.createCliMediaInteractionSession,
}));

vi.mock("../utils/find-project-root.js", () => ({
  findProjectRoot: mocks.findProjectRoot,
}));

vi.mock("../utils/resolve-template.js", () => ({
  resolveTemplatePath: mocks.resolveTemplatePath,
  resolveTemplatePathOrSole: mocks.resolveTemplatePathOrSole,
}));

import { MEDIA_COMPILED_INTERACTIONS } from "@foxworth/superimg-interactions";
import { discoverCommand } from "./discover.js";
import { compileCommand } from "./compile.js";
import { exportCommand } from "./export.js";
import { infoCommand } from "./info.js";
import { listCommand } from "./list.js";

const description = {
  schemaVersion: 0,
  kind: "media-source-description",
  sourceId: "card",
  relativePath: "card.media.ts",
  sourceKind: "media",
  programHash: "a".repeat(64),
  media: "video",
  medium: "html",
  animated: true,
  canvas: { width: 1280, height: 720 },
  fps: 24,
  duration: 2,
  totalFrames: 48,
  temporal: "once",
  fonts: [googleFont("Inter")],
  phases: [{
    name: "intro",
    start: 0,
    end: 0.5,
    startSeconds: 0,
    endSeconds: 1,
  }],
  editions: [{ id: "square", width: 1080, height: 1080 }],
  variantIds: ["dark"],
  editionIds: ["default", "square"],
} as const;

beforeEach(() => {
  mocks.dispatch.mockReset();
  mocks.dispose.mockReset().mockResolvedValue(undefined);
  mocks.createCliMediaInteractionSession.mockReset().mockReturnValue({
    mount: {
      dispatch: mocks.dispatch,
    },
    dispose: mocks.dispose,
  });
  mocks.findProjectRoot.mockClear();
  mocks.resolveTemplatePath.mockClear();
  mocks.resolveTemplatePathOrSole.mockClear();
  vi.spyOn(console, "log").mockImplementation(() => undefined);
  vi.spyOn(console, "warn").mockImplementation(() => undefined);
  vi.spyOn(process.stdout, "write").mockImplementation(() => true);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("CLI interaction adapters", () => {
  it("projects discovery receipts into the established discover JSON shape", async () => {
    mocks.dispatch.mockResolvedValue({
      sources: [{
        sourceId: "nested/card",
        relativePath: "nested/card.media.ts",
        sourceKind: "media-module",
      }],
    });

    await discoverCommand({ json: true });

    expect(mocks.dispatch).toHaveBeenCalledWith({
      interactionId: "media.project.discover",
      input: {},
    }, {});
    expect(mocks.dispose).toHaveBeenCalledOnce();
    const value = JSON.parse(String(vi.mocked(console.log).mock.calls[0]?.[0]));
    expect(value).toEqual([expect.objectContaining({
      name: "nested/card",
      shortName: "card",
      relativePath: "nested/card.media.ts",
    })]);
  });

  it("builds rich list JSON solely from discover and describe receipts", async () => {
    mocks.dispatch.mockImplementation(async (request: { interactionId: string }) => {
      if (request.interactionId === "media.project.discover") {
        return {
          sources: [{
            sourceId: "card",
            relativePath: "card.media.ts",
            sourceKind: "media-module",
          }],
        };
      }
      return description;
    });

    await listCommand({ json: true });

    expect(mocks.dispatch).toHaveBeenCalledTimes(2);
    expect(mocks.dispatch).toHaveBeenLastCalledWith({
      interactionId: "media.source.describe",
      input: { source: "card.media.ts" },
    }, {});
    expect(mocks.dispose).toHaveBeenCalledOnce();
    const value = JSON.parse(String(vi.mocked(console.log).mock.calls[0]?.[0]));
    expect(value.media[0]).toMatchObject({
      name: "card",
      kind: "video",
      config: "1280x720 24fps",
      variants: [{ id: "dark" }],
      editions: [{ id: "square", width: 1080, height: 1080 }],
      fonts: [googleFont("Inter")],
    });
  });

  it("keeps shallow list on the discovery interaction only", async () => {
    mocks.dispatch.mockResolvedValue({
      sources: [{
        sourceId: "card",
        relativePath: "card.media.ts",
        sourceKind: "media-module",
      }],
    });

    await listCommand({ shallow: true, json: true });

    expect(mocks.dispatch).toHaveBeenCalledTimes(1);
    expect(mocks.dispatch).toHaveBeenCalledWith({
      interactionId: "media.project.discover",
      input: {},
    }, {});
    expect(mocks.dispose).toHaveBeenCalledOnce();
    expect(JSON.parse(String(vi.mocked(console.log).mock.calls[0]?.[0]))).toEqual([
      "card.media.ts",
    ]);
  });

  it("formats info directly from the describe receipt", async () => {
    mocks.dispatch.mockResolvedValue(description);

    await infoCommand("card", { json: true });

    expect(mocks.dispatch).toHaveBeenCalledWith({
      interactionId: "media.source.describe",
      input: { source: "card.media.ts" },
    }, {});
    expect(mocks.dispose).toHaveBeenCalledOnce();
    const value = JSON.parse(String(vi.mocked(console.log).mock.calls[0]?.[0]));
    expect(value).toMatchObject({
      source: "runtime",
      config: { width: 1280, height: 720, fps: 24, duration: 2 },
      totalFrames: 48,
      phases: [{ name: "intro", startSec: 0, endSec: 1 }],
    });
  });

  it("compiles through the artifact interaction with a logical target", async () => {
    mocks.dispatch
      .mockResolvedValueOnce(description)
      .mockResolvedValueOnce({
        schemaVersion: 0,
        kind: "media-artifact",
        targetId: "project-artifacts",
        artifactId: "card.superimg",
        artifactHash: "b".repeat(64),
        programHash: "c".repeat(64),
        intentHash: "d".repeat(64),
        markupHash: "e".repeat(64),
        coordinates: { sourceId: "card", variantId: "default", editionId: "default" },
        manifest: {},
      });

    await compileCommand("card", { json: true, verify: true });

    expect(mocks.dispatch).toHaveBeenNthCalledWith(2, {
      interactionId: "media.artifact.compile",
      input: {
        source: "card.media.ts",
        target: { targetId: "project-artifacts", artifactId: "card.superimg" },
        verify: true,
        strict: false,
      },
    }, {});
    expect(mocks.dispose).toHaveBeenCalledOnce();
  });

  it("snapshots a collection before invoking export and preserves CLI policies", async () => {
    const snapshot = {
      schemaVersion: 0,
      kind: "media-collection-snapshot",
      source: "card.media.ts",
      sourceId: "card",
      providerHash: "b".repeat(64),
      snapshotDigest: "c".repeat(64),
      entries: [{ id: "one", data: { id: "one" }, dataDigest: "d".repeat(64) }],
    } as const;
    const exportReceipt = {
      schemaVersion: 0,
      targetId: "project-output",
      publicationId: "card.export",
      manifestDigest: "e".repeat(64),
      manifest: {},
    };
    mocks.dispatch.mockImplementation(async (request: { interactionId: string }) => {
      if (request.interactionId === "media.source.describe") {
        return { ...description, sourceKind: "collection" };
      }
      if (request.interactionId === "media.collection.snapshot") return snapshot;
      return exportReceipt;
    });
    mocks.resolveTemplatePathOrSole.mockReturnValue("/project/card.media.ts");

    const result = await exportCommand("card", {
      for: ["youtube"],
      entry: ["one"],
      variant: ["dark"],
      edition: ["square"],
      poster: true,
      rasterizer: "blitz",
      quality: "high",
      dpr: "2",
      timeout: "3",
      providerTimeout: "1.5",
      json: true,
    });

    expect(result).toBe(exportReceipt);
    expect(mocks.dispatch).toHaveBeenCalledTimes(3);
    expect(mocks.dispatch.mock.calls[1]?.[0]).toEqual({
      interactionId: "media.collection.snapshot",
      input: { source: "card.media.ts" },
    });
    expect(mocks.dispatch.mock.calls[1]?.[1]).toEqual({
      timeoutMs: 3_000,
      providerTimeoutMs: 1_500,
    });
    expect(mocks.dispatch.mock.calls[2]?.[0]).toMatchObject({
      interactionId: "media.export",
      input: {
        source: "card.media.ts",
        publication: {
          targetId: "project-output",
          publicationId: "card.export",
        },
        destinations: ["youtube"],
        entryIds: ["one"],
        variantIds: ["dark"],
        editionIds: ["square"],
        snapshot,
        stillFrame: { kind: "poster" },
        rasterizer: "blitz",
        encoding: {
          video: { quality: "high" },
          capture: { dpr: 2 },
        },
      },
    });
    expect(mocks.dispatch.mock.calls[2]?.[1]).toEqual({
      timeoutMs: 3_000,
      providerTimeoutMs: 1_500,
    });
    expect(mocks.dispose).toHaveBeenCalledOnce();
  });

  it("prints a non-executing direct projection without snapshotting a provider", async () => {
    mocks.dispatch.mockResolvedValue({ ...description, sourceKind: "collection" });

    await exportCommand("card", {
      for: ["1200x630.png"],
      dryRun: true,
      json: true,
    });

    expect(mocks.dispatch).toHaveBeenCalledTimes(1);
    const line = String(vi.mocked(process.stdout.write).mock.calls[0]?.[0]);
    const value = JSON.parse(line);
    expect(value).toMatchObject({
      schemaVersion: 1,
      kind: "media-interaction-projection",
      dryRun: true,
      mode: "direct",
      execution: "not-run",
      path: "/project/output/card.export",
      interaction: {
        programDigest: MEDIA_COMPILED_INTERACTIONS.program.programDigest,
        interactionId: MEDIA_COMPILED_INTERACTIONS.handles.export.interactionId,
        contractDigest: MEDIA_COMPILED_INTERACTIONS.handles.export.contractDigest,
        input: {
          source: "card.media.ts",
          publication: {
            targetId: "project-output",
            publicationId: "card.export",
          },
          destinations: ["1200x630.png"],
        },
      },
      deferred: { provider: true, publication: true },
    });
    expect(value).not.toHaveProperty("proposal");
    expect(value.interaction.input).not.toHaveProperty("snapshot");
    expect(mocks.dispose).toHaveBeenCalledOnce();
  });

  it("disposes the explicit value runtime when a direct export fails", async () => {
    mocks.dispatch
      .mockResolvedValueOnce(description)
      .mockRejectedValueOnce(new Error("preflight failed"));

    await expect(exportCommand("card", {
      for: ["youtube"],
    })).rejects.toThrow(/preflight failed/);

    expect(mocks.dispose).toHaveBeenCalledOnce();
  });
});
