import { describe, expect, expectTypeOf, it, vi } from "vitest";
import {
  admitAll,
  bindProjection,
  directRealizationIds,
  presentProjection,
} from "@foxworth/boundary";
import type { InvocationObservation } from "@foxworth/boundary/program";
import {
  EDIT_COMPILED_INTERACTIONS,
  EDIT_INTERACTION_IDS,
  EditInteractionUncertainError,
  MEDIA_COMPILED_INTERACTIONS,
  MEDIA_INTERACTION_IDS,
  MediaInteractionUncertainError,
  MediaInteractionError,
  RENDER_COMPILED_INTERACTIONS,
  createEditInteractionMount,
  createMediaInteractionMount,
  createRenderInteractionMount,
  installEditInteractions,
  installMediaInteractions,
  installRenderInteractions,
  projectEditInteractions,
  projectMediaInteractions,
  projectRenderInteractions,
  type MediaInteractionHandlers,
} from "./index.js";

const HASH = "a".repeat(64);

type TestContext = Readonly<{ actor: string; signal?: AbortSignal }>;

function mediaHandlers(): MediaInteractionHandlers<TestContext> {
  return {
    discover: () => ({
      schemaVersion: 0,
      kind: "media-project-discovery",
      sources: [],
    }),
    describe: ({ input }) => ({
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
    }),
    check: ({ input }) => ({
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
    }),
    inspect: ({ input }) => ({
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
    }),
    snapshot: ({ input }) => ({
      schemaVersion: 0,
      kind: "media-collection-snapshot",
      source: input.source,
      sourceId: input.source,
      providerHash: HASH,
      snapshotDigest: HASH,
      entries: [{ id: "one", data: { title: "One" }, dataDigest: HASH }],
    }),
    compile: ({ input }) => ({
      schemaVersion: 0,
      kind: "media-artifact",
      targetId: input.target.targetId,
      artifactId: input.target.artifactId,
      artifactHash: HASH,
      programHash: HASH,
      intentHash: HASH,
      markupHash: HASH,
      coordinates: { sourceId: input.source, variantId: "default", editionId: "default" },
      manifest: { kind: "@foxworth/superimg/artifact", schemaVersion: 0 },
    }),
    thumbnail: ({ input }) => ({
      bytes: "AAAAAAABAAEAAAAA",
      width: Math.min(input.maxWidth, 8),
      height: 1,
    }),
    arrange: ({ input }) => ({
      mimeType: "image/png",
      bytes: "AAAAAAABAAEAAAAA",
      width: input.width ?? 1080,
      height: input.height ?? 1080,
      sha256: "a".repeat(64),
    }),
    export: ({ input }) => ({
      schemaVersion: 0,
      targetId: input.publication.targetId,
      publicationId: input.publication.publicationId,
      manifestDigest: HASH,
      manifest: { schemaVersion: 0, kind: "media-export", destinations: input.destinations },
    }),
  };
}

const mediaRealizationIds = directRealizationIds(MEDIA_COMPILED_INTERACTIONS, "test:1");

describe("Host installation and binding", () => {
  it("installs the three families independently with distinct IDs", async () => {
    const { installation: media } = await installMediaInteractions(
      createMediaInteractionMount({ handlers: mediaHandlers() }),
      { installationId: "deploy:media:1", realizationIds: mediaRealizationIds },
    );
    const { installation: edit } = await installEditInteractions(
      createEditInteractionMount({
        handlers: {
          bindings: () => {
            throw new Error("not called");
          },
          setNodeTransform: () => {
            throw new Error("not called");
          },
          setNodeText: () => { throw new Error("not called"); },
          setNodeProperty: () => { throw new Error("not called"); },
          setAudioClipPlacement: () => { throw new Error("not called"); },
          trimSceneEnd: () => {
            throw new Error("not called");
          },
          setPhaseBoundary: () => {
            throw new Error("not called");
          },
          setCompositionHold: () => {
            throw new Error("not called");
          },
        },
      }),
      {
        installationId: "deploy:edit:1",
        realizationIds: {
          bindings: { direct: "realization:edit:bindings:1" },
          setNodeTransform: { direct: "realization:edit:transform:1" },
          setNodeText: { direct: "realization:edit:text:1" },
          setNodeProperty: { direct: "realization:edit:property:1" },
          setAudioClipPlacement: { direct: "realization:edit:audio-placement:1" },
          trimSceneEnd: { direct: "realization:edit:trim:1" },
          setPhaseBoundary: { direct: "realization:edit:phase:1" },
          setCompositionHold: { direct: "realization:edit:composition-hold:1" },
        },
      },
    );
    const { installation: render } = await installRenderInteractions(
      createRenderInteractionMount({
        handlers: {
          render: () => {
            throw new Error("not called");
          },
        },
      }),
      {
        installationId: "deploy:render:1",
        realizationIds: { render: { direct: "realization:render:1" } },
      },
    );
    expect(media.installationId).toBe("deploy:media:1");
    expect(edit.installationId).toBe("deploy:edit:1");
    expect(render.installationId).toBe("deploy:render:1");
    expect(media.manifest.program.programDigest).toBe(
      MEDIA_COMPILED_INTERACTIONS.program.programDigest,
    );
    expect(edit.manifest.program.programDigest).toBe(
      EDIT_COMPILED_INTERACTIONS.program.programDigest,
    );
    expect(render.manifest.program.programDigest).toBe(
      RENDER_COMPILED_INTERACTIONS.program.programDigest,
    );
  });

  it("serializes a request Projection before any Installation exists", async () => {
    const projection = await projectMediaInteractions({
      snapshot: "request",
      export: "request",
    });
    expect(projection.manifest.interactions.map((entry) => entry.alias).sort()).toEqual([
      "export",
      "snapshot",
    ]);
    expect(projection.handles.snapshot?.interactionId).toBe(MEDIA_INTERACTION_IDS.snapshot);
    expect(projection.handles.export?.modes).toEqual(["request"]);
  });

  it("reports missing request modes exhaustively without a partial Binding", async () => {
    const { installation } = await installMediaInteractions(
      createMediaInteractionMount({ handlers: mediaHandlers() }),
      { installationId: "deploy:media:direct-only:1", realizationIds: mediaRealizationIds },
    );
    const projection = await projectMediaInteractions({
      snapshot: "request",
      export: "request",
    });
    const result = await bindProjection(projection, installation, { admit: admitAll });
    expect(result.status).toBe("unrealized");
    if (result.status !== "unrealized") throw new Error("expected unrealized");
    expect(result.report.issues.map((issue) => issue.reason)).toEqual([
      "missing-request",
      "missing-request",
    ]);
    expect("binding" in result).toBe(false);
  });

  it("changes Projection identity when a durable alias changes", async () => {
    const first = await projectMediaInteractions({ describe: "direct" });
    const second = await projectMediaInteractions({ inspect: "direct" });
    expect(first.manifest.projectionDigest).not.toBe(second.manifest.projectionDigest);
  });

  it("passes the same opaque context and AbortSignal to native dispatch", async () => {
    const seen: TestContext[] = [];
    const handlers = mediaHandlers();
    handlers.describe = ({ context, input }) => {
      seen.push(context);
      return mediaHandlers().describe({ input, context });
    };
    const mount = createMediaInteractionMount({ handlers });
    const { installation } = await installMediaInteractions(mount, {
      installationId: "deploy:media:context:1",
      realizationIds: mediaRealizationIds,
    });
    const projection = await projectMediaInteractions({ describe: "direct" });
    const bound = await bindProjection(projection, installation, { admit: admitAll });
    if (bound.status !== "bound") throw new Error("expected bound");
    const context: TestContext = { actor: "cli", signal: new AbortController().signal };
    const describe = bound.binding.resolve(MEDIA_INTERACTION_IDS.describe);
    if (!describe) throw new Error("describe is not bound");
    await bound.binding.connect().callRaw(describe, { source: "launch" }, context);
    expect(seen).toHaveLength(1);
    expect(seen[0]).toBe(context);
    expect(seen[0]?.signal).toBe(context.signal);
  });

  it("revokes before dispatch without invoking SuperImg", async () => {
    const describe = vi.fn();
    const handlers = mediaHandlers();
    handlers.describe = describe;
    const { installation, controller } = await installMediaInteractions(
      createMediaInteractionMount({ handlers }),
      { installationId: "deploy:media:revoke:1", realizationIds: mediaRealizationIds },
    );
    const projection = await projectMediaInteractions({ describe: "direct" });
    const bound = await bindProjection(projection, installation, { admit: admitAll });
    if (bound.status !== "bound") throw new Error("expected bound");
    controller.revoke();
    const outcome = await bound.binding.connect().callRaw(
      bound.binding.resolve(MEDIA_INTERACTION_IDS.describe)!,
      { source: "launch" },
      { actor: "cli" },
    );
    expect(outcome.certainty).toBe("not-started");
    expect(outcome.result).toMatchObject({ kind: "fault", cause: "revoked" });
    expect(describe).not.toHaveBeenCalled();
  });

  it("refuses host admission without dispatching native work", async () => {
    const handlers = mediaHandlers();
    const describe = vi.fn(handlers.describe);
    const { installation } = await installMediaInteractions(createMediaInteractionMount({ handlers: { ...handlers, describe } }), {
      installationId: "deploy:media:denied:1", realizationIds: mediaRealizationIds,
    });
    const projection = await projectMediaInteractions({ describe: "direct" });
    const bound = await bindProjection(projection, installation, { admit: () => ({ decision: "deny", reason: "host policy" }) });
    if (bound.status !== "bound") throw new Error("expected bound");
    expect(await bound.binding.connect().callRaw(
      bound.binding.resolve(MEDIA_INTERACTION_IDS.describe)!, { source: "launch" }, { actor: "host" },
    )).toMatchObject({ certainty: "not-started", result: { kind: "denied", code: "CALL_NOT_ADMITTED" } });
    expect(describe).not.toHaveBeenCalled();
  });

  it("returns the versioned declared error through a checked binding", async () => {
    const handlers = mediaHandlers();
    handlers.describe = () => { throw new MediaInteractionError("INVALID_INPUT", "source", "unavailable"); };
    const { installation } = await installMediaInteractions(createMediaInteractionMount({ handlers }), {
      installationId: "deploy:media:declared:1", realizationIds: mediaRealizationIds,
    });
    const projection = await projectMediaInteractions({ describe: "direct" });
    const bound = await bindProjection(projection, installation, { admit: admitAll });
    if (bound.status !== "bound") throw new Error("expected bound");
    const outcome = await bound.binding.connect().callRaw(
      bound.binding.resolve(MEDIA_INTERACTION_IDS.describe)!, { source: "launch" }, { actor: "host" },
    );
    expect(outcome).toMatchObject({ certainty: "completed", result: {
      kind: "declared-error", code: "INVALID_INPUT", details: {
        schemaVersion: 1, kind: "media-interaction-error", path: "source", message: "unavailable",
      },
    } });
  });

  it("preserves unknown edit effects through Installation rather than declaring rejection", async () => {
    const unavailable = () => { throw new Error("not used"); };
    const mount = createEditInteractionMount({ handlers: {
      bindings: unavailable, trimSceneEnd: unavailable, setPhaseBoundary: unavailable, setCompositionHold: unavailable, setNodeText: unavailable, setNodeProperty: unavailable, setAudioClipPlacement: unavailable,
      setNodeTransform: () => { throw new EditInteractionUncertainError("source restoration not proved"); },
    }});
    const { installation } = await installEditInteractions(mount, {
      installationId: "edit:unknown", realizationIds: directRealizationIds(EDIT_COMPILED_INTERACTIONS,"test:unknown"),
    });
    const projection = await projectEditInteractions({ setNodeTransform: "direct" });
    const bound = await bindProjection(projection, installation, { admit: admitAll });
    if (bound.status !== "bound") throw new Error("expected bound");
    const outcome = await bound.binding.connect().callRaw(bound.binding.resolve(EDIT_INTERACTION_IDS.setNodeTransform)!, {
      schemaVersion: 0, source: "launch.media.ts", kind: "set-node-transform",
      target: { nodeId:"default::title", xBindingId:"x",yBindingId:"y" }, value:{x:1,y:2},
      expected:{intentHash:HASH,sourceHashes:{"launch.media.ts":HASH}},
    },{actor:"cli"});
    expect(outcome.certainty).toBe("unknown");
    expect(outcome.result.kind).toBe("fault");
  });

  it("translates proven domain errors and leaves uncertainty unknown", async () => {
    const handlers = mediaHandlers();
    handlers.describe = () => {
      throw new MediaInteractionUncertainError("publication may have committed");
    };
    const { installation } = await installMediaInteractions(
      createMediaInteractionMount({ handlers }),
      { installationId: "deploy:media:uncertain:1", realizationIds: mediaRealizationIds },
    );
    const projection = await projectMediaInteractions({ describe: "direct" });
    const bound = await bindProjection(projection, installation, { admit: admitAll });
    if (bound.status !== "bound") throw new Error("expected bound");
    const outcome = await bound.binding.connect().callRaw(
      bound.binding.resolve(MEDIA_INTERACTION_IDS.describe)!,
      { source: "launch" },
      { actor: "cli" },
    );
    expect(outcome.certainty).toBe("unknown");
    expect(outcome.result.kind).toBe("fault");
  });
});

describe("durable edit and render projections", () => {
  it("can project edit request mode before Installation", async () => {
    const projection = await projectEditInteractions({
      setNodeTransform: "request",
    });
    expect(projection.handles.setNodeTransform?.modes).toEqual(["request"]);
  });

  it("can project render request mode before Installation", async () => {
    const projection = await projectRenderInteractions({ render: "request" });
    expect(projection.handles.render.modes).toEqual(["request"]);
  });
});


describe("host-owned lifecycle and observation", () => {
  it("revokes one caller surface without revoking its sibling or installation", async () => {
    const handlers = mediaHandlers();
    const describe = vi.fn(handlers.describe);
    const { installation, controller } = await installMediaInteractions(
      createMediaInteractionMount({ handlers: { ...handlers, describe } }),
      { installationId: "deploy:media:controllers:1", realizationIds: mediaRealizationIds },
    );
    const projection = await projectMediaInteractions({ describe: "direct" });
    const first = await bindProjection(projection, installation, { admit: admitAll });
    const second = await bindProjection(projection, installation, { admit: admitAll });
    if (first.status !== "bound" || second.status !== "bound") throw new Error("expected bindings");
    expect(installation).not.toHaveProperty("revoke");
    expect(first.binding).not.toHaveProperty("revoke");
    expectTypeOf(first.binding.connect()).not.toHaveProperty("request");
    expectTypeOf(projection.handles).not.toHaveProperty("export");
    expect(first.binding).not.toHaveProperty("controller");
    expect(first.controller.revoke()).toBe(true);
    expect(first.controller.revoke()).toBe(false);
    expect(controller.revoked).toBe(false);
    const revoked = await first.binding.connect().callRaw(
      first.binding.resolve(MEDIA_INTERACTION_IDS.describe)!, { source: "launch" }, { actor: "first" },
    );
    expect(revoked).toMatchObject({ certainty: "not-started", result: { kind: "fault", cause: "revoked" } });
    const sibling = await second.binding.connect().callRaw(
      second.binding.resolve(MEDIA_INTERACTION_IDS.describe)!, { source: "launch" }, { actor: "second" },
    );
    expect(sibling.result.kind).toBe("returned");
    expect(describe).toHaveBeenCalledTimes(1);
    controller.revoke();
    const stopped = await second.binding.connect().callRaw(
      second.binding.resolve(MEDIA_INTERACTION_IDS.describe)!, { source: "launch" }, { actor: "second" },
    );
    expect(stopped.certainty).toBe("not-started");
    expect(describe).toHaveBeenCalledTimes(1);
  });

  it("derives presentation from the selected contract without widening it", async () => {
    const projection = await projectMediaInteractions({ describe: "direct", export: "request" });
    const before = projection.projectionDigest;
    const presentation = await presentProjection(projection, { describe: { title: "Read media details" } });
    expect(presentation.projectionDigest).toBe(before);
    expect(projection.projectionDigest).toBe(before);
    expect(presentation.interactions.map(interaction => interaction.alias)).toEqual(["describe", "export"]);
    expect(presentation.interactions[0]?.title).toBe("Read media details");
    expect(presentation.interactions[1]?.modes).toEqual(["request"]);
    expect(presentation.interactions[1]).not.toHaveProperty("directOutputSchema");
    expect(presentation.interactions[1]?.inputSchema).toEqual(
      MEDIA_COMPILED_INTERACTIONS.program.interactions.find(entry => entry.contract.id === MEDIA_INTERACTION_IDS.export)?.contract.inputSchema,
    );
  });

  it("publishes call evidence without leaking context or changing native results", async () => {
    const events: InvocationObservation[] = [];
    const { installation } = await installMediaInteractions(
      createMediaInteractionMount({ handlers: mediaHandlers() }),
      { installationId: "deploy:media:observe:1", realizationIds: mediaRealizationIds },
    );
    const projection = await projectMediaInteractions({ describe: "direct" });
    const bound = await bindProjection(projection, installation, {
      admit: admitAll,
      observation: {
        correlate: context => ({ actor: context.actor }),
        publish: event => { events.push(event); throw new Error("observer unavailable"); },
      },
    });
    if (bound.status !== "bound") throw new Error("expected bound");
    const outcome = await bound.binding.connect().callRaw(
      bound.binding.resolve(MEDIA_INTERACTION_IDS.describe)!, { source: "launch" },
      { actor: "viewer", signal: new AbortController().signal },
    );
    expect(outcome.result.kind).toBe("returned");
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      version: 1,
      certainty: "completed",
      resultKind: "returned",
      correlation: { actor: "viewer" },
      reads: ["media.sources:{input.source}"],
      changes: [],
    });
    expect(events[0]).not.toHaveProperty("input");
    expect(events[0]).not.toHaveProperty("context");
    expect(events[0]).not.toHaveProperty("result");
  });
});
