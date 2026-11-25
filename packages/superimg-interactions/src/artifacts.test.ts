import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { admitAll, bindProjection } from "@foxworth/boundary";
import { checkHostArtifacts, renderHostArtifacts } from "@foxworth/boundary/build";
import { serializeProgramLock } from "./artifacts.js";
import { MEDIA_COMPILED_INTERACTIONS } from "./compiled.js";
import { EDIT_COMPILED_INTERACTIONS } from "./edit/compiled.js";
import { RENDER_COMPILED_INTERACTIONS } from "./render/compiled.js";
import { SCRIPT_COMPILED_INTERACTIONS } from "./script/compiled.js";
import { createMediaInteractionMount } from "./mount.js";
import { installMediaInteractions } from "./install.js";
import { projectMediaInteractions } from "./projection.js";
import type { MediaInteractionHandlers } from "./contracts.js";

const packageRoot = resolve(import.meta.dirname, "..");
const HASH = "a".repeat(64);

function handlers(): MediaInteractionHandlers<Record<string, never>> {
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
      animated: false,
      canvas: { width: 1920, height: 1080 },
      fps: 30,
      duration: 0,
      totalFrames: 1,
      temporal: "static",
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
        kind: "image",
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
        kind: "image",
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
      entries: [{ id: "one", data: {}, dataDigest: HASH }],
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
      coordinates: {},
      manifest: {},
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
      manifest: {},
    }),
  };
}

describe("generated media interaction artifacts", () => {
  it("publishes all 25 host interaction identifiers", () => {
    const programs = [MEDIA_COMPILED_INTERACTIONS.program, EDIT_COMPILED_INTERACTIONS.program, RENDER_COMPILED_INTERACTIONS.program, SCRIPT_COMPILED_INTERACTIONS.program];
    expect(programs.map((program) => program.interactions.length)).toEqual([13, 8, 1, 3]);
    const ids = programs.flatMap((program) => program.interactions.map((entry) => entry.contract.id));
    expect(new Set(ids).size).toBe(25);
    expect(ids).toEqual(expect.arrayContaining([
      "media.edit.set-node-text", "media.edit.set-node-property", "media.edit.set-audio-clip-placement",
    ]));
    expect(ids.every((id) => id.startsWith("media."))).toBe(true);
    expect(programs.every((program) => !("operations" in program))).toBe(true);
  });

  it("matches the four compiled Programs byte for byte", async () => {
    const expectedLock = serializeProgramLock({
      media: MEDIA_COMPILED_INTERACTIONS.program,
      edit: EDIT_COMPILED_INTERACTIONS.program,
      render: RENDER_COMPILED_INTERACTIONS.program,
      script: SCRIPT_COMPILED_INTERACTIONS.program,
    });
    const lock = await readFile(resolve(packageRoot, "program.lock"), "utf8");
    expect(lock).toBe(expectedLock);
  });

  it("cannot render typed references from a Program alone", async () => {
    expect(() =>
      renderHostArtifacts({
        program: {
          name: "media",
          value: MEDIA_COMPILED_INTERACTIONS.program,
        },
        references: {
          media: {
            name: "media",
            value: {
              binding: {} as never,
              source: { module: "./compiled.js", export: "MEDIA_INTERACTION_DEFINITIONS", compiled: MEDIA_COMPILED_INTERACTIONS },
              exportName: "MEDIA_INTERACTION_REFERENCES",
              members: {
                describe: { definition: "describe" },
              },
            },
          },
        },
      }),
    ).toThrow();
  });

  it("renders references from an authentic Binding and checks without writing", async () => {
    const { installation } = await installMediaInteractions(
      createMediaInteractionMount({ handlers: handlers() }),
      {
        installationId: "deploy:media:artifacts:1",
        realizationIds: {
          discover: { direct: "realization:discover:1" },
          describe: { direct: "realization:describe:1" },
          check: { direct: "realization:check:1" },
          inspect: { direct: "realization:inspect:1" },
          snapshot: { direct: "realization:snapshot:1" },
          compile: { direct: "realization:compile:1" },
          thumbnail: { direct: "realization:thumbnail:1" },
          arrange: { direct: "realization:arrange:1" },
          speechVoices: { direct: "realization:speechVoices:1" },
          speechSynthesize: { direct: "realization:speechSynthesize:1" },
          narrationPrepare: { direct: "realization:narrationPrepare:1" },
          narrationReview: { direct: "realization:narrationReview:1" },
          export: { direct: "realization:export:1" },
        },
      },
    );
    const projection = await projectMediaInteractions({ describe: "direct" });
    const bound = await bindProjection(projection, installation, { admit: admitAll });
    if (bound.status !== "bound") throw new Error("expected bound");
    const artifacts = renderHostArtifacts({
      program: {
        name: "media",
        value: MEDIA_COMPILED_INTERACTIONS.program,
      },
      bindings: {
        media: {
          name: "media",
          value: bound.binding,
        },
      },
      references: {
        media: {
          name: "media",
          value: {
            binding: bound.binding,
            source: { module: "./compiled.js", export: "MEDIA_INTERACTION_DEFINITIONS", compiled: MEDIA_COMPILED_INTERACTIONS },
            exportName: "MEDIA_INTERACTION_REFERENCES",
            members: {
              describe: { definition: "describe" },
            },
          },
        },
      },
    });
    const destination = await mkdtemp(join(tmpdir(), "superimg-host-artifacts-"));
    try {
      const checked = await checkHostArtifacts(artifacts, { destination });
      expect(checked.ok).toBe(false);
      expect(checked.missing.length).toBeGreaterThan(0);
    } finally {
      await rm(destination, { recursive: true, force: true });
    }
    expect(artifacts.files.some((file) => file.path.endsWith("media.references.ts"))).toBe(true);
  });
});
