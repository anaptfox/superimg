import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ORGANIC_DESTINATIONS } from "@superimg/core/destinations";
import type { MediaArtifactCompileInteractionInput } from "../contracts.js";
import type { MediaDirectDispatcher } from "../mount.js";
import { compileNodeMediaArtifact } from "./artifact.js";
import {
  createMediaArtifactCompileControlHook,
  createMediaExportControlHook,
  createMediaSnapshotControlHook,
} from "./control-hooks.js";
import { hashJson } from "./provider.js";
import {
  createProjectMediaTargetRegistry,
  type MediaTargetRegistry,
} from "./targets.js";

const roots: string[] = [];
const REALIZATION = `sha256:${"a".repeat(64)}` as const;

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

describe("native media control hooks", () => {
  it("rejects target-registry drift before apply dispatches", async () => {
    const root = await imageProject();
    let registryDigest = "1".repeat(64);
    const targets: MediaTargetRegistry<Record<string, never>> = {
      resolve({ targetId }) {
        return {
          targetId,
          rootPath: join(root, "output"),
          registryDigest,
        };
      },
    };
    const dispatch = vi.fn() as unknown as MediaDirectDispatcher<Record<string, never>>;
    const hook = createMediaArtifactCompileControlHook({
      projectRoot: root,
      targets,
      dispatch,
      realizationDigest: REALIZATION,
    });
    const input = {
      source: "launch",
      target: { targetId: "artifacts", artifactId: "launch.superimg" },
    } as const;
    const plan = await hook.plan({ input, context: {} });

    expect(JSON.stringify(plan.preview)).not.toContain(root);
    expect(plan.baseline).toMatchObject({ registryDigest: "1".repeat(64) });
    registryDigest = "2".repeat(64);

    await expect(hook.apply(execution(input, plan.state) as never)).rejects.toThrow(
      "target registry changed",
    );
    expect(dispatch).not.toHaveBeenCalled();
  });

  it("reconciles exact missing, committed, and corrupt artifact states conservatively", async () => {
    const root = await imageProject();
    const targets = createProjectMediaTargetRegistry<Record<string, never>>(root);
    const dispatch = (async (request, context) => {
      if (request.interactionId !== "media.artifact.compile") throw new Error("unexpected interaction");
      return compileNodeMediaArtifact({
        projectRoot: root,
        input: request.input as MediaArtifactCompileInteractionInput,
        context,
        targets,
      });
    }) as MediaDirectDispatcher<Record<string, never>>;
    const hook = createMediaArtifactCompileControlHook({
      projectRoot: root,
      targets,
      dispatch,
      realizationDigest: REALIZATION,
    });
    const input = {
      source: "launch",
      target: { targetId: "project-artifacts", artifactId: "launch.superimg" },
      verify: true,
    } as const;
    const plan = await hook.plan({ input, context: {} });
    const versionOneInput = { ...input, artifactSchemaVersion: 1 as const };
    const versionOnePlan = await hook.plan({ input: versionOneInput, context: {} });

    await expect(hook.reconcile(execution(input, plan.state) as never)).resolves.toMatchObject({
      status: "not-applied",
    });

    const output = await hook.apply(execution(input, plan.state) as never);
    expect(output).not.toHaveProperty("path");
    await expect(hook.reconcile(execution(versionOneInput, versionOnePlan.state) as never)).resolves.toEqual({ status: "uncertain" });
    await expect(hook.verify({
      ...execution(input, plan.state),
      output,
    } as never)).resolves.toMatchObject({ ok: true });
    await expect(hook.reconcile(execution(input, plan.state) as never)).resolves.toMatchObject({
      status: "completed",
      value: {
        targetId: "project-artifacts",
        artifactId: "launch.superimg",
        artifactHash: output.artifactHash,
      },
    });

    await writeFile(
      join(root, "output/launch.superimg/media.json"),
      '{"corrupt":true}\n',
    );
    await expect(hook.reconcile(execution(input, plan.state) as never)).resolves.toEqual({
      status: "uncertain",
    });
  }, 30_000);

  it("never executes providers while planning and leaves provider reconciliation uncertain", async () => {
    const root = await providerProject();
    const counter = join(root, "provider-count.txt");
    const dispatch = vi.fn() as unknown as MediaDirectDispatcher<Record<string, never>>;
    const hook = createMediaSnapshotControlHook({
      projectRoot: root,
      targets: createProjectMediaTargetRegistry(root),
      dispatch,
      realizationDigest: REALIZATION,
      authoringFacades: {
        "framework/media": join(root, "framework-media.ts"),
      },
    });
    const input = { source: "cards" } as const;
    const plan = await hook.plan({ input, context: {} });

    expect(plan.baseline).toMatchObject({ providerDigest: expect.stringMatching(/^[a-f0-9]{64}$/) });
    expect(await readFile(counter, "utf8").catch(() => "")).toBe("");
    await expect(hook.reconcile(execution(input, plan.state) as never)).resolves.toEqual({
      status: "uncertain",
    });
    expect(dispatch).not.toHaveBeenCalled();
    expect(await readFile(counter, "utf8").catch(() => "")).toBe("");
  }, 20_000);

  it("verifies publication bytes and reconciles only the exact planned export", async () => {
    const root = await imageProject();
    const targets = createProjectMediaTargetRegistry<Record<string, never>>(root);
    const input = {
      source: "launch",
      publication: { targetId: "project-output", publicationId: "launch.export" },
      destinations: ["youtube"],
    } as const;
    const bytes = new TextEncoder().encode("rendered media");
    const dispatch = (async (request) => {
      if (request.interactionId !== "media.export") throw new Error("unexpected interaction");
      const path = join(root, "output/launch.export");
      await mkdir(join(path, "media/youtube"), { recursive: true });
      await writeFile(join(path, "media/youtube/launch.mp4"), bytes);
      const runtime = { programDigest: "runtime-program" };
      const manifest = {
        schemaVersion: 0,
        kind: "media-export",
        sourceId: "launch",
        publication: input.publication,
        requestDigest: hashJson({
          sourceId: "launch",
          targetId: "project-output",
          publicationId: "launch.export",
          destinations: input.destinations,
          entryIds: [],
          variantIds: [],
          editionIds: [],
          stillFrame: null,
          encoding: null,
          snapshotDigest: null,
          providerHash: null,
          programDigest: runtime.programDigest,
        }),
        destinationRegistryDigest: hashJson(ORGANIC_DESTINATIONS),
        producer: { name: "superimg", version: "test" },
        entries: [],
        runtime,
        renditions: [{
          path: "media/youtube/launch.mp4",
          mimeType: "video/mp4",
          bytes: bytes.byteLength,
          sha256: sha256(bytes),
          coordinates: {
            sourceId: "launch",
            variantId: "default",
            editionId: "default",
            renditionId: "youtube",
          },
        }],
      };
      await writeFile(join(path, "export.json"), JSON.stringify(manifest));
      return {
        schemaVersion: 0,
        ...input.publication,
        manifestDigest: hashJson(manifest),
        manifest,
      };
    }) as MediaDirectDispatcher<Record<string, never>>;
    const hook = createMediaExportControlHook({
      projectRoot: root,
      targets,
      dispatch,
      realizationDigest: REALIZATION,
    });
    const plan = await hook.plan({ input, context: {} });
    const output = await hook.apply(execution(input, plan.state) as never);

    await expect(hook.verify({ ...execution(input, plan.state), output } as never))
      .resolves.toMatchObject({ ok: true });
    await expect(hook.reconcile(execution(input, plan.state) as never)).resolves.toMatchObject({
      status: "completed",
      value: { manifestDigest: output.manifestDigest },
    });

    await writeFile(join(root, "output/launch.export/media/youtube/launch.mp4"), "tampered");
    await expect(hook.reconcile(execution(input, plan.state) as never)).resolves.toEqual({
      status: "uncertain",
    });
  }, 20_000);

  it("requires a frozen snapshot for controlled provider artifact planning", async () => {
    const root = await providerProject();
    const counter = join(root, "provider-count.txt");
    const hook = createMediaArtifactCompileControlHook({
      projectRoot: root,
      targets: createProjectMediaTargetRegistry(root),
      dispatch: vi.fn() as unknown as MediaDirectDispatcher<Record<string, never>>,
      realizationDigest: REALIZATION,
      authoringFacades: {
        "framework/media": join(root, "framework-media.ts"),
      },
    });

    await expect(hook.plan({
      input: {
        source: "cards",
        target: { targetId: "project-artifacts", artifactId: "cards.superimg" },
      },
      context: {},
    })).rejects.toThrow("require a supplied collection snapshot");
    expect(await readFile(counter, "utf8").catch(() => "")).toBe("");
    expect(existsSync(join(root, "output/cards.superimg"))).toBe(false);
  }, 20_000);
});

function execution<Input, State>(input: Input, state: State) {
  return {
    input,
    state,
    context: {},
    proposal: { id: "proposal-1" },
    lease: {
      owner: "worker-1",
      fence: 1,
      expiresAt: Date.now() + 10_000,
      async renew() {
        return { owner: "worker-1", fence: 1, expiresAt: Date.now() + 10_000 };
      },
    },
  };
}

async function imageProject(): Promise<string> {
  const root = await project("superimg-media-control-image-");
  await writeFile(
    join(root, "launch.media.ts"),
    [
      'import { image, Html } from "@foxworth/superimg";',
      "export default image({",
      '  sample: { title: "Launch" },',
      '  render: (ctx) => Html({ html: `<main>${ctx.data.title}</main>` }),',
      "});",
    ].join("\n"),
  );
  return root;
}

async function providerProject(): Promise<string> {
  const root = await project("superimg-media-control-provider-");
  await writeFile(
    join(root, "framework-media.ts"),
    'export { collection, image, Html } from "@foxworth/superimg";\n',
  );
  const counter = join(root, "provider-count.txt");
  await writeFile(
    join(root, "entries.server.ts"),
    [
      'import { appendFileSync } from "node:fs";',
      `export const entries = () => { appendFileSync(${JSON.stringify(counter)}, "x"); return [{ id: "one" }]; };`,
    ].join("\n"),
  );
  await writeFile(
    join(root, "cards.media.ts"),
    [
      'import { collection, image, Html } from "framework/media";',
      'import { entries } from "./entries.server";',
      "export default collection({",
      "  entries,",
      '  media: image({ render: (ctx) => Html({ html: `<main>${ctx.data.id}</main>` }) }),',
      "});",
    ].join("\n"),
  );
  return root;
}

async function project(prefix: string): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), prefix));
  roots.push(root);
  await writeFile(join(root, "package.json"), '{"type":"module"}\n');
  await mkdir(join(root, "assets"));
  return root;
}

function sha256(value: Uint8Array): string {
  return createHash("sha256").update(value).digest("hex");
}
