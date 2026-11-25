import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  admitAll,
  directRealizationIds,
  type InvocationObservation,
} from "@foxworth/boundary";
import {
  footprintSubsumes,
  resolveFootprints,
  scopedObservationFootprints,
} from "@foxworth/boundary/program";
import {
  MemoryJournal,
  TestClock,
  verifyControlCrashRecovery,
  verifyDirectHandlers,
} from "@foxworth/boundary/testing";
import {
  MEDIA_COMPILED_INTERACTIONS,
  MEDIA_INTERACTION_IDS,
  EDIT_COMPILED_INTERACTIONS,
  EDIT_INTERACTION_IDS,
  RENDER_COMPILED_INTERACTIONS,
  SUPERIMG_COMBINED_PROGRAM,
  analyzeMediaPlan,
  createMediaCheckPlan,
  createMediaInteractionMount,
  createMediaInteractionSlot,
  createMediaPublishPlan,
  createPlan,
  installMediaInteractions,
  projectMediaInteractions,
  type MediaDirectDispatcher,
  type MediaInteractionHandlers,
} from "./index.js";
import { compileNodeMediaArtifact } from "./node/artifact.js";
import { createMediaArtifactCompileControlHook } from "./node/control-hooks.js";
import { createProjectMediaTargetRegistry } from "./node/targets.js";

const HASH = "a".repeat(64);
const SHA = `sha256:${HASH}` as const;
const tempDirs: string[] = [];

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

function stubMediaHandlers<Context>(tag = "v1"): MediaInteractionHandlers<Context> {
  return {
    discover: () => ({
      schemaVersion: 0,
      kind: "media-project-discovery",
      sources: [{ sourceId: "launch", relativePath: "launch.media.ts", sourceKind: "media-module" }],
    }),
    describe: ({ input }) => ({
      schemaVersion: 0,
      kind: "media-source-description",
      sourceId: `${input.source}:${tag}`,
      relativePath: `${input.source}.media.ts`,
      sourceKind: "media",
      programHash: HASH,
      animated: false,
      canvas: { width: 1200, height: 630 },
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
      sourceId: `${input.source}:${tag}`,
      relativePath: `${input.source}.media.ts`,
      programHash: HASH,
      report: {
        schemaVersion: 0,
        ok: true,
        programDigest: `program:${tag}`,
        kind: "image",
        coordinates: [{ variantId: "default", editionId: "default" }],
        findings: [],
      },
    }),
    inspect: ({ input }) => ({
      schemaVersion: 0,
      kind: "media-source-inspection",
      sourceId: `${input.source}:${tag}`,
      relativePath: `${input.source}.media.ts`,
      programHash: HASH,
      report: {
        schemaVersion: 0,
        programDigest: `program:${tag}`,
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
      coordinates: { variantId: "default", editionId: "default" },
      manifest: { schemaVersion: 0 },
    }),
    thumbnail: ({ input }) => ({
      bytes: "AQID",
      width: Math.min(input.maxWidth, 320),
      height: 180,
    }),
    arrange: () => ({
      mimeType: "image/png",
      bytes: "AQID",
      width: 1080,
      height: 1080,
      sha256: HASH,
    }),
    export: ({ input }) => ({
      schemaVersion: 0,
      targetId: input.publication.targetId,
      publicationId: input.publication.publicationId,
      manifestDigest: HASH,
      manifest: { schemaVersion: 0, renditions: [] },
    }),
  };
}

describe("Boundary v0 scoped footprints and idempotency traits", () => {
  it("declares scoped footprints subsumed by coarse footprints and idempotency keys on mutating interactions", () => {
    const mediaById = new Map(
      MEDIA_COMPILED_INTERACTIONS.program.interactions.map((entry) => [entry.contract.id, entry.contract]),
    );
    const compile = mediaById.get(MEDIA_INTERACTION_IDS.compile)!;
    const exportContract = mediaById.get(MEDIA_INTERACTION_IDS.export)!;
    const check = mediaById.get(MEDIA_INTERACTION_IDS.check)!;

    expect(compile.idempotencyKey).toBe("target.artifactId");
    expect(exportContract.idempotencyKey).toBe("publication.publicationId");
    expect(check.reads).toEqual(["media.snapshots:{input.source}", "media.sources:{input.source}"]);
    expect(footprintSubsumes("media.sources", "media.sources:launch")).toBe(true);
    expect(footprintSubsumes("media.publications", "media.publications:cdn:launch-v1")).toBe(true);

    expect(
      resolveFootprints(exportContract.changes, {
        source: "launch",
        publication: { targetId: "cdn", publicationId: "launch-v1" },
        destinations: ["youtube"],
      }),
    ).toEqual(["media.publications:cdn:launch-v1"]);

    expect(
      scopedObservationFootprints(check.reads, check.changes, { source: "hero" }),
    ).toEqual({
      scopedReads: ["media.snapshots:hero", "media.sources:hero"],
    });

    for (const entry of EDIT_COMPILED_INTERACTIONS.program.interactions) {
      if (entry.contract.id === EDIT_INTERACTION_IDS.bindings) {
        expect(entry.contract.idempotencyKey).toBeUndefined();
        expect(entry.contract.reads).toEqual(["media.sources:{input.source}"]);
      } else {
        expect(entry.contract.idempotencyKey).toBe("expected.intentHash");
        expect(entry.contract.changes).toEqual(["media.sources:{input.source}"]);
      }
    }

    const renderContract = RENDER_COMPILED_INTERACTIONS.program.interactions[0]!.contract;
    expect(renderContract.idempotencyKey).toBe("packageHash");
    expect(renderContract.changes).toEqual(["media.render-results:{input.sourceId}:{input.packageHash}"]);
  });
});

describe("Boundary v0 static Plans (@foxworth/boundary/plan)", () => {
  it("groups independent source checks into a single parallel wave and preflights against live bindings", () => {
    const plan = createMediaCheckPlan(["hero.media.ts", "cards.media.ts", "outro.media.ts"], {
      craft: true,
      includeInspect: true,
    });

    const fullSlot = createMediaInteractionSlot({
      mount: createMediaInteractionMount({ handlers: stubMediaHandlers() }),
      installationId: "plan-check:full",
      expose: { check: "direct", inspect: "direct" },
      admit: admitAll,
    });
    const checkOnlySlot = createMediaInteractionSlot({
      mount: createMediaInteractionMount({ handlers: stubMediaHandlers() }),
      installationId: "plan-check:narrow",
      expose: { check: "direct" },
      admit: admitAll,
    });
    try {
      const fullAnalysis = analyzeMediaPlan(plan, { binding: fullSlot.current });
      // Pure reads across all 3 sources have no conflicting writes: 1 parallel wave.
      expect(fullAnalysis.waves).toHaveLength(1);
      expect(fullAnalysis.waves[0]).toHaveLength(6);
      expect(fullAnalysis.footprints.changes).toEqual([]);
      expect(fullAnalysis.requiredMediaProjection).toBeDefined();
      expect(Object.keys(fullAnalysis.requiredSelections).sort()).toEqual(["check", "inspect"]);
      expect(fullAnalysis.preflight?.ready).toBe(true);

      const narrowAnalysis = analyzeMediaPlan(plan, { binding: checkOnlySlot.current });
      expect(narrowAnalysis.preflight?.ready).toBe(false);
      expect(narrowAnalysis.preflight?.issues.some((issue) => issue.reason === "missing-interaction")).toBe(true);
    } finally {
      fullSlot.dispose();
      checkOnlySlot.dispose();
    }
  });

  it("orders check -> snapshot -> compile/export waves and supports cross-program Edit + Media plans", () => {
    const publishPlan = createMediaPublishPlan({
      source: "cards.media.ts",
      collection: true,
      compile: { target: { targetId: "artifacts", artifactId: "cards.superimg" }, verify: true },
      export: {
        publication: { targetId: "output", publicationId: "cards.export" },
        destinations: ["youtube", "instagram-square"],
      },
    });
    const analysis = analyzeMediaPlan(publishPlan);
    expect(analysis.waves).toEqual([
      ["check"],
      ["snapshot"],
      ["compile", "export"],
    ]);
    expect(Object.keys(analysis.requiredSelections).sort()).toEqual([
      "check",
      "compile",
      "export",
      "snapshot",
    ]);

    const editThenCheck = createPlan({
      id: "superimg.agent.edit-and-check",
      steps: [
        {
          id: "read-bindings",
          alias: "bindings",
          interactionId: EDIT_INTERACTION_IDS.bindings,
          mode: "direct",
          inputs: { source: { kind: "literal", value: "hero.media.ts" } },
        },
        {
          id: "check-after",
          alias: "check",
          interactionId: MEDIA_INTERACTION_IDS.check,
          mode: "direct",
          inputs: { source: { kind: "literal", value: "hero.media.ts" } },
          dependsOn: ["read-bindings"],
        },
      ],
    });
    const combinedAnalysis = analyzeMediaPlan(editThenCheck, {
      program: SUPERIMG_COMBINED_PROGRAM,
    });
    expect(combinedAnalysis.waves).toEqual([["read-bindings"], ["check-after"]]);
    expect(combinedAnalysis.requiredMediaProjection).toBeUndefined();
  });
});

describe("Boundary v0 BindingSlot, bindAuthorizedProjection, and caller.try.*", () => {
  it("supports authorized context promotion, typed try outcomes, and atomic hot-reload rebinding", async () => {
    const receivedTenants: string[] = [];
    const makeAuthorizedHandlers = (tag: string): MediaInteractionHandlers<{ tenantId: string }> => {
      const base = stubMediaHandlers<{ tenantId: string }>(tag);
      return {
        ...base,
        describe: (args) => {
          receivedTenants.push(args.context.tenantId);
          return base.describe(args);
        },
      };
    };
    const observations: InvocationObservation[] = [];
    const slot = createMediaInteractionSlot<{ apiKey: string }, { tenantId: string }>({
      mount: createMediaInteractionMount({ handlers: makeAuthorizedHandlers("v1") }),
      installationId: "studio-host",
      expose: { describe: "direct", check: "direct" },
      authorize: ({ context }) =>
        context.apiKey === "secret-1"
          ? { decision: "allow", context: { tenantId: "tenant-acme" } }
          : { decision: "deny", reason: "Invalid API key" },
      observation: {
        publish: (event) => {
          observations.push(event);
        },
      },
    });
    try {
      expect(await slot.try().describe({ source: "launch" }, { apiKey: "secret-1" })).toMatchObject({
        kind: "ok",
        value: { sourceId: "launch:v1" },
      });
      expect(receivedTenants).toEqual(["tenant-acme"]);
      expect(await slot.try().describe({ source: "launch" }, { apiKey: "wrong" })).toMatchObject({
        kind: "denied",
      });
      expect(observations[0]).toMatchObject({
        reads: ["media.sources:{input.source}"],
      });
      expect(
        scopedObservationFootprints(observations[0]!.reads, observations[0]!.changes, { source: "launch" }),
      ).toEqual({
        scopedReads: ["media.sources:launch"],
      });

      // Atomic hot reload swaps to v2 while preserving authorized admission.
      const beforeDigest = slot.current.manifest.bindingDigest;
      const rebound = slot.rebind(createMediaInteractionMount({ handlers: makeAuthorizedHandlers("v2") }));
      expect(rebound.status).toBe("rebound");
      expect(slot.current.manifest.bindingDigest).not.toBe(beforeDigest);
      expect(await slot.try().describe({ source: "launch" }, { apiKey: "secret-1" })).toMatchObject({
        kind: "ok",
        value: { sourceId: "launch:v2" },
      });
      expect(receivedTenants).toEqual(["tenant-acme", "tenant-acme"]);

      // Incompatible rebind (requesting a mode not installed) returns unrealized and preserves v2 live.
      const failed = slot.rebind(createMediaInteractionMount({ handlers: makeAuthorizedHandlers("v3") }), {
        projection: projectMediaInteractions({ export: "request" }),
      });
      expect(failed.status).toBe("unrealized");
      expect(await slot.try().describe({ source: "launch" }, { apiKey: "secret-1" })).toMatchObject({
        kind: "ok",
        value: { sourceId: "launch:v2" },
      });
    } finally {
      slot.dispose();
    }
  });
});

describe("Boundary v0 contract verification harness (@foxworth/boundary/testing)", () => {
  it("verifies Media direct handlers against generated valid and invalid samples", async () => {
    const mediaInstalled = installMediaInteractions(
      createMediaInteractionMount({ handlers: stubMediaHandlers() }),
      {
        installationId: "verify:media",
        realizationIds: directRealizationIds(MEDIA_COMPILED_INTERACTIONS, "v1"),
      },
    );
    try {
      const mediaReport = await verifyDirectHandlers({
        compiled: MEDIA_COMPILED_INTERACTIONS,
        installation: mediaInstalled.installation,
        aliases: ["discover", "describe", "snapshot", "thumbnail", "arrange"],
        context: {},
        maxSamplesPerInteraction: 3,
      });
      expect(mediaReport.ok, JSON.stringify(mediaReport.failures, null, 2)).toBe(true);
      expect(mediaReport.checkedInteractions).toBe(5);
      expect(mediaReport.validCasesRun).toBeGreaterThan(0);
      expect(mediaReport.invalidCasesRun).toBeGreaterThan(0);
    } finally {
      mediaInstalled.controller.revoke();
    }
  });

  it("verifies crash recovery across after-attempt, after-apply, and after-verify on media.artifact.compile", async () => {
    const report = await verifyControlCrashRecovery({
      journal: new MemoryJournal(),
      clock: new TestClock(1000),
      run: async (point, crash) => {
        const root = await mkdtemp(join(tmpdir(), `superimg-crash-${point}-`));
        tempDirs.push(root);
        await writeFile(join(root, "package.json"), '{"type":"module"}\n');
        await mkdir(join(root, "assets"));
        await writeFile(
          join(root, "launch.media.ts"),
          [
            'import { image, Html } from "@foxworth/superimg";',
            "export default image({",
            '  sample: { title: "Crash test" },',
            '  render: (ctx) => Html({ html: `<main>${ctx.data.title}</main>` }),',
            "});",
          ].join("\n"),
        );

        const targets = createProjectMediaTargetRegistry<Record<string, never>>(root);
        let appliedCount = 0;
        const dispatch = (async (request, context) => {
          appliedCount += 1;
          return compileNodeMediaArtifact({
            projectRoot: root,
            input: request.input as never,
            context,
            targets,
          });
        }) as MediaDirectDispatcher<Record<string, never>>;

        const hook = createMediaArtifactCompileControlHook({
          projectRoot: root,
          targets,
          dispatch,
          realizationDigest: SHA,
        });
        const input = {
          source: "launch",
          target: { targetId: "project-artifacts", artifactId: "launch.superimg" },
          verify: true,
        } as const;
        const plan = await hook.plan({ input, context: {} });
        const execArgs = {
          input,
          state: plan.state,
          context: {},
          proposal: { id: `prop-${point}` },
          lease: {
            owner: "worker-1",
            fence: 1,
            expiresAt: Date.now() + 10_000,
            async renew() {
              return { owner: "worker-1", fence: 1, expiresAt: Date.now() + 10_000 };
            },
          },
        };
        let isTerminal = false;
        try {
          if (point === "after-attempt") crash();
          const output = await hook.apply(execArgs as never);
          if (point === "after-apply") crash();
          const verified = await hook.verify({ ...execArgs, output } as never);
          if (!verified.ok) throw new Error("verify failed");
          isTerminal = true;
          if (point === "after-verify") crash();
        } catch {
          // Expected simulated crash; fall through to return reconcile handle.
        }

        return {
          async reconcile() {
            const result = await hook.reconcile(execArgs as never);
            if (result.status === "completed" || result.status === "not-applied") {
              isTerminal = true;
            }
            return result;
          },
          sideEffects: () => appliedCount,
          terminal: async () => isTerminal,
        };
      },
    });
    expect(report.ok, JSON.stringify(report.cases, null, 2)).toBe(true);
    expect(report.cases.map((entry) => entry.point)).toEqual([
      "after-attempt",
      "after-apply",
      "after-verify",
    ]);
  }, 45_000);
});
