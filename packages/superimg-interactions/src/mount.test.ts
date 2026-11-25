import { describe, expect, it, vi } from "vitest";
import { validateProgram } from "@foxworth/boundary/program";
import {
  MEDIA_COMPILED_INTERACTIONS,
  MEDIA_INTERACTION_IDS,
  MediaInteractionError,
  MediaInteractionUncertainError,
  createMediaInteractionMount,
  type MediaInteractionHandlers,
  type MediaInteractionProgressRecord,
} from "./index.js";

const HASH = "a".repeat(64);

type TestContext = Readonly<{ actor: string }>;

function handlers(): MediaInteractionHandlers<TestContext> {
  return {
    discover: vi.fn(() => ({
      schemaVersion: 0,
      kind: "media-project-discovery",
      sources: [
        {
          sourceId: "launch",
          relativePath: "launch.media.ts",
          sourceKind: "media-module",
        },
      ],
    } as const)),
    describe: vi.fn(({ input }) => ({
      schemaVersion: 0,
      kind: "media-source-description",
      sourceId: input.source,
      relativePath: `${input.source}.media.ts`,
      sourceKind: "media",
      programHash: HASH,
      media: "video",
      medium: "html",
      animated: true,
      canvas: { width: 1920, height: 1080 },
      fps: 30,
      duration: 5,
      totalFrames: 150,
      temporal: "once",
      fonts: [],
      phases: [],
      editions: [],
      variantIds: [],
      editionIds: [],
    } as const)),
    check: vi.fn(({ input }) => ({
      schemaVersion: 0,
      kind: "media-source-check",
      sourceId: input.source,
      relativePath: `${input.source}.media.ts`,
      programHash: HASH,
      report: {
        schemaVersion: 0,
        ok: true,
        programDigest: HASH,
        kind: "video",
        coordinates: [{ variantId: "default", editionId: "default" }],
        findings: [],
      },
    } as const)),
    inspect: vi.fn(({ input }) => ({
      schemaVersion: 0,
      kind: "media-source-inspection",
      sourceId: input.source,
      relativePath: `${input.source}.media.ts`,
      programHash: HASH,
      report: {
        schemaVersion: 0,
        programDigest: HASH,
        kind: "video",
        coordinates: [{ variantId: "default", editionId: "default" }],
        findings: [],
        assets: [],
        fonts: [],
      },
    } as const)),
    snapshot: vi.fn(({ input }) => ({
      schemaVersion: 0,
      kind: "media-collection-snapshot",
      source: input.source,
      sourceId: input.source,
      providerHash: HASH,
      snapshotDigest: HASH,
      entries: [{ id: "one", data: { title: "One" }, dataDigest: HASH }],
    } as const)),
    compile: vi.fn(({ input }) => ({
      schemaVersion: 0,
      kind: "media-artifact",
      targetId: input.target.targetId,
      artifactId: input.target.artifactId,
      artifactHash: HASH,
      programHash: HASH,
      intentHash: HASH,
      markupHash: HASH,
      coordinates: {
        sourceId: input.source,
        variantId: "default",
        editionId: "default",
      },
      manifest: { kind: "@foxworth/superimg/artifact", schemaVersion: 0 },
    } as const)),
    thumbnail: vi.fn(({ input }) => ({
      bytes: "AAAAAAABAAEAAAAA",
      width: Math.min(input.maxWidth, 8),
      height: 1,
    } as const)),
    arrange: vi.fn(({ input }) => ({
      mimeType: "image/png",
      bytes: "AAAAAAABAAEAAAAA",
      width: input.width ?? 1080,
      height: input.height ?? 1080,
      sha256: "a".repeat(64),
    } as const)),
    export: vi.fn(({ input }) => ({
      schemaVersion: 0,
      targetId: input.publication.targetId,
      publicationId: input.publication.publicationId,
      manifestDigest: HASH,
      manifest: {
        schemaVersion: 0,
        kind: "media-export",
        destinations: input.destinations,
      },
    } as const)),
  };
}

describe("media compiled interactions", () => {
  it("rejects legacy execution identity before native effects", async () => {
    const hostHandlers = handlers();
    const mount = createMediaInteractionMount({
      handlers: hostHandlers,
      progress() {
        throw Object.assign(new Error("Historical execution requires new bindings and approvals"), {
          code: "LEGACY_EXECUTION_IDENTITY",
        });
      },
    });
    await expect(mount.dispatch({
      interactionId: MEDIA_INTERACTION_IDS.export,
      input: { source: "launch", destinations: ["youtube"], publication: { targetId: "delivery", publicationId: "launch" } },
    }, { actor: "host" })).rejects.toMatchObject({ code: "LEGACY_EXECUTION_IDENTITY" });
    expect(hostHandlers.export).not.toHaveBeenCalled();
    await expect(mount.dispatch({
      operationId: MEDIA_INTERACTION_IDS.export,
      input: {},
    } as never, { actor: "host" })).rejects.toMatchObject({ code: "UNKNOWN_INTERACTION" });
    expect(hostHandlers.export).not.toHaveBeenCalled();
  });

  it("is a valid live Program with compiled handles", async () => {
    expect(await validateProgram(MEDIA_COMPILED_INTERACTIONS.program)).toEqual(
      MEDIA_COMPILED_INTERACTIONS.program,
    );
    expect(
      MEDIA_COMPILED_INTERACTIONS.program.interactions.map((value) => value.contract.id),
    ).toEqual([
      MEDIA_INTERACTION_IDS.arrange,
      MEDIA_INTERACTION_IDS.compile,
      MEDIA_INTERACTION_IDS.thumbnail,
      MEDIA_INTERACTION_IDS.snapshot,
      MEDIA_INTERACTION_IDS.export,
      MEDIA_INTERACTION_IDS.narrationPrepare,
      MEDIA_INTERACTION_IDS.narrationReview,
      MEDIA_INTERACTION_IDS.discover,
      MEDIA_INTERACTION_IDS.check,
      MEDIA_INTERACTION_IDS.describe,
      MEDIA_INTERACTION_IDS.inspect,
      MEDIA_INTERACTION_IDS.speechSynthesize,
      MEDIA_INTERACTION_IDS.speechVoices,
    ]);
    expect(MEDIA_COMPILED_INTERACTIONS.handles.discover.interactionId).toBe(
      MEDIA_INTERACTION_IDS.discover,
    );
    expect(
      MEDIA_COMPILED_INTERACTIONS.program.interactions.some((value) =>
        value.contract.id.startsWith("control."),
      ),
    ).toBe(false);
  });
});

describe("direct media interaction mount", () => {
  it("accepts technical coverage on both reports while rejecting invented visual approval", async () => {
    const base = handlers();
    const coverage = { samples: [{ frame: 0, progress: 0 }], checks: [{ id: "tree-paint", scope: "frame" as const, frames: [0] }], geometry: { sourceEstimatedNodes: 3, fontMeasuredNodes: 1, browserMeasuredNodes: 0, opaqueRegions: 1 }, unsupported: ["media-tree-unavailable"], visual: "unreviewed" as const };
    const mount = createMediaInteractionMount({ handlers: { ...base,
      check: async (request) => { const value = await base.check(request); return { ...value, report: { ...value.report, coverage } }; },
      inspect: async (request) => { const value = await base.inspect(request); return { ...value, report: { ...value.report, coverage } }; },
    } });
    for (const interactionId of [MEDIA_INTERACTION_IDS.check, MEDIA_INTERACTION_IDS.inspect]) {
      await expect(mount.dispatch({ interactionId, input: { source: "launch" } }, { actor: "cli" })).resolves.toMatchObject({ report: { coverage } });
    }
    const invalid = createMediaInteractionMount({ handlers: { ...base,
      check: async (request) => { const value = await base.check(request); return { ...value, report: { ...value.report, coverage: { ...coverage, visual: "approved" as "unreviewed" } } }; },
    } });
    await expect(invalid.dispatch({ interactionId: MEDIA_INTERACTION_IDS.check, input: { source: "launch" } }, { actor: "cli" })).rejects.toThrow(/contract/);
  });

  it("validates and dispatches direct interactions without authority state", async () => {
    const hostHandlers = handlers();
    const mount = createMediaInteractionMount({ handlers: hostHandlers });
    expect(Object.keys(mount)).toEqual(["dispatch"]);
    await expect(
      mount.dispatch(
        {
          interactionId: MEDIA_INTERACTION_IDS.describe,
          input: { source: "launch" },
        },
        { actor: "cli" },
      ),
    ).resolves.toMatchObject({ sourceId: "launch", animated: true });
    await expect(
      mount.dispatch(
        {
          interactionId: MEDIA_INTERACTION_IDS.describe,
          input: { source: "" },
        },
        { actor: "cli" },
      ),
    ).rejects.toMatchObject({ code: "INVALID_INPUT" });
    expect(hostHandlers.describe).toHaveBeenCalledTimes(1);
  });

  it("wraps validated direct execution in interaction progress", async () => {
    const records: MediaInteractionProgressRecord[] = [];
    const hostHandlers = handlers();
    const mount = createMediaInteractionMount({
      handlers: hostHandlers,
      progress: ({ context, interactionId }) => {
        expect(context).toEqual({ actor: "cli" });
        expect(interactionId).toBe(MEDIA_INTERACTION_IDS.describe);
        return {
          executionId: "describe:launch",
          attemptId: "attempt-1",
          observer: { append: (record) => { records.push(record); } },
        };
      },
    });

    await expect(mount.dispatch(
      {
        interactionId: MEDIA_INTERACTION_IDS.describe,
        input: { source: "launch" },
      },
      { actor: "cli" },
    )).resolves.toMatchObject({ sourceId: "launch" });

    expect(records.map(({ sequence, state }) => ({ sequence, state }))).toEqual([
      { sequence: 0, state: "started" },
      { sequence: 1, state: "succeeded" },
    ]);
    expect(records[0]?.interaction).toMatchObject({
      executionId: "describe:launch",
      attemptId: "attempt-1",
      programDigest: MEDIA_COMPILED_INTERACTIONS.program.programDigest,
      interactionId: MEDIA_INTERACTION_IDS.describe,
      contractDigest: MEDIA_COMPILED_INTERACTIONS.handles.describe.contractDigest,
    });
    expect(hostHandlers.describe).toHaveBeenCalledWith(expect.objectContaining({
      progress: expect.objectContaining({ report: expect.any(Function) }),
    }));
  });

  it("classifies host and runtime cancellation as cancelled progress", async () => {
    for (const { name, code } of [
      { name: "AbortError" },
      { name: "TimeoutError" },
      { name: "RuntimeCancelledError", code: "RUNTIME_CANCELLED" },
    ]) {
      const records: MediaInteractionProgressRecord[] = [];
      const hostHandlers = handlers();
      hostHandlers.describe = vi.fn(() => {
        const error = Object.assign(new Error(`${name} from host`), {
          ...(code === undefined ? {} : { code }),
        });
        error.name = name;
        throw error;
      });
      const mount = createMediaInteractionMount({
        handlers: hostHandlers,
        progress: () => ({
          executionId: `describe:${name}`,
          observer: { append: (record) => { records.push(record); } },
        }),
      });

      await expect(mount.dispatch(
        {
          interactionId: MEDIA_INTERACTION_IDS.describe,
          input: { source: "launch" },
        },
        { actor: "cli" },
      )).rejects.toMatchObject({ name });
      expect(records.map(({ state }) => state)).toEqual(["started", "cancelled"]);
    }
  });

  it("does not let observer failure change interaction output", async () => {
    const hostHandlers = handlers();
    const append = vi.fn(async () => {
      throw new Error("progress transport unavailable");
    });
    const mount = createMediaInteractionMount({
      handlers: hostHandlers,
      progress: () => ({
        executionId: "describe:launch",
        observer: { append },
      }),
    });

    await expect(mount.dispatch(
      {
        interactionId: MEDIA_INTERACTION_IDS.describe,
        input: { source: "launch" },
      },
      { actor: "cli" },
    )).resolves.toMatchObject({ sourceId: "launch" });
    expect(append).toHaveBeenCalledTimes(2);
  });

  it("does not let open descendant progress alter any handler outcome", async () => {
    const cancelled = new Error("cancelled by host");
    cancelled.name = "AbortError";
    const uncertain = new MediaInteractionUncertainError(
      "publication receipt cannot be proven",
    );
    const cases = [
      { label: "succeeded" },
      { label: "failed", error: new Error("handler failed") },
      { label: "cancelled", error: cancelled },
      { label: "uncertain", error: uncertain },
    ] as const;

    for (const outcome of cases) {
      const records: MediaInteractionProgressRecord[] = [];
      const hostHandlers = handlers();
      const describe = hostHandlers.describe;
      hostHandlers.describe = vi.fn(async (args) => {
        if (!args.progress) throw new Error("progress reporter is missing");
        await args.progress.report({
          subject: { kind: "stage", stageId: "accidentally-open" },
          state: "started",
        });
        if ("error" in outcome) throw outcome.error;
        return describe(args);
      });
      const mount = createMediaInteractionMount({
        handlers: hostHandlers,
        progress: () => ({
          executionId: `describe:${outcome.label}`,
          observer: { append: (record) => { records.push(record); } },
        }),
      });
      const dispatched = mount.dispatch(
        {
          interactionId: MEDIA_INTERACTION_IDS.describe,
          input: { source: "launch" },
        },
        { actor: "cli" },
      );

      if ("error" in outcome) {
        await expect(dispatched).rejects.toBe(outcome.error);
      } else {
        await expect(dispatched).resolves.toMatchObject({ sourceId: "launch" });
      }
      expect(records.map(({ subject, state }) => [subject.kind, state])).toEqual([
        ["interaction", "started"],
        ["stage", "started"],
      ]);
    }
  });

  it("emits explicit uncertainty without completing a declared Host error", async () => {
    const records: MediaInteractionProgressRecord[] = [];
    const hostHandlers = handlers();
    hostHandlers.describe = vi.fn(() => {
      throw new MediaInteractionUncertainError(
        "publication may have committed without a readable receipt",
      );
    });
    const mount = createMediaInteractionMount({
      handlers: hostHandlers,
      progress: () => ({
        executionId: "describe:uncertain",
        observer: { append: (record) => { records.push(record); } },
      }),
    });

    await expect(mount.dispatch(
      {
        interactionId: MEDIA_INTERACTION_IDS.describe,
        input: { source: "launch" },
      },
      { actor: "cli" },
    )).rejects.toMatchObject({
      name: "MediaInteractionUncertainError",
      reason: "publication may have committed without a readable receipt",
    });
    expect(records.map(({ state }) => state)).toEqual(["started", "uncertain"]);
  });

  it("isolates progress resolver and reporter setup errors", async () => {
    const hostHandlers = handlers();
    const mount = createMediaInteractionMount({
      handlers: hostHandlers,
      progress: ({ context }) => {
        if (context.actor === "resolver-error") {
          throw new Error("progress resolver unavailable");
        }
        return {
          executionId: "",
          observer: { append() {} },
        };
      },
    });

    for (const actor of ["resolver-error", "setup-error"]) {
      await expect(mount.dispatch(
        {
          interactionId: MEDIA_INTERACTION_IDS.describe,
          input: { source: "launch" },
        },
        { actor },
      )).resolves.toMatchObject({ sourceId: "launch" });
    }
    expect(hostHandlers.describe).toHaveBeenCalledTimes(2);
    expect(hostHandlers.describe).toHaveBeenNthCalledWith(
      1,
      expect.not.objectContaining({ progress: expect.anything() }),
    );
    expect(hostHandlers.describe).toHaveBeenNthCalledWith(
      2,
      expect.not.objectContaining({ progress: expect.anything() }),
    );
  });

  it("throws SuperImg errors from native dispatch without a port envelope", async () => {
    const hostHandlers = handlers();
    hostHandlers.describe = vi.fn(() => {
      throw new MediaInteractionError(
        "INVALID_INPUT",
        "media.source.describe.input.source",
        "The source is unavailable",
      );
    });
    const mount = createMediaInteractionMount({ handlers: hostHandlers });
    await expect(mount.dispatch(
      {
        interactionId: MEDIA_INTERACTION_IDS.describe,
        input: { source: "missing" },
      },
      { actor: "cli" },
    )).rejects.toBeInstanceOf(MediaInteractionError);
  });
});
