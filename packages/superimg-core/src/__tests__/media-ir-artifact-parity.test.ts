import { describe, it, expect } from "vitest";
import { define, type JsonObject } from "@superimg/types";
import {
  compileMediaArtifact,
  readMediaArtifact,
  templateFromArtifact,
} from "../ir-node.js";
import { resolveMediaIR } from "../ir/index.js";
import { hashBytes } from "../ir/pure/index.js";
import { mkdtempSync, rmSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { boxedHtml, boxedSvg } from "./__test-utils__/index.js";
import { bundleMediaProgram } from "../bundler/bundler.js";
import { compileTemplate } from "../rendering/compiler.js";
import { createPreparedStdlibForTemplate } from "../shared/stdlib-capabilities.js";

const programFor = (body: string) => `
const Html = (props) => ({ $$typeof: "@foxworth/superimg/element", type: "Html", props: { width: "fill", height: "fill", ...props }, children: [] });
const __template = { default: {
  kind: "media", media: "video", fallbackFormat: "mp4", ...(${body})
} };
`;

describe("artifact parity", () => {
  it("resolves authored native module markup before considering artifact publication", async () => {
    const root = mkdtempSync(join(tmpdir(), "si-native-ir-"));
    try {
      writeFileSync(join(root, "world.ts"), `export default { create() { return { sample() {}, dispose() {} }; } };`);
      const entry = join(root, "native.media.ts");
      writeFileSync(entry, `import { image, NativeSurface } from '@foxworth/superimg'; import world from './world.ts?superimg-surface'; export default image({ size: { width: 64, height: 64 }, render: () => NativeSurface({ id: 'world', module: world, width: 64, height: 64, seconds: 0, data: {} }) });`);
      const bundle = await bundleMediaProgram(entry);
      const result = compileTemplate(bundle);
      if (!result.media) throw result.error ?? new Error("Missing media");
      const { ir } = await resolveMediaIR(result.media, { sourceId: "native" });
      expect(ir.capabilities).toBeDefined();
      expect(ir.observations.markupRuns.length).toBeGreaterThan(0);
      const mismatched = join(root, "mismatch.superimg");
      const plain = programFor('{ medium: "html", animated: false, config: { width: 64, height: 64 }, render() { return Html({ html: "plain" }); } }');
      await expect(compileMediaArtifact(result.media, { outDir: mismatched, programCode: plain, sourceId: "native", artifactSchemaVersion: 1 })).rejects.toMatchObject({ code: "artifact_integrity" });
      expect(existsSync(mismatched)).toBe(false);
      const outDir = join(root, "native.superimg");
      const artifact = await compileMediaArtifact(result.media, { outDir, programCode: bundle.code, sourceId: "native", artifactSchemaVersion: 1, verify: true });
      expect(artifact.manifest.schemaVersion).toBe(1);
      const restored = await readMediaArtifact(outDir);
      const replay = templateFromArtifact(restored);
      expect(replay.config?.nativeModuleSets).toEqual(result.media.config?.nativeModuleSets);
      expect(restored.manifest.files.some(file => file.path === "native-modules.json")).toBe(true);
      writeFileSync(join(outDir, "native-modules.json"), "{}");
      await expect(readMediaArtifact(outDir)).rejects.toThrow(/(?:Hash|Length) mismatch/);
    } finally { rmSync(root, { recursive: true, force: true }); }
  });
  it("retains legacy Three programs in schema-0 artifacts", async () => {
    const root = mkdtempSync(join(tmpdir(), "si-three-schema-"));
    const outDir = join(root, "three.superimg");
    const program = programFor(`{ medium: "html", animated: false, config: { width: 64, height: 64 },
      render(ctx) { return Html({ html: ctx.std.viz.three.scene({ width: 64, height: 64, progress: 0, setup: "", animate: "" }) }); } }`);
    const template = define<JsonObject>({ config: { width: 64, height: 64 },
      render(ctx) { return boxedHtml((ctx.std.viz as unknown as { three: typeof import("@superimg/stdlib/compat/three") }).three.scene({ width: 64, height: 64, progress: 0, setup: "", animate: "" })); } });
    try {
      const artifact = await compileMediaArtifact(template, { outDir, programCode: program, sourceId: "three", verify: true });
      const restored = await readMediaArtifact(outDir);
      expect(restored.media.hashes.programHash).toBe(artifact.media.hashes.programHash);
      const loaded = templateFromArtifact(restored);
      expect(loaded.render.toString()).toContain("three.scene");
      const prepared = await createPreparedStdlibForTemplate(loaded);
      const legacyViz = prepared.viz as unknown as { three: typeof import("@superimg/stdlib/compat/three") };
      expect(legacyViz.three.scene({ width: 64, height: 64, progress: 0, setup: "", animate: "" })).toContain("__SUPERIMG_THREE__");
    } finally { rmSync(root, { recursive: true, force: true }); }
  });
  it("refuses native surfaces before publishing a schema-0 artifact", async () => {
    const root = mkdtempSync(join(tmpdir(), "si-native-schema-"));
    const outDir = join(root, "native.superimg");
    const plain = define<JsonObject>({ config: { width: 64, height: 64 }, render: () => boxedHtml("plain") });
    const native = define<JsonObject>({ config: { width: 64, height: 64, nativeModuleSets: [{ identity: "a".repeat(64), outputs: [] }] }, render: () => boxedHtml("native") });
    const plainProgram = programFor('{ medium: "html", animated: false, config: { width: 64, height: 64 }, render() { return Html({ html: "plain" }); } }');
    const nativeProgram = programFor('{ medium: "html", animated: false, config: { width: 64, height: 64, nativeModuleSets: [{ identity: "a", outputs: [] }] }, render() { return Html({ html: "native" }); } }');
    try {
      await expect(compileMediaArtifact(native, { outDir, programCode: plainProgram, sourceId: "native" })).rejects.toMatchObject({ code: "unsupported_capability" });
      await expect(compileMediaArtifact(plain, { outDir, programCode: nativeProgram, sourceId: "native" })).rejects.toMatchObject({ code: "unsupported_capability" });
      expect(existsSync(outDir)).toBe(false);
    } finally { rmSync(root, { recursive: true, force: true }); }
  });
  it("two compilations match; source-removed still loads program; tamper rejected", async () => {
    const template = define<JsonObject>({
      sample: { msg: "ok" },
      config: { width: 96, height: 54, fps: 5, duration: "0.4s" },
      render(ctx) {
        const t = ctx.director({ enter: "40%", hold: "40%", exit: "20%" });
        const m = t.motion({ id: "card.enter", target: "card", y: 12, easing: "easeOutCubic" });
        return boxedHtml(`<div data-eq-key="card" style="${m.style}">${ctx.data.msg}</div>`);
      },
    });

    const program = programFor(`{
      medium: "html",
      animated: true,
      sample: { msg: "ok" },
      config: { width: 96, height: 54, fps: 5, duration: "0.4s" },
      render(ctx) {
        return Html({ html: '<div data-eq-key="card">' + ctx.data.msg + "</div>" });
      }
    }`);

    const root = mkdtempSync(join(tmpdir(), "si-parity-"));
    const out1 = join(root, "a.default.superimg");
    const out2 = join(root, "b.default.superimg");
    try {
      // Deterministic dual compile (without program re-resolve — program here is a stub)
      const c1 = await compileMediaArtifact(template, {
        outDir: out1,
        programCode: program,
        sourceId: "parity",
      });
      const c2 = await compileMediaArtifact(template, {
        outDir: out2,
        programCode: program,
        sourceId: "parity",
      });
      expect(c1.manifest.artifactHash).toBe(c2.manifest.artifactHash);
      expect(c1.media.hashes.intentHash).toBe(c2.media.hashes.intentHash);
      expect(c1.media.hashes.markupHash).toBe(c2.media.hashes.markupHash);

      // "source removed": only artifact remains
      const loaded = await readMediaArtifact(out1);
      const mod = templateFromArtifact(loaded);
      expect(typeof mod.render).toBe("function");
      expect(loaded.media.clock.totalFrames).toBe(c1.media.clock.totalFrames);

      // Frame hash stream covers all frames
      let covered = 0;
      for (const run of loaded.media.observations.markupRuns) {
        covered += run.range.endFrame - run.range.startFrame;
      }
      expect(covered).toBe(loaded.media.clock.totalFrames);

      writeFileSync(join(out1, "media.json"), JSON.stringify({ ...loaded.media, kind: "nope" }));
      await expect(readMediaArtifact(out1)).rejects.toThrow();
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("verify rejects program that does not reproduce IR", async () => {
    const template = define<JsonObject>({
      config: { width: 64, height: 64, fps: 5, duration: "0.2s" },
      render() {
        return boxedHtml(`<div>real</div>`);
      },
    });
    const mismatched = programFor(`{
      medium: "html", animated: true,
      config: { width: 64, height: 64, fps: 5, duration: "0.2s" },
      render() { return Html({ html: "<div>different</div>" }); }
    }`);
    const root = mkdtempSync(join(tmpdir(), "si-verify-"));
    try {
      await expect(
        compileMediaArtifact(template, {
          outDir: join(root, "x.superimg"),
          programCode: mismatched,
          sourceId: "v",
          verify: true,
        }),
      ).rejects.toMatchObject({ code: "artifact_integrity" });
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("svg static template compiles", async () => {
    const template = define<JsonObject>({
      medium: "svg",
      config: { width: 100, height: 100 },
      render() {
        return boxedSvg(`<circle r="10" cx="50" cy="50"/>`, 100, 100);
      },
    });
    const { ir } = await resolveMediaIR(template, { sourceId: "svg-still" });
    expect(ir.medium).toBe("svg");
    expect(ir.capabilities.visual).toBe("tree");
    expect(ir.clock.totalFrames).toBe(1);
  });

  it("program-only change is sourceOnly in diff", async () => {
    const { diffMediaIR } = await import("../ir/pure/diff.js");
    const template = define<JsonObject>({
      config: { width: 40, height: 40, fps: 5, duration: "0.2s" },
      render() {
        return boxedHtml(`<div>same</div>`);
      },
    });
    const { ir: a } = await resolveMediaIR(template, {
      sourceId: "src",
      programHash: hashBytes("prog-a"),
    });
    const { ir: b } = await resolveMediaIR(template, {
      sourceId: "src",
      programHash: hashBytes("prog-b"),
    });
    // Force same intent+markup hashes with different program
    const b2 = {
      ...b,
      hashes: {
        intentHash: a.hashes.intentHash,
        markupHash: a.hashes.markupHash,
        programHash: hashBytes("prog-b"),
      },
    };
    const d = diffMediaIR(a, b2);
    expect(d.sourceOnly).toBe(true);
    expect(d.result).toBe("sourceOnly");
  });
});

void existsSync;
