import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, describe, expect, it } from "vitest";
import type { MediaIR } from "@superimg/types";
import { NodeEditEngine, type NodeEditableCompilation } from "./node-engine.js";
import { hashEditSource } from "./source-bindings.js";

const roots: string[] = [];
const IMPORTS = `import { Frame, compose, time, sequence } from '@foxworth/superimg';\n`;
afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

describe("NodeEditEngine", () => {
  it("rejects swapped axis bindings and overlapping applies on one engine", async () => {
    const fixture = await createFixture(`Frame({ id: "title", x: 10, y: 20 });`);
    let release!: () => void;
    let entered!: () => void;
    const paused = new Promise<void>((resolve) => { release = resolve; });
    const reached = new Promise<void>((resolve) => { entered = resolve; });
    let block = false;
    const engine = new NodeEditEngine<Record<string, never>>({ ...fixture.options, async compileSource(args) {
      if (block && !args.overrides) { entered(); await paused; }
      return fixture.options.compileSource(args);
    } });
    const state = await engine.bindings("scene.media.ts", {});
    const command = { schemaVersion: 0 as const, source: "scene.media.ts", kind: "set-node-transform" as const,
      target: { nodeId: "intro::title", xBindingId: "intro::title#initial.transform.x", yBindingId: "intro::title#initial.transform.y" },
      value: { x: 30, y: 40 }, expected: { intentHash: state.manifest.intentHash, sourceHashes: { ...state.sourceHashes } } };
    await expect(engine.plan({ ...command, target: { ...command.target, xBindingId: command.target.yBindingId, yBindingId: command.target.xBindingId } }, {})).rejects.toMatchObject({ code: "BINDING_UNAVAILABLE" });
    const plan = await engine.plan(command, {});
    block = true;
    const first = engine.apply(plan, {});
    await reached;
    await expect(engine.apply(plan, {})).rejects.toMatchObject({ code: "CONTROL_UNAVAILABLE" });
    release();
    await expect(first).resolves.toMatchObject({ transaction: { state: "committed" } });
  });
  it("serializes two engines and rejects the second stale plan", async () => {
    const fixture = await createFixture(`Frame({ id: "title", x: 10, y: 20 });`);
    const first = new NodeEditEngine(fixture.options), second = new NodeEditEngine(fixture.options);
    const bindings = await first.bindings("scene.media.ts", {});
    const command = { schemaVersion: 0 as const, source: "scene.media.ts", kind: "set-node-transform" as const,
      target: { nodeId: "intro::title", xBindingId: "intro::title#initial.transform.x", yBindingId: "intro::title#initial.transform.y" },
      value: { x: 30, y: 40 }, expected: { intentHash: bindings.manifest.intentHash, sourceHashes: { ...bindings.sourceHashes } } };
    const a = await first.plan(command, {}), b = await second.plan(command, {});
    const outcomes = await Promise.allSettled([first.apply(a, {}), second.apply(b, {})]);
    expect(outcomes.filter(x => x.status === "fulfilled")).toHaveLength(1);
    expect(outcomes.filter(x => x.status === "rejected")[0]).toMatchObject({ reason: { code: "SOURCE_STALE" } });
  });

  it.each(["conflict", "unknown", "throw"] as const)("preserves host writer %s outcome", async (outcome) => {
    const fixture = await createFixture(`Frame({ id: "title", x: 10, y: 20 });`);
    let calls = 0;
    const engine = new NodeEditEngine({ ...fixture.options, writer: {
      async withLock<T>(work: () => Promise<T>) { return work(); },
      async replace() { calls++; if (outcome === "throw") { await writeFile(fixture.path, "external content"); throw new Error("lost response"); } return outcome; },
    } });
    const bindings = await engine.bindings("scene.media.ts", {});
    const plan = await engine.plan({ schemaVersion: 0, source: "scene.media.ts", kind: "set-node-transform",
      target: { nodeId: "intro::title", xBindingId: "intro::title#initial.transform.x", yBindingId: "intro::title#initial.transform.y" },
      value: { x: 30, y: 40 }, expected: { intentHash: bindings.manifest.intentHash, sourceHashes: { ...bindings.sourceHashes } } }, {});
    await expect(engine.apply(plan, {})).rejects.toMatchObject(outcome === "conflict" ? { code: "SOURCE_STALE" } : { certainty: "unknown" });
    expect(calls).toBe(1);
    if (outcome === "throw") expect(await readFile(fixture.path, "utf8")).toBe("external content");
  });

  it("plans without writing, commits atomically, verifies, reconciles, and applies inverse", async () => {
    const fixture = await createFixture(`Frame({ id: "title", x: 10, y: 20 });`);
    const engine = new NodeEditEngine(fixture.options);
    const bindings = await engine.bindings("scene.media.ts", {});
    const command = {
      schemaVersion: 0 as const,
      source: "scene.media.ts",
      kind: "set-node-transform" as const,
      target: {
        nodeId: "intro::title",
        xBindingId: "intro::title#initial.transform.x",
        yBindingId: "intro::title#initial.transform.y",
      },
      value: { x: 30, y: 40 },
      expected: {
        intentHash: bindings.manifest.intentHash,
        sourceHashes: { ...bindings.sourceHashes },
      },
    };
    const plan = await engine.plan(command, {});
    expect(await readFile(fixture.path, "utf8")).toContain("x: 10");

    const output = await engine.apply(plan, {});
    expect(await readFile(fixture.path, "utf8")).toContain("x: 30, y: 40");
    expect(await engine.verify(plan, output, {})).toMatchObject({ ok: true });
    expect(await engine.reconcile(plan, {})).toMatchObject({ status: "completed" });

    await engine.execute(output.transaction.inverse, {});
    expect(await readFile(fixture.path, "utf8")).toContain("x: 10, y: 20");
  });

  it("rejects stale preconditions before mutation", async () => {
    const fixture = await createFixture(`Frame({ id: "title", x: 10, y: 20 });`);
    const engine = new NodeEditEngine(fixture.options);
    await expect(engine.plan({
      schemaVersion: 0,
      source: "scene.media.ts",
      kind: "set-node-transform",
      target: {
        nodeId: "intro::title",
        xBindingId: "intro::title#initial.transform.x",
        yBindingId: "intro::title#initial.transform.y",
      },
      value: { x: 30, y: 40 },
      expected: { intentHash: "stale", sourceHashes: { "scene.media.ts": "stale" } },
    }, {})).rejects.toMatchObject({ code: "SOURCE_STALE" });
    expect(await readFile(fixture.path, "utf8")).toContain("x: 10");
  });

  it("restores original bytes when post-write compilation fails", async () => {
    const fixture = await createFixture(`Frame({ id: "title", x: 10, y: 20 });`);
    const engine = new NodeEditEngine(fixture.options);
    const bindings = await engine.bindings("scene.media.ts", {});
    const plan = await engine.plan({
      schemaVersion: 0,
      source: "scene.media.ts",
      kind: "set-node-transform",
      target: {
        nodeId: "intro::title",
        xBindingId: "intro::title#initial.transform.x",
        yBindingId: "intro::title#initial.transform.y",
      },
      value: { x: 30, y: 40 },
      expected: {
        intentHash: bindings.manifest.intentHash,
        sourceHashes: { ...bindings.sourceHashes },
      },
    }, {});
    fixture.failActual.value = true;
    await expect(engine.apply(plan, {})).rejects.toThrow(/injected compile failure/);
    expect(await readFile(fixture.path, "utf8")).toBe(IMPORTS + `Frame({ id: "title", x: 10, y: 20 });`);
    expect(await engine.reconcile(plan, {})).toMatchObject({ status: "not-applied" });
  });

  it("does not overwrite source changed after planning and reconciles uncertain", async () => {
    const fixture = await createFixture(`Frame({ id: "title", x: 10, y: 20 });`);
    const engine = new NodeEditEngine(fixture.options);
    const bindings = await engine.bindings("scene.media.ts", {});
    const plan = await engine.plan({
      schemaVersion: 0,
      source: "scene.media.ts",
      kind: "set-node-transform",
      target: {
        nodeId: "intro::title",
        xBindingId: "intro::title#initial.transform.x",
        yBindingId: "intro::title#initial.transform.y",
      },
      value: { x: 30, y: 40 },
      expected: {
        intentHash: bindings.manifest.intentHash,
        sourceHashes: { ...bindings.sourceHashes },
      },
    }, {});
    const concurrent = `Frame({ id: "title", x: 99, y: 20 });`;
    await writeFile(fixture.path, concurrent, "utf8");
    await expect(engine.apply(plan, {})).rejects.toMatchObject({ code: "SOURCE_STALE" });
    expect(await readFile(fixture.path, "utf8")).toBe(concurrent);
    expect(await engine.reconcile(plan, {})).toMatchObject({ status: "uncertain" });
  });

  it("keeps a possibly applied write unknown when rollback cannot restore source", async () => {
    const fixture = await createFixture(`Frame({ id: "title", x: 10, y: 20 });`);
    let failAfterWrite = false;
    let actualCompiles = 0;
    const compile = fixture.options.compileSource;
    const engine = new NodeEditEngine<Record<string, never>>({ ...fixture.options, async compileSource(args) {
      if (failAfterWrite && !args.overrides && ++actualCompiles > 1) {
        await writeFile(fixture.path, `Frame({ id: "title", x: 99, y: 20 });`);
        throw new Error("lost compile after concurrent write");
      }
      return compile(args);
    }});
    const bindings = await engine.bindings("scene.media.ts", {});
    const plan = await engine.plan({ schemaVersion: 0, source: "scene.media.ts", kind: "set-node-transform",
      target: { nodeId: "intro::title", xBindingId: "intro::title#initial.transform.x", yBindingId: "intro::title#initial.transform.y" },
      value: { x: 30, y: 40 }, expected: { intentHash: bindings.manifest.intentHash, sourceHashes: { ...bindings.sourceHashes } },
    }, {});
    failAfterWrite = true;
    await expect(engine.apply(plan, {})).rejects.toMatchObject({ name: "EditInteractionUncertainError", certainty: "unknown" });
    expect(await readFile(fixture.path, "utf8")).toContain("x: 99");
    expect(await engine.reconcile(plan, {})).toMatchObject({ status: "uncertain" });
  });

  it("plans literal compose duration and adjacent same-unit phases", async () => {
    const source = `
      compose([{ template: intro, id: "intro", duration: "3f" }]);
      ctx.director({ enter: "20%", hold: "80%" });
    `;
    const fixture = await createFixture(source);
    const engine = new NodeEditEngine(fixture.options);
    const bindings = await engine.bindings("scene.media.ts", {});
    const expected = {
      intentHash: bindings.manifest.intentHash,
      sourceHashes: { ...bindings.sourceHashes },
    };
    const trim = await engine.plan({
      schemaVersion: 0,
      source: "scene.media.ts",
      kind: "trim-scene-end",
      target: { sceneId: "intro", durationBindingId: "intro#duration" },
      mode: "ripple",
      end: { space: "global", frame: 6 },
      expected,
    }, {});
    expect(trim.replacements[0]?.after).toContain(`duration: "6f"`);

    const phase = await engine.plan({
      schemaVersion: 0,
      source: "scene.media.ts",
      kind: "set-phase-boundary",
      target: {
        sceneId: "intro",
        leftPhaseName: "enter",
        rightPhaseName: "hold",
        leftBindingId: "intro#phases.enter",
        rightBindingId: "intro#phases.hold",
      },
      mode: "zero-sum",
      value: { left: 30, right: 70 },
      unit: "percent",
      expected,
    }, {});
    expect(phase.replacements[0]?.after).toContain(`enter: "30%", hold: "70%"`);
  });

  it("plans a literal still hold only for its exact retained occurrence path", async () => {
    const source = `time(sequence([{ id: "chapter", content: still, hold: "3f" }]), options);`;
    const fixture = await createFixture(source);
    const engine = new NodeEditEngine(fixture.options);
    const bindings = await engine.bindings("scene.media.ts", {});
    const command = {
      schemaVersion: 0 as const,
      source: "scene.media.ts",
      kind: "set-composition-hold" as const,
      target: { occurrencePath: "chapter", holdBindingId: "chapter#hold" },
      value: { hold: "6f" },
      expected: {
        intentHash: bindings.manifest.intentHash,
        sourceHashes: { ...bindings.sourceHashes },
      },
    };
    const plan = await engine.plan(command, {});
    expect(plan.replacements[0]?.after).toContain('hold: "6f"');
    expect(plan.output.transaction.inverse).toMatchObject({
      kind: "set-composition-hold",
      value: { hold: "3f" },
    });

    await expect(engine.plan({
      ...command,
      target: { occurrencePath: "missing", holdBindingId: "chapter#hold" },
    }, {})).rejects.toMatchObject({ code: "BINDING_UNAVAILABLE" });
  });
});

async function createFixture(initial: string) {
  const root = await mkdtemp(join(tmpdir(), "superimg-edit-"));
  roots.push(root);
  const path = join(root, "scene.media.ts");
  await writeFile(path, IMPORTS + initial, "utf8");
  const failActual = { value: false };
  return {
    root,
    path,
    failActual,
    options: {
      projectRoot: root,
      async compileSource({ overrides }: {
        source: string;
        context: Record<string, never>;
        overrides?: Readonly<Record<string, string>>;
      }): Promise<NodeEditableCompilation> {
        const source = overrides?.["scene.media.ts"] ?? await readFile(path, "utf8");
        if (!overrides && failActual.value && source !== IMPORTS + initial) throw new Error("injected compile failure");
        return {
          sourceId: "reel",
          coordinates: { sourceId: "reel", variantId: "default", editionId: "default" },
          media: mediaFor(source),
          files: [{ absolutePath: path, relativePath: "scene.media.ts", sceneId: "intro", source }],
        };
      },
    },
  };
}

function mediaFor(source: string): MediaIR {
  const hash = hashEditSource(source);
  const duration = Number(/duration:\s*"(\d+)f"/.exec(source)?.[1] ?? 3);
  const hold = /hold:\s*"([^"]+)"/.exec(source)?.[1];
  const occurrencePath = /id:\s*"([^"]+)"/.exec(source)?.[1];
  return {
    kind: "@foxworth/superimg/media-ir",
    schemaVersion: 0,
    identity: { sourceId: "reel", variantId: "default", editionId: "default" },
    medium: "html",
    animated: true,
    canvas: { width: 1920, height: 1080 },
    renderConfig: {
      fonts: [], inlineCss: [], stylesheets: [], tailwind: false,
      background: null, watermark: null, readiness: null, mode: "frame",
    },
    clock: { fps: 1, durationSeconds: duration, totalFrames: duration },
    capabilities: {
      temporal: "canonical", motion: "declarative", visual: "opaque-html",
      portability: "self-contained", determinism: "verified", issues: [],
    },
    provenance: { programHash: hash, sourceId: "reel", compiler: "superimg", compilerVersion: 0 },
    scenes: [{
      id: "intro", index: 0, range: { startFrame: 0, endFrame: duration },
      phases: [], markers: [], transitions: [],
    }],
    tracks: [], motions: [], assets: [],
    observations: { markupRuns: [], sceneRuns: [] },
    hashes: { intentHash: hash, markupHash: hash, programHash: hash },
    extensions: hold && occurrencePath ? {
      "superimg.composition": {
        schemaVersion: 0,
        payload: {
          schedule: {
            leaves: [{ path: occurrencePath, kind: "image" }],
          },
        },
      },
    } : {},
  };
}
