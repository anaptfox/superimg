import { createHash } from "node:crypto";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  buildTemplatePackage,
  capabilitiesForProfile,
  computeMediaIRHashes,
  sha256Hex,
  validateMediaIR,
} from "@superimg/core";
import type {
  JsonObject,
  MediaIR,
  TemplatePackage,
} from "@superimg/types";
import { describe, expect, it, vi } from "vitest";
import { admitAll, bindProjection } from "@foxworth/boundary";
import {
  RENDER_COMPILED_INTERACTIONS,
  RENDER_INTERACTION_IDS,
  createNodeRenderInteractionMount,
  createPackageRenderControlHook,
  executePackageRender,
  executeDirectPackageRender,
  FileSystemRenderResultStore,
  InMemoryRenderPackageStore,
  InMemoryRenderResultStore,
  installRenderInteractions,
  preparePackageRender,
  projectRenderInteractions,
  renderDigest,
  type MediaPackageRenderInteractionInput,
  type MediaPackageRenderReceipt,
  type PackageRenderExecutor,
} from "./index.js";

const REALIZATION = `sha256:${"a".repeat(64)}` as const;
const PACKAGES = `sha256:${"b".repeat(64)}` as const;
const RESULTS = `sha256:${"c".repeat(64)}` as const;

function minimalIR(): MediaIR {
  const base = {
    kind: "@foxworth/superimg/media-ir" as const,
    schemaVersion: 0 as const,
    identity: { sourceId: "demo", variantId: "default", editionId: "default" },
    medium: "html" as const,
    animated: true,
    canvas: { width: 100, height: 100 },
    renderConfig: {
      fonts: [],
      inlineCss: [],
      stylesheets: [],
      tailwind: null,
      background: null,
      watermark: null,
      readiness: null,
      mode: "frame" as const,
    },
    clock: { fps: 30, durationSeconds: 1, totalFrames: 30 },
    capabilities: {
      temporal: "canonical" as const,
      motion: "none" as const,
      visual: "opaque-html" as const,
      portability: "self-contained" as const,
      determinism: "verified" as const,
      issues: [],
    },
    provenance: {
      programHash: "d".repeat(64),
      sourceId: "demo",
      compiler: "superimg" as const,
      compilerVersion: 0 as const,
    },
    scenes: [{
      id: "default",
      index: 0,
      range: { startFrame: 0, endFrame: 30 },
      phases: [],
      markers: [],
      transitions: [],
    }],
    tracks: [],
    motions: [],
    assets: [],
    extensions: {},
    observations: {
      markupRuns: [{ range: { startFrame: 0, endFrame: 30 }, hash: "e".repeat(64) }],
      sceneRuns: [{ range: { startFrame: 0, endFrame: 30 }, hash: "f".repeat(64) }],
    },
    hashes: {
      intentHash: "1".repeat(64),
      markupHash: "2".repeat(64),
      programHash: "d".repeat(64),
    },
  };
  return validateMediaIR({
    ...base,
    hashes: computeMediaIRHashes(base, base.provenance.programHash),
  });
}

function samplePackage(): TemplatePackage {
  const program = "export default {};";
  return buildTemplatePackage({
    sourceId: "demo",
    program: {
      path: "program.mjs",
      sha256: sha256Hex(program),
      format: "esm",
      bytes: new TextEncoder().encode(program).byteLength,
    },
    media: minimalIR(),
  });
}

function request(pkg: TemplatePackage): MediaPackageRenderInteractionInput {
  return {
    schemaVersion: 0,
    sourceId: pkg.sourceId,
    packageHash: pkg.packageHash,
    data: { title: "Hello" },
    output: { format: "mp4", profile: "node" },
  };
}

function fakeExecutor(counter?: { value: number }): PackageRenderExecutor {
  return vi.fn(async () => {
    if (counter) counter.value += 1;
    const body = new TextEncoder().encode("deterministic-render");
    return {
      body,
      mimeType: "video/mp4",
      byteLength: body.byteLength,
      sha256: createHash("sha256").update(body).digest("hex"),
    };
  });
}

function host(pkg: TemplatePackage, resultStore = new InMemoryRenderResultStore(RESULTS)) {
  return {
    packageStore: new InMemoryRenderPackageStore(PACKAGES, [{
      packageDir: "/unused-by-fake-executor",
      package: pkg,
    }]),
    resultStore,
    capabilities: capabilitiesForProfile("node", { ffmpeg: null }),
    realizationDigest: REALIZATION,
    executor: fakeExecutor(),
  } as const;
}

describe("package render service", () => {
  it("derives stable result identity and deduplicates committed direct renders", async () => {
    const pkg = samplePackage();
    const counter = { value: 0 };
    const options = { ...host(pkg), executor: fakeExecutor(counter) };
    const input = request(pkg);
    const first = await executeDirectPackageRender(options, input, {});
    const second = await executeDirectPackageRender(options, input, {});

    expect(first).toEqual(second);
    expect(first.resultId).toMatch(/^sha256:[a-f0-9]{64}$/u);
    expect(counter.value).toBe(1);
    expect(first).not.toHaveProperty("url");
    expect(first).not.toHaveProperty("path");
    const opened = await options.resultStore.open(first.resultId);
    expect(new TextDecoder().decode(await new Response(opened).arrayBuffer())).toBe(
      "deterministic-render",
    );
  });

  it("fails capability and package admission before execution", async () => {
    const pkg = samplePackage();
    const execute = fakeExecutor();
    const options = { ...host(pkg), executor: execute };
    await expect(
      preparePackageRender(options, {
        ...request(pkg),
        output: { format: "gif", profile: "node" },
      }),
    ).rejects.toMatchObject({ code: "UNSUPPORTED_RENDER_PATH" });
    await expect(
      preparePackageRender(options, {
        ...request(pkg),
        packageHash: "0".repeat(64),
      }),
    ).rejects.toMatchObject({ code: "PACKAGE_NOT_FOUND" });
    await expect(
      preparePackageRender(options, {
        ...request(pkg),
        output: { format: "html", profile: "node" },
      }),
    ).resolves.toMatchObject({ profile: "node" });
    expect(execute).not.toHaveBeenCalled();
  });

  it("dispatches the exact interaction through the direct mount", async () => {
    const pkg = samplePackage();
    const mount = createNodeRenderInteractionMount(host(pkg));
    expect(Object.keys(mount)).toEqual(["dispatch"]);
    await expect(
      mount.dispatch(
        { interactionId: RENDER_INTERACTION_IDS.render, input: request(pkg) },
        {},
      ),
    ).resolves.toMatchObject({ kind: "media-render-result" });
  });

  it("converges concurrent direct commits on one exact receipt", async () => {
    const pkg = samplePackage();
    const options = host(pkg);
    const [left, right] = await Promise.all([
      executeDirectPackageRender(options, request(pkg), {}),
      executeDirectPackageRender(options, request(pkg), {}),
    ]);
    expect(left).toEqual(right);
    expect(await options.resultStore.inspect(left.resultId)).toEqual({
      status: "committed",
      receipt: left,
    });
  });

  it("executes verified package bytes without the removed CLI job service", async () => {
    const root = await mkdtemp(join(tmpdir(), "superimg-package-"));
    const program = `const __element = (type, props, children = []) => ({
  $$typeof: "@foxworth/superimg/element", type, props, children,
});
const Html = (props) => __element("Html", { width: "fill", height: "fill", ...props });
const __template = { default: {
  kind: "media", media: "video", fallbackFormat: "mp4", medium: "html", animated: true,
  sample: { title: "sample" },
  config: { width: 100, height: 100, fps: 30, duration: "1s" },
  render(ctx) { return Html({ html: '<div data-title="' + ctx.data.title + '"></div>' }); }
} };`;
    try {
      const base = samplePackage();
      const pkg = buildTemplatePackage({
        sourceId: base.sourceId,
        program: {
          path: "program.mjs",
          sha256: sha256Hex(program),
          format: "iife",
          bytes: new TextEncoder().encode(program).byteLength,
        },
        media: base.media,
      });
      await writeFile(join(root, "program.mjs"), program);
      const result = await executePackageRender({
        packageDir: root,
        package: pkg,
        input: {
          ...request(pkg),
          data: { title: "verified" },
          output: { format: "html", profile: "node" },
        },
        profile: "node",
      });
      expect(result.mimeType).toContain("text/html");
      expect(new TextDecoder().decode(result.body)).toContain("verified");
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});

describe("package render control", () => {
  it("can project request mode before Installation and reports missing request at bind", async () => {
    const pkg = samplePackage();
    const options = host(pkg);
    const execute = vi.fn(options.executor);
    const mount = createNodeRenderInteractionMount({
      ...options,
      executor: execute,
    });
    const projection = await projectRenderInteractions({ render: "request" });
    expect(projection.handles.render.modes).toEqual(["request"]);
    const { installation } = await installRenderInteractions(mount, {
      installationId: "deploy:render:direct-only:1",
      realizationIds: { render: { direct: "realization:render:1" } },
    });
    const result = await bindProjection(projection, installation, { admit: admitAll });
    expect(result.status).toBe("unrealized");
    if (result.status !== "unrealized") throw new Error("expected unrealized");
    expect(result.report.issues).toEqual([
      expect.objectContaining({ reason: "missing-request" }),
    ]);
    expect(execute).not.toHaveBeenCalled();
  });

  it("plans, applies, verifies, and reconciles through host-owned control state", async () => {
    const pkg = samplePackage();
    const options = host(pkg);
    const hook = createPackageRenderControlHook(options);
    const input = request(pkg);
    const plan = await hook.plan({ input, context: {} });
    const lease = {
      owner: "worker-a",
      fence: 7,
      expiresAt: Date.now() + 10_000,
      renew: vi.fn(async () => ({
        owner: "worker-a",
        fence: 7,
        expiresAt: Date.now() + 10_000,
      })),
    };
    const execution = {
      input,
      state: plan.state,
      proposal: { id: "proposal-1" },
      lease,
      context: {},
    };
    const output = await hook.apply(execution as never);
    expect(lease.renew).toHaveBeenCalledTimes(1);
    await expect(hook.verify({ ...execution, output } as never)).resolves.toMatchObject({
      ok: true,
    });
    await expect(hook.reconcile(execution as never)).resolves.toEqual({
      status: "completed",
      value: output,
    });
  });

  it("never removes an unknown or newer fenced partial during reconciliation", async () => {
    const pkg = samplePackage();
    const store = new InMemoryRenderResultStore(RESULTS);
    const options = host(pkg, store);
    const hook = createPackageRenderControlHook(options);
    const input = request(pkg);
    const plan = await hook.plan({ input, context: {} });
    const prepared = await preparePackageRender(options, input);
    const body = new Uint8Array([1]);
    const receipt: MediaPackageRenderReceipt = {
      schemaVersion: 0,
      kind: "media-render-result",
      resultId: prepared.resultId,
      sourceId: input.sourceId,
      packageHash: input.packageHash,
      profile: prepared.profile,
      mimeType: "video/mp4",
      byteLength: 1,
      sha256: createHash("sha256").update(body).digest("hex"),
      output: input.output,
    };
    await store.stage({ receipt, body, owner: "newer", fence: 9 });
    const execution = {
      input,
      state: plan.state,
      proposal: { id: "proposal-1" },
      lease: {
        owner: "reconciler",
        fence: 8,
        expiresAt: Date.now() + 10_000,
        renew: async () => ({ owner: "reconciler", fence: 8, expiresAt: Date.now() + 10_000 }),
      },
      context: {},
    };
    await expect(hook.reconcile(execution as never)).resolves.toEqual({ status: "uncertain" });
  });

  it("reconciles an interrupted pre-commit render as proven not applied", async () => {
    const pkg = samplePackage();
    const options = {
      ...host(pkg),
      executor: vi.fn(async () => {
        throw new DOMException("cancelled", "AbortError");
      }),
    };
    const hook = createPackageRenderControlHook(options);
    const input = request(pkg);
    const plan = await hook.plan({ input, context: {} });
    const execution = {
      input,
      state: plan.state,
      proposal: { id: "proposal-cancel" },
      lease: {
        owner: "worker-cancel",
        fence: 3,
        expiresAt: Date.now() + 10_000,
        renew: async () => ({ owner: "worker-cancel", fence: 3, expiresAt: Date.now() + 10_000 }),
      },
      context: {},
    };
    await expect(hook.apply(execution as never)).rejects.toMatchObject({
      name: "AbortError",
    });
    await expect(hook.reconcile(execution as never)).resolves.toEqual({
      status: "not-applied",
      reason: "no committed render result exists for the planned result id",
    });
  });

  it("reconciles a crash after atomic commit but before the receipt returns as completed", async () => {
    const pkg = samplePackage();
    class CrashAfterCommitStore extends InMemoryRenderResultStore {
      override async commit(
        stage: Parameters<InMemoryRenderResultStore["commit"]>[0],
      ): Promise<MediaPackageRenderReceipt> {
        await super.commit(stage);
        throw new Error("worker crashed after commit");
      }
    }
    const store = new CrashAfterCommitStore(RESULTS);
    const options = host(pkg, store);
    const hook = createPackageRenderControlHook(options);
    const input = request(pkg);
    const plan = await hook.plan({ input, context: {} });
    const execution = {
      input,
      state: plan.state,
      proposal: { id: "proposal-crash-after-commit" },
      lease: {
        owner: "worker-crash",
        fence: 11,
        expiresAt: Date.now() + 10_000,
        renew: async () => ({ owner: "worker-crash", fence: 11, expiresAt: Date.now() + 10_000 }),
      },
      context: {},
    };

    await expect(hook.apply(execution as never)).rejects.toThrow("worker crashed after commit");
    await expect(hook.reconcile(execution as never)).resolves.toMatchObject({
      status: "completed",
      value: {
        kind: "media-render-result",
        sourceId: pkg.sourceId,
        packageHash: pkg.packageHash,
      },
    });
  });

  it("converges concurrent controlled attempts on one committed receipt", async () => {
    const pkg = samplePackage();
    let releaseExecution!: () => void;
    const executionGate = new Promise<void>((resolve) => {
      releaseExecution = resolve;
    });
    let entered = 0;
    const options = {
      ...host(pkg),
      executor: vi.fn(async () => {
        entered += 1;
        if (entered === 2) releaseExecution();
        await executionGate;
        return fakeExecutor()({} as never);
      }),
    };
    const hook = createPackageRenderControlHook(options);
    const input = request(pkg);
    const plan = await hook.plan({ input, context: {} });
    const execution = (owner: string, fence: number) => ({
      input,
      state: plan.state,
      proposal: { id: `proposal-${owner}` },
      lease: {
        owner,
        fence,
        expiresAt: Date.now() + 10_000,
        renew: async () => ({ owner, fence, expiresAt: Date.now() + 10_000 }),
      },
      context: {},
    });

    const [left, right] = await Promise.all([
      hook.apply(execution("worker-left", 20) as never),
      hook.apply(execution("worker-right", 21) as never),
    ]);

    expect(left).toEqual(right);
    expect(options.executor).toHaveBeenCalledTimes(2);
    await expect(options.resultStore.inspect(left.resultId)).resolves.toEqual({
      status: "committed",
      receipt: left,
    });
  });

  it("discards an owned stage when cancellation arrives before commit", async () => {
    const pkg = samplePackage();
    const options = host(pkg);
    const hook = createPackageRenderControlHook(options);
    const input = request(pkg);
    const plan = await hook.plan({ input, context: {} });
    const execution = {
      input,
      state: plan.state,
      proposal: { id: "proposal-cancel-after-stage" },
      lease: {
        owner: "worker-cancel-after-stage",
        fence: 30,
        expiresAt: Date.now() + 10_000,
        renew: async () => {
          throw new DOMException("cancelled after staging", "AbortError");
        },
      },
      context: {},
    };

    await expect(hook.apply(execution as never)).rejects.toMatchObject({ name: "AbortError" });
    await expect(options.resultStore.inspect(plan.state.resultId)).resolves.toEqual({
      status: "missing",
    });
    await expect(hook.reconcile(execution as never)).resolves.toEqual({
      status: "not-applied",
      reason: "no committed render result exists for the planned result id",
    });
  });
});

describe("filesystem render result store", () => {
  it("atomically commits, verifies bytes, and fences partial cleanup", async () => {
    const root = await mkdtemp(join(tmpdir(), "superimg-results-"));
    try {
      const store = new FileSystemRenderResultStore(root, RESULTS);
      const resultId = renderDigest("test-result/v1", { id: "one" });
      const body = new Uint8Array([1, 2, 3]);
      const receipt: MediaPackageRenderReceipt = {
        schemaVersion: 0,
        kind: "media-render-result",
        resultId,
        sourceId: "demo",
        packageHash: "a".repeat(64),
        profile: "node",
        mimeType: "image/png",
        byteLength: body.byteLength,
        sha256: createHash("sha256").update(body).digest("hex"),
        output: { format: "png" },
      };
      const stage = await store.stage({ receipt, body, owner: "worker", fence: 2 });
      expect((await store.inspect(resultId)).status).toBe("partial");
      await expect(store.commit(stage)).resolves.toEqual(receipt);
      expect(await store.inspect(resultId)).toEqual({ status: "committed", receipt });
      expect(
        new Uint8Array(await new Response(await store.open(resultId)).arrayBuffer()),
      ).toEqual(body);

      const hex = resultId.slice("sha256:".length);
      await writeFile(join(root, hex.slice(0, 2), hex, "result.bin"), new Uint8Array([9]));
      expect(await store.inspect(resultId)).toMatchObject({ status: "conflict" });
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});
