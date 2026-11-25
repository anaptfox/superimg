import { createHash } from "node:crypto";
import { mkdir, mkdtemp, readFile, realpath, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import type {
  ExportBundle,
  ExportOptions,
  ExportProgressEvent,
  Runtime,
} from "@superimg/types";
import { bundleMediaProgramPair } from "@superimg/core/bundler";
import { compileNodeMediaSource } from "./source.js";
import { MEDIA_INTERACTION_IDS } from "../contracts.js";
import type { MediaInteractionProgressRecord } from "../progress.js";
import { createNodeMediaInteractionMount, type NodeMediaExecutionOptions } from "./mount.js";
import { hashJson } from "./provider.js";

const roots: string[] = [];

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

describe("Node media interaction mount", () => {
  it("exports the prepared described revision without running a replacement collection provider", async () => {
    const root = await mkdtemp(join(tmpdir(), "superimg-described-export-"));
    roots.push(root);
    await writeFile(join(root, "package.json"), '{"type":"module"}');
    const path = join(root, "film.media.ts");
    await writeFile(path, `import {image,Html} from '@foxworth/superimg'; export default image({render:()=>Html({id:'old',html:'Original'})});`);
    const preparedSource = await compileNodeMediaSource(root, "film.media.ts");
    const exported = vi.fn(async () => exportBundle(new Uint8Array([1, 2, 3]), async () => {}));
    const mount = createNodeMediaInteractionMount({ projectRoot: root, runtime: fakeRuntime(), exportMedia: exported,
      executionOptions: () => ({ preparedSource }),
    });
    const before = await mount.dispatch({ interactionId: MEDIA_INTERACTION_IDS.describe, input: { source: "film.media.ts" } }, {});
    await writeFile(join(root, "entries.server.ts"), `import {writeFileSync} from 'node:fs'; export function entries(){writeFileSync(new URL('./provider-ran',import.meta.url),'ran');return [{id:'one'}]}`);
    await writeFile(path, `import {collection,image,Html} from '@foxworth/superimg'; import {entries} from './entries.server'; export default collection({entries,media:image({render:()=>Html({html:'Changed'})})});`);
    await mount.dispatch({ interactionId: MEDIA_INTERACTION_IDS.export, input: { source: "film.media.ts", destinations: ["youtube"], publication: { targetId: "project-output", publicationId: "frozen.export" } } }, {});
    expect(before.sourceKind).toBe("media");
    expect(exported).toHaveBeenCalledOnce();
    await expect(readFile(join(root, "provider-ran"))).rejects.toThrow();
  });

  it("retains the actual loaded export revision before rendering, even when the source then changes", async () => {
    const root = await mkdtemp(join(tmpdir(), "superimg-retained-export-"));
    roots.push(root);
    await writeFile(join(root, "package.json"), '{"type":"module"}');
    const path = join(root, "film.media.ts");
    await writeFile(path, `import {image,Html} from '@foxworth/superimg'; export default image({render:()=>Html({id:'old',html:'Original'})});`);
    const order: string[] = [];
    let retained: import("./source.js").LoadedNodeMediaValue | undefined;
    const mount = createNodeMediaInteractionMount({
      projectRoot: root, runtime: fakeRuntime(),
      executionOptions: () => ({ retainExportSource: loaded => { order.push("retain"); retained = loaded; } }),
      exportMedia: async (_runtime, media) => {
        order.push("export");
        await writeFile(path, `import {image,Html} from '@foxworth/superimg'; export default image({render:()=>Html({id:'new',html:'Changed'})});`);
        expect(media).toBe(retained?.value);
        expect(retained?.bundle.code).toContain("Original");
        expect(retained?.sourceText).toContain("Original");
        return exportBundle(new Uint8Array([1, 2, 3]), async () => {});
      },
    });
    await mount.dispatch({ interactionId: MEDIA_INTERACTION_IDS.export, input: { source: "film.media.ts", destinations: ["youtube"], publication: { targetId: "project-output", publicationId: "frozen.export" } } }, {});
    expect(order).toEqual(["retain", "export"]);
    expect(await readFile(path, "utf8")).toContain("Changed");
  });

  it("includes portable source findings in check and inspect reports", async () => {
    const root = await mkdtemp(join(tmpdir(), "superimg-node-source-findings-"));
    roots.push(root);
    await writeFile(join(root, "package.json"), '{"type":"module"}\n');
    await writeFile(
      join(root, "card.media.ts"),
      [
        'import { image, Html } from "@foxworth/superimg";',
        "const legacyTiming = { for: 30 };",
        "void legacyTiming;",
        "export default image({",
        '  render: () => Html({ html: "<h1>Card</h1>" }),',
        "});",
      ].join("\n"),
    );
    const runtime = fakeRuntime();
    const mount = createNodeMediaInteractionMount({
      projectRoot: root,
      runtime,
      check: vi.fn(async () => ({
        schemaVersion: 0 as const,
        ok: true,
        programDigest: "program-card",
        kind: "image" as const,
        coordinates: [],
        findings: [],
      })) as never,
      inspect: vi.fn(async () => ({
        schemaVersion: 0 as const,
        programDigest: "program-card",
        kind: "image" as const,
        coordinates: [],
        findings: [],
        assets: [],
        fonts: [],
      })) as never,
    });

    const checked = await mount.dispatch({
      interactionId: MEDIA_INTERACTION_IDS.check,
      input: { source: "card" },
    }, {});
    const inspected = await mount.dispatch({
      interactionId: MEDIA_INTERACTION_IDS.inspect,
      input: { source: "card" },
    }, {});

    expect(checked.report).toMatchObject({
      ok: false,
      findings: [expect.objectContaining({
        category: "authoring",
        code: "UNITLESS_MOTION_TIME",
      })],
    });
    expect(inspected.report.findings).toContainEqual(expect.objectContaining({
      category: "authoring",
      code: "UNITLESS_MOTION_TIME",
    }));
  }, 20_000);

  it.each([
    ["video", false],
    ["image", true],
  ] as const)("classifies an aliased %s from the loaded definition", async (helper, expectsStaticIssue) => {
    const root = await mkdtemp(join(tmpdir(), "superimg-node-helper-defaults-"));
    roots.push(root);
    await writeFile(join(root, "package.json"), '{"type":"module"}\n');
    await writeFile(join(root, "card.media.ts"), `
      import { ${helper} as author, Html } from "@foxworth/superimg";
      export default author({
        ${helper === "video" ? 'duration: "3s",' : ""}
        render(ctx) { return Html({ html: String(ctx.timeline.progress) }); }
      });
    `);
    const base = { schemaVersion: 0 as const, programDigest: "helper-defaults", kind: helper, coordinates: [], findings: [] };
    const mount = createNodeMediaInteractionMount({
      projectRoot: root, runtime: fakeRuntime(),
      check: async () => ({ ...base, ok: true }),
      inspect: async () => ({ ...base, assets: [], fonts: [] }),
    });
    for (const interactionId of [MEDIA_INTERACTION_IDS.check, MEDIA_INTERACTION_IDS.inspect]) {
      const result = await mount.dispatch({ interactionId, input: { source: "card" } }, {});
      expect(result.report.findings.some(finding => finding.code === "TEMPORAL_API_ON_STATIC")).toBe(expectsStaticIssue);
    }
  }, 20_000);

  it("runs a provider once across snapshot then export and consumes the portable bundle", async () => {
    const root = await mkdtemp(join(tmpdir(), "superimg-node-interactions-"));
    roots.push(root);
    const counterPath = join(root, "provider-count.txt");
    await writeFile(join(root, "package.json"), '{"type":"module"}\n');
    const authoringFacade = await writeAuthoringFacade(root);
    await mkdir(join(root, "assets"));
    await writeFile(join(root, "assets/logo.svg"), "<svg>logo</svg>");
    await writeFile(join(root, "brand.svg"), "<svg>brand</svg>");
    await writeFile(
      join(root, "entries.server.ts"),
      [
        'import { appendFileSync } from "node:fs";',
        "export function loadCards() {",
        `  appendFileSync(${JSON.stringify(counterPath)}, "x");`,
        '  return [{ id: "one", title: "One" }];',
        "}",
      ].join("\n"),
    );
    await writeFile(
      join(root, "cards.media.ts"),
      [
        'import { collection, image, Html } from "framework/media";',
        'import { loadCards } from "./entries.server";',
        "export default collection({",
        "  entries: loadCards,",
        "  media: image<{ id: string; title: string }>({",
        '    assets: { brand: { url: "./brand.svg" } },',
        '    render: (ctx) => Html(`<main><img src="${ctx.asset("logo.svg")}"><img src="${ctx.asset("brand")}">${ctx.data.title}</main>`),',
        "  }),",
        "});",
      ].join("\n"),
    );

    const bytes = new TextEncoder().encode("rendered once");
    const dispose = vi.fn(async () => {});
    const portable = exportBundle(bytes, dispose);
    const runtime = fakeRuntime();
    const exportMedia = vi.fn(async (
      receivedRuntime: Runtime,
      media: {
        kind: string;
        entries?: readonly unknown[];
        media?: {
          config?: {
            assets?: Readonly<Record<string, { bytes?: Uint8Array; mimeType?: string }>>;
          };
        };
      },
      options: {
        providers?: string;
        editionIds?: readonly string[];
        encoding?: Readonly<Record<string, unknown>>;
      },
    ) => {
      expect(receivedRuntime).toBe(runtime);
      expect(media.kind).toBe("collection");
      expect(media.entries).toHaveLength(1);
      expect(new TextDecoder().decode(media.media?.config?.assets?.["logo.svg"]?.bytes)).toBe(
        "<svg>logo</svg>",
      );
      expect(media.media?.config?.assets?.["logo.svg"]?.mimeType).toBe("image/svg+xml");
      expect(new TextDecoder().decode(media.media?.config?.assets?.brand?.bytes)).toBe(
        "<svg>brand</svg>",
      );
      expect(options.providers).toBe("skip");
      expect(options.editionIds).toEqual(["square"]);
      expect(options.encoding).toEqual({ still: { quality: 82 } });
      return portable;
    });
    const check = vi.fn(async (_runtime, media: { kind: string }, options) => {
      expect(media.kind).toBe("collection");
      expect(options).toMatchObject({ providers: "skip", craft: true });
      return {
        schemaVersion: 0 as const,
        ok: true,
        programDigest: "program-cards",
        kind: "collection" as const,
        coordinates: [],
        findings: [],
      };
    });
    const inspect = vi.fn(async (_runtime, media: { kind: string }, options) => {
      expect(media.kind).toBe("collection");
      expect(options).toMatchObject({ providers: "skip", includeIR: true });
      return {
        schemaVersion: 0 as const,
        programDigest: "program-cards",
        kind: "collection" as const,
        coordinates: [],
        findings: [],
        assets: [],
        fonts: [],
        collection: { source: "provider" as const, resolved: false },
      };
    });
    const mount = createNodeMediaInteractionMount({
      projectRoot: root,
      runtime,
      authoringFacades: { "framework/media": authoringFacade },
      exportMedia: exportMedia as never,
      check: check as never,
      inspect: inspect as never,
    });
    const context = {};
    await expect(
      mount.dispatch(
        { interactionId: MEDIA_INTERACTION_IDS.discover, input: {} },
        context,
      ),
    ).resolves.toMatchObject({
      sources: [{ sourceId: "cards", sourceKind: "collection" }],
    });
    await expect(
      mount.dispatch(
        {
          interactionId: MEDIA_INTERACTION_IDS.describe,
          input: { source: "cards" },
        },
        context,
      ),
    ).resolves.toMatchObject({ collectionEntries: "provider" });
    expect(await readFile(counterPath, "utf8").catch(() => "")).toBe("");

    await expect(mount.dispatch({
      interactionId: MEDIA_INTERACTION_IDS.check,
      input: { source: "cards", craft: true },
    }, context)).resolves.toMatchObject({
      kind: "media-source-check",
      report: { kind: "collection", ok: true },
    });
    await expect(mount.dispatch({
      interactionId: MEDIA_INTERACTION_IDS.inspect,
      input: { source: "cards", includeIR: true },
    }, context)).resolves.toMatchObject({
      kind: "media-source-inspection",
      report: { collection: { source: "provider", resolved: false } },
    });
    expect(check).toHaveBeenCalledTimes(1);
    expect(inspect).toHaveBeenCalledTimes(1);
    expect(await readFile(counterPath, "utf8").catch(() => "")).toBe("");

    const snapshot = await mount.dispatch(
      {
        interactionId: MEDIA_INTERACTION_IDS.snapshot,
        input: { source: "cards" },
      },
      context,
    );
    expect(snapshot.entries.map((entry) => entry.id)).toEqual(["one"]);
    expect(await readFile(counterPath, "utf8")).toBe("x");

    const forgedBase = {
      schemaVersion: snapshot.schemaVersion,
      kind: snapshot.kind,
      source: snapshot.source,
      sourceId: snapshot.sourceId,
      providerHash: snapshot.providerHash,
      entries: snapshot.entries.map((entry) => ({
        ...entry,
        data: { ...entry.data, title: "Forged" },
      })),
    } as const;
    await expect(
      mount.dispatch(
        {
          interactionId: MEDIA_INTERACTION_IDS.export,
          input: {
            source: "cards",
            publication: {
              targetId: "project-output",
              publicationId: "forged/cards.export",
            },
            destinations: ["youtube"],
            snapshot: { ...forgedBase, snapshotDigest: hashJson(forgedBase) },
          },
        },
        context,
      ),
    ).rejects.toThrow("entry data digest does not match");
    expect(exportMedia).not.toHaveBeenCalled();

    const receipt = await mount.dispatch(
      {
        interactionId: MEDIA_INTERACTION_IDS.export,
        input: {
          source: "cards",
          publication: {
            targetId: "project-output",
            publicationId: "published/cards.export",
          },
          destinations: ["youtube"],
          editionIds: ["square"],
          encoding: { still: { quality: 82 } },
          snapshot,
        },
      },
      context,
    );
    expect(exportMedia).toHaveBeenCalledTimes(1);
    expect(dispose).toHaveBeenCalledTimes(1);
    expect(await readFile(counterPath, "utf8")).toBe("x");
    expect(receipt).toMatchObject({
      schemaVersion: 0,
      targetId: "project-output",
      publicationId: "published/cards.export",
      manifestDigest: expect.stringMatching(/^[a-f0-9]{64}$/),
      manifest: {
        kind: "media-export",
        sourceId: "cards",
        snapshotDigest: snapshot.snapshotDigest,
        providerHash: snapshot.providerHash,
      },
    });
    expect(
      await readFile(join(await realpath(root), "output/published/cards.export/export.json"), "utf8"),
    ).toContain('"kind": "media-export"');
  }, 20_000);

  it("checks the accepted input identity against the bundle loaded for export before the effect", async () => {
    const root = await mkdtemp(join(tmpdir(), "superimg-node-export-identity-"));
    roots.push(root);
    await writeFile(join(root, "package.json"), '{"type":"module"}\n');
    await writeFile(join(root, "render.ts"), `import { Html } from "@foxworth/superimg";
export function render() { return Html({ html: "<main>Before</main>" }); }\n`);
    await writeFile(join(root, "cards.media.ts"), `import { collection, image } from "@foxworth/superimg";
import { render } from "./render";
export default collection({ entries: [{ id: "one", title: "One" }], media: image({ render }) });\n`);
    const runtime = fakeRuntime();
    const exportMedia = vi.fn(async () => exportBundle(new TextEncoder().encode("rendered"), async () => {}));
    const mount = createNodeMediaInteractionMount({
      projectRoot: root,
      runtime,
      executionOptions: (context: NodeMediaExecutionOptions) => context,
      exportMedia: exportMedia as never,
    });
    const snapshot = await mount.dispatch({
      interactionId: MEDIA_INTERACTION_IDS.snapshot,
      input: { source: "cards" },
    }, {});
    const accepted = await bundleMediaProgramPair(join(root, "cards.media.ts"));
    expect(accepted.iife.inputIdentity).toBe(accepted.esm.inputIdentity);
    expect(accepted.iife.inputIdentity).toEqual(expect.any(String));
    const expectedInputIdentity = (await compileNodeMediaSource(root, "cards")).bundle.inputIdentity!;

    // Simulate an authored helper changing between the home route's fingerprint
    // check and the interaction's source-resolution/compile stage.
    await writeFile(join(root, "render.ts"), `import { Html } from "@foxworth/superimg";
export function render() { return Html({ html: "<main>After</main>" }); }\n`);
    await expect(mount.dispatch({
      interactionId: MEDIA_INTERACTION_IDS.export,
      input: {
        source: "cards",
        publication: { targetId: "project-output", publicationId: "cards/stale.export" },
        destinations: ["youtube"],
        entryIds: ["one"],
        snapshot,
      },
    }, { expectedInputIdentity })).rejects.toMatchObject({ code: "COLLECTION_SOURCE_CHANGED" });
    expect(exportMedia).not.toHaveBeenCalled();

    const refreshedIdentity = (await compileNodeMediaSource(root, "cards")).bundle.inputIdentity!;
    expect(refreshedIdentity).not.toBe(expectedInputIdentity);
    const receipt = await mount.dispatch({
      interactionId: MEDIA_INTERACTION_IDS.export,
      input: {
        source: "cards",
        publication: { targetId: "project-output", publicationId: "cards/current.export" },
        destinations: ["youtube"],
        entryIds: ["one"],
        snapshot,
      },
    }, { expectedInputIdentity: refreshedIdentity });
    expect(exportMedia).toHaveBeenCalledTimes(1);
    expect(receipt).toMatchObject({ publicationId: "cards/current.export", manifest: { entries: [{ id: "one" }] } });
  }, 20_000);

  it("bridges runtime rendition and frame events into ordered interaction progress", async () => {
    const root = await writeSimpleImageSource();
    const records: MediaInteractionProgressRecord[] = [];
    const bytes = new TextEncoder().encode("rendered");
    const exportMedia = vi.fn(async (
      _runtime: Runtime,
      _media: unknown,
      options: ExportOptions,
    ) => {
      expect(options.onProgress).toBeTypeOf("function");
      const item = runtimeRenditionItem("launch:youtube");
      await emitRuntimeProgress(options, {
        schemaVersion: 0,
        kind: "@foxworth/superimg/export-progress",
        stageId: "runtime.render",
        state: "started",
        work: { unit: "renditions", completed: 0, total: 1 },
      });
      await emitRuntimeProgress(options, {
        schemaVersion: 0,
        kind: "@foxworth/superimg/export-progress",
        stageId: "runtime.render",
        item,
        state: "started",
        work: { unit: "frames", completed: 0, total: 2 },
      });
      await emitRuntimeProgress(options, {
        schemaVersion: 0,
        kind: "@foxworth/superimg/export-progress",
        stageId: "runtime.render",
        item,
        state: "running",
        work: { unit: "frames", completed: 1, total: 2 },
      });
      await emitRuntimeProgress(options, {
        schemaVersion: 0,
        kind: "@foxworth/superimg/export-progress",
        stageId: "runtime.render",
        item,
        state: "succeeded",
        work: { unit: "frames", completed: 2, total: 2 },
      });
      await emitRuntimeProgress(options, {
        schemaVersion: 0,
        kind: "@foxworth/superimg/export-progress",
        stageId: "runtime.render",
        state: "running",
        work: { unit: "renditions", completed: 1, total: 1 },
      });
      await emitRuntimeProgress(options, {
        schemaVersion: 0,
        kind: "@foxworth/superimg/export-progress",
        stageId: "runtime.render",
        state: "succeeded",
        work: { unit: "renditions", completed: 1, total: 1 },
      });
      return exportBundle(bytes, vi.fn(async () => {}));
    });
    const mount = createNodeMediaInteractionMount({
      projectRoot: root,
      runtime: fakeRuntime(),
      exportMedia,
      progress: () => ({
        executionId: "build:launch",
        observer: { append: (record) => { records.push(record); } },
      }),
    });

    await expect(mount.dispatch({
      interactionId: MEDIA_INTERACTION_IDS.export,
      input: {
        source: "launch",
        publication: {
          targetId: "project-output",
          publicationId: "launch/export",
        },
        destinations: ["youtube"],
      },
    }, {})).resolves.toMatchObject({
      schemaVersion: 0,
      targetId: "project-output",
      publicationId: "launch/export",
    });

    expect(records.map(({ subject, state }) => [
      subject.kind === "interaction"
        ? "interaction"
        : subject.kind === "stage"
          ? subject.stageId
          : subject.item.itemId,
      state,
    ])).toEqual([
      ["interaction", "started"],
      ["source.resolve", "started"],
      ["source.resolve", "succeeded"],
      ["runtime.render", "started"],
      ["launch:youtube", "started"],
      ["launch:youtube", "running"],
      ["launch:youtube", "succeeded"],
      ["runtime.render", "running"],
      ["runtime.render", "succeeded"],
      ["publication.commit", "started"],
      ["publication.commit", "succeeded"],
      ["interaction", "succeeded"],
    ]);
    expect(records.map(({ sequence }) => sequence).every(
      (sequence, index) => sequence === index,
    )).toBe(true);
    const sourceStarted = records.find((record) =>
      record.subject.kind === "stage" &&
      record.subject.stageId === "source.resolve" &&
      record.state === "started"
    );
    expect(sourceStarted?.work).toEqual({ unit: "items", completed: 0 });
    expect(sourceStarted?.work).not.toHaveProperty("total");
    const rendition = records.find((record) => record.subject.kind === "item");
    expect(rendition?.subject).toMatchObject({
      item: {
        kind: "rendition",
        sourceId: "launch",
        variantId: "default",
        editionId: "default",
        renditionId: "youtube",
      },
    });
  }, 20_000);

  it("preserves partial rendition failure before the interaction terminal", async () => {
    const root = await writeSimpleImageSource();
    const records: MediaInteractionProgressRecord[] = [];
    const exportMedia = vi.fn(async (
      _runtime: Runtime,
      _media: unknown,
      options: ExportOptions,
    ) => {
      const first = runtimeRenditionItem("launch:first", "first");
      const second = runtimeRenditionItem("launch:second", "second");
      for (const event of [
        runtimeEvent({ state: "started", work: { unit: "renditions", completed: 0, total: 2 } }),
        runtimeEvent({ item: first, state: "started" }),
        runtimeEvent({ item: first, state: "succeeded" }),
        runtimeEvent({ item: second, state: "started" }),
        runtimeEvent({
          item: second,
          state: "failed",
          error: { code: "ENCODE_FAILED", message: "second failed" },
        }),
        runtimeEvent({
          state: "failed",
          work: { unit: "renditions", completed: 1, total: 2 },
          error: { code: "ENCODE_FAILED", message: "second failed" },
        }),
      ] satisfies ExportProgressEvent[]) {
        await emitRuntimeProgress(options, event);
      }
      throw new Error("second failed");
    });
    const mount = createNodeMediaInteractionMount({
      projectRoot: root,
      runtime: fakeRuntime(),
      exportMedia,
      progress: () => ({
        executionId: "build:partial",
        observer: { append: (record) => { records.push(record); } },
      }),
    });

    await expect(mount.dispatch({
      interactionId: MEDIA_INTERACTION_IDS.export,
      input: {
        source: "launch",
        publication: {
          targetId: "project-output",
          publicationId: "launch/partial",
        },
        destinations: ["youtube"],
      },
    }, {})).rejects.toThrow("second failed");

    expect(records.filter((record) => record.subject.kind === "item").map(
      (record) => [
        record.subject.kind === "item" ? record.subject.item.itemId : "",
        record.state,
      ],
    )).toEqual([
      ["launch:first", "started"],
      ["launch:first", "succeeded"],
      ["launch:second", "started"],
      ["launch:second", "failed"],
    ]);
    expect(records.at(-2)).toMatchObject({
      subject: { kind: "stage", stageId: "runtime.render" },
      state: "failed",
    });
    expect(records.at(-1)).toMatchObject({
      subject: { kind: "interaction" },
      state: "failed",
    });
  }, 20_000);

  it("maps runtime cancellation through the Node mount", async () => {
    const root = await writeSimpleImageSource();
    const records: MediaInteractionProgressRecord[] = [];
    const exportMedia = vi.fn(async (
      _runtime: Runtime,
      _media: unknown,
      options: ExportOptions,
    ) => {
      await emitRuntimeProgress(options, runtimeEvent({ state: "started" }));
      await emitRuntimeProgress(options, runtimeEvent({
        state: "cancelled",
        reason: "cancelled by build host",
      }));
      const error = new Error("cancelled by build host");
      error.name = "AbortError";
      throw error;
    });
    const mount = createNodeMediaInteractionMount({
      projectRoot: root,
      runtime: fakeRuntime(),
      exportMedia,
      progress: () => ({
        executionId: "build:cancelled",
        observer: { append: (record) => { records.push(record); } },
      }),
    });

    await expect(mount.dispatch({
      interactionId: MEDIA_INTERACTION_IDS.export,
      input: {
        source: "launch",
        publication: {
          targetId: "project-output",
          publicationId: "launch/cancelled",
        },
        destinations: ["youtube"],
      },
    }, {})).rejects.toMatchObject({ name: "AbortError" });
    expect(records.at(-2)).toMatchObject({
      subject: { kind: "stage", stageId: "runtime.render" },
      state: "cancelled",
      reason: "cancelled by build host",
    });
    expect(records.at(-1)).toMatchObject({
      subject: { kind: "interaction" },
      state: "cancelled",
    });
  }, 20_000);
});

function fakeRuntime(): Runtime {
  const dispose = async () => {};
  return {
    abi: "test-runtime",
    capabilities: {
      schemaVersion: 0,
      check: true,
      inspect: true,
      documents: ["html", "svg"],
      rasters: ["png"],
      animated: ["mp4"],
      collections: { static: true, providers: true },
      assets: { url: true, bytes: true },
      fonts: { logical: true, frozenBytes: true },
    },
    dispose,
    [Symbol.asyncDispose]: dispose,
  };
}

async function writeAuthoringFacade(root: string): Promise<string> {
  const modulePath = join(root, "framework-media.ts");
  await writeFile(
    modulePath,
    'export { collection, image, Html } from "@foxworth/superimg";\n',
  );
  return modulePath;
}

async function writeSimpleImageSource(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), "superimg-node-progress-"));
  roots.push(root);
  await writeFile(join(root, "package.json"), '{"type":"module"}\n');
  await writeFile(
    join(root, "launch.media.ts"),
    [
      'import { image, Html } from "@foxworth/superimg";',
      "export default image({",
      '  render: () => Html({ html: "<main>Launch</main>" }),',
      "});",
    ].join("\n"),
  );
  return root;
}

function runtimeRenditionItem(itemId: string, entryId = "one") {
  return {
    itemId,
    kind: "rendition" as const,
    entryId,
    variantId: "default",
    editionId: "default",
    renditionId: "youtube",
  };
}

type RuntimeProgressUpdate<Event = ExportProgressEvent> =
  Event extends ExportProgressEvent
    ? Omit<Event, "schemaVersion" | "kind" | "stageId">
    : never;

function runtimeEvent(value: RuntimeProgressUpdate): ExportProgressEvent {
  return {
    schemaVersion: 0,
    kind: "@foxworth/superimg/export-progress",
    stageId: "runtime.render",
    ...value,
  };
}

async function emitRuntimeProgress(
  options: ExportOptions,
  event: ExportProgressEvent,
): Promise<void> {
  await options.onProgress?.(event);
}

function exportBundle(bytes: Uint8Array, dispose: () => Promise<void>): ExportBundle {
  const sha256 = createHash("sha256").update(bytes).digest("hex");
  const artifact = {
    path: "youtube/cards.mp4",
    mimeType: "video/mp4",
    byteLength: bytes.byteLength,
    sha256,
    coordinates: {
      entryId: "one",
      variantId: "default",
      editionId: "default",
      renditionId: "youtube",
    },
    stream() {
      const copy = bytes.slice();
      return new ReadableStream<Uint8Array>({
        start(controller) {
          controller.enqueue(copy);
          controller.close();
        },
      });
    },
    async bytes() {
      return bytes.slice();
    },
    async blob() {
      return new Blob([bytes.slice()], { type: "video/mp4" });
    },
    async text() {
      return new TextDecoder().decode(bytes);
    },
  };
  return {
    manifest: {
      kind: "@foxworth/superimg/export-bundle",
      schemaVersion: 0,
      programDigest: "program-cards",
      coordinates: [
        { entryId: "one", variantId: "default", editionId: "default" },
      ],
      artifacts: [artifact],
      assets: [],
      fonts: [],
    },
    artifacts: [artifact],
    dispose,
    [Symbol.asyncDispose]: dispose,
  };
}
