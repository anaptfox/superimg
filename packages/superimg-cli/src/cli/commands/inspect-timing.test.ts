import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import sharp from "sharp";
import { inspect, render } from "@superimg/core/runtime";
import { evaluateTemplateIR } from "../utils/ir-eval.js";
import { inspectPreparedSource } from "@foxworth/superimg-node/source";
import { inspectCommand } from "./inspect.js";
import { createCliValueRuntime } from "../utils/media-interactions.js";
import { loadCliMediaValue } from "../utils/runtime-source.js";

vi.mock("@superimg/core/runtime", async (importOriginal) => ({
  ...await importOriginal<typeof import("@superimg/core/runtime")>(),
  render: vi.fn(async () => ({
    stream: () => new ReadableStream({ start(controller) { controller.enqueue(new Uint8Array([1])); controller.close(); } }),
  })),
  inspect: vi.fn((await importOriginal<typeof import("@superimg/core/runtime")>()).inspect),
}));

vi.mock("@foxworth/superimg-node/source", async (importOriginal) => {
  const original = await importOriginal<typeof import("@foxworth/superimg-node/source")>();
  return { ...original, inspectPreparedSource: vi.fn(original.inspectPreparedSource) };
});

const originalCwd = process.cwd();
const roots: string[] = [];
afterEach(async () => {
  process.chdir(originalCwd);
  process.exitCode = undefined;
  vi.restoreAllMocks();
  vi.mocked(render).mockClear();
  vi.mocked(inspect).mockClear();
  vi.mocked(inspectPreparedSource).mockClear();
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

describe("inspect frame parity", { concurrent: false }, () => {
  it("preserves scene-dependent output and distinct CLI/canonical IR identities with a prepared selection", async () => {
    const root = await mkdtemp(join(tmpdir(), "superimg-inspect-scene-identity-"));
    roots.push(root);
    process.chdir(root);
    await writeFile(join(root, "package.json"), '{"type":"module"}\n');
    const entry = join(root, "clock.media.ts");
    await writeFile(entry, [
      'import { video, Html } from "@foxworth/superimg";',
      'export default video({ duration: "2f", fps: 10, size: { width: 320, height: 180 },',
      '  resolve: () => ({ duration: "2f" }),',
      '  render: ctx => Html({ width: "fill", height: "fill", html: `<p>scene:${ctx.sceneId}</p><span>frame${ctx.timeline.frame}</span>` }),',
      '});',
    ].join("\n"));
    const original = await vi.importActual<typeof import("../utils/ir-eval.js")>("../utils/ir-eval.js");
    let commandIR: Awaited<ReturnType<typeof evaluateTemplateIR>> | undefined;
    const sourceOps = await vi.importActual<typeof import("@foxworth/superimg-node/source")>("@foxworth/superimg-node/source");
    vi.mocked(inspectPreparedSource).mockImplementationOnce(async (args) => {
      const result = await sourceOps.inspectPreparedSource(args);
      expect(result.preparedReport).toBeDefined();
      commandIR = result.evaluation;
      return result;
    });
    const output: string[] = [];
    vi.spyOn(console, "log").mockImplementation(value => output.push(String(value)));
    await inspectCommand("clock", { at: "1f" });
    const report = JSON.parse(output.at(-1)!);
    expect(report.error).toBeUndefined();

    const standaloneIR = await original.evaluateTemplateIR(entry, { captureFrames: [1] });
    expect(commandIR!.captures?.get(1)?.html).toBe(standaloneIR.captures?.get(1)?.html);
    expect(commandIR!.ir!.identity.sourceId).toBe("clock");
    expect(commandIR!.ir!.hashes).toEqual(standaloneIR.ir!.hashes);
    const loaded = await loadCliMediaValue(entry);
    const runtime = createCliValueRuntime();
    try {
      const actual = await vi.importActual<typeof import("@superimg/core/runtime")>("@superimg/core/runtime");
      const canonical = await actual.inspect(runtime, loaded.value, { at: "1f", includeIR: true, providers: "skip" });
      expect(report.runtime.metadata.samples).toEqual(canonical.metadata!.samples);
      expect(report.runtime.metadata.semanticIR).toEqual(canonical.metadata!.semanticIR);
      expect(report.sourceIdentity.mediaBundleHash).toBe(commandIR!.programHash);
      expect(report.sourceIdentity.valueDigest).toBe(canonical.programDigest);
      // Face hashes may further qualify the final report digest after semantic IR.
      expect(report.runtime.metadata.semanticIR[0].hashes.programHash).toBe(report.runtime.metadata.semanticIR[0].programDigest);
      expect(commandIR!.ir!.hashes.programHash).not.toBe(report.runtime.metadata.semanticIR[0].hashes.programHash);
    } finally { await runtime.dispose(); }
  }, 20_000);

  it("reports fallback diff endpoints with the same encoded and authored clocks as regular samples", async () => {
    const root = await mkdtemp(join(tmpdir(), "superimg-inspect-diff-clock-"));
    roots.push(root);
    process.chdir(root);
    await writeFile(join(root, "package.json"), '{"type":"module"}\n');
    await writeFile(join(root, "clock.media.ts"), [
      'import { video, Html } from "@foxworth/superimg";',
      'export default video({ duration: "1s", fps: 10, size: { width: 320, height: 180 },',
      '  render: (ctx) => Html({ width: "fill", height: "fill", html: `<p>frame${ctx.timeline.frame}</p>` }),',
      '});',
    ].join("\n"));
    const output: string[] = [];
    vi.spyOn(console, "log").mockImplementation((value) => output.push(String(value)));

    await inspectCommand("clock", { at: "0.35,0.85" });
    const regular = JSON.parse(output.at(-1)!);
    await inspectCommand("clock", { at: "0", diff: "0.35,0.85" });
    const diff = JSON.parse(output.at(-1)!);

    for (const [index, frame] of [3, 8].entries()) {
      const sample = diff.samples.find((entry: { frame: number }) => entry.frame === frame);
      expect(sample).toMatchObject({ frame, seconds: frame / 10, text: [`frame${frame}`] });
      expect(sample.timelineSeconds).toBeCloseTo(frame / 9, 12);
      expect(sample).toEqual(regular.samples[index]);
    }
    expect(diff.diff).toMatchObject({ from: 0.35, to: 0.85 });
    expect(process.exitCode).toBeUndefined();
  }, 20_000);

  it("keeps IR, runtime metadata and PNGs on one loaded revision when an imported helper changes mid-command", async () => {
    const root = await mkdtemp(join(tmpdir(), "superimg-inspect-revision-"));
    roots.push(root);
    process.chdir(root);
    await writeFile(join(root, "package.json"), '{"type":"module"}\n');
    const helper = join(root, "label.ts");
    await writeFile(helper, 'export const label = "original-helper";');
    const entry = join(root, "clock.media.ts");
    const originalEntry = [
      'import { video, Html } from "@foxworth/superimg";',
      'import { label } from "./label";',
      'export default video({ duration: "1s", fps: 10, size: { width: 320, height: 180 },',
      '  render: (ctx) => Html({ width: "fill", height: "fill", html: `<p>${label}</p><span>${ctx.globalTimeSeconds}</span>` }),',
      '});',
    ].join("\n");
    await writeFile(entry, originalEntry);
    const original = await vi.importActual<typeof import("../utils/ir-eval.js")>("../utils/ir-eval.js");
    let originalProgramHash: string | undefined;
    const sourceOps = await vi.importActual<typeof import("@foxworth/superimg-node/source")>("@foxworth/superimg-node/source");
    vi.mocked(inspectPreparedSource).mockImplementationOnce(async (args) => {
      const result = await sourceOps.inspectPreparedSource(args);
      originalProgramHash = result.evaluation.programHash;
      await writeFile(helper, 'export const label = "new-helper";');
      await writeFile(entry, originalEntry.replace('${ctx.globalTimeSeconds}', 'changed entry'));
      return result;
    });
    const output: string[] = [];
    vi.spyOn(console, "log").mockImplementation((value) => output.push(String(value)));

    await inspectCommand("clock", { at: "0.5", png: true });

    const report = JSON.parse(output.at(-1)!);
    expect(report.samples[0].text).toContain("original-helper");
    expect(report.runtime.metadata.samples[0].html).toContain("original-helper");
    expect(report.runtime.metadata.samples[0].html).not.toContain("new-helper");
    expect(report.sourceIdentity.mediaBundleHash).toBe(originalProgramHash);
    expect(report.runtime.findings.some((finding: { code: string }) => finding.code === "SCENE_LOCAL_USES_GLOBAL")).toBe(true);
    expect(vi.mocked(inspect).mock.calls[0]![1]).toBe(vi.mocked(render).mock.calls[0]![1]);
    const newer = await original.evaluateTemplateIR(join(root, "clock.media.ts"), { captureFrames: [0] });
    expect(newer.programHash).not.toBe(originalProgramHash);
    expect(newer.captures?.get(0)?.html).toContain("new-helper");
    expect(process.exitCode).toBeUndefined();
  }, 20_000);

  it("uses the final data-resolved clock for explicit seconds in IR, runtime and PNG", async () => {
    const root = await mkdtemp(join(tmpdir(), "superimg-inspect-data-clock-"));
    roots.push(root);
    process.chdir(root);
    await writeFile(join(root, "package.json"), '{"type":"module"}\n');
    await writeFile(join(root, "clock.media.ts"), [
      'import { video, Html } from "@foxworth/superimg";',
      'export default video({ duration: "1s", fps: 10, sample: { fps: 10, duration: 1 }, size: { width: 320, height: 180 },',
      '  resolve: ({ data }) => ({ fps: data.fps, duration: data.duration }),',
      '  render: (ctx) => Html({ width: "fill", height: "fill", html: `<p>frame${ctx.timeline.frame}</p>` }),',
      '});',
    ].join("\n"));
    const output: string[] = [];
    vi.spyOn(console, "log").mockImplementation((value) => output.push(String(value)));

    await inspectCommand("clock", { at: "1s", data: '{"fps":20,"duration":2}', png: true });

    const report = JSON.parse(output.at(-1)!);
    expect(report.config).toMatchObject({ fps: 20, duration: 2, totalFrames: 40 });
    expect(report.samples[0]).toMatchObject({ frame: 20, seconds: 1, text: ["frame20"] });
    expect(report.samples[0].timelineSeconds).toBeCloseTo(20 / 39 * 2);
    expect(report.runtime.metadata.samples[0].html).toContain("frame20");
    expect(vi.mocked(render).mock.calls[0]![2]).toMatchObject({ as: "png", at: "20f" });
    expect(process.exitCode).toBeUndefined();
  }, 20_000);

  it("samples resolved progress at the same exact frame in IR, runtime, and PNG", async () => {
    const root = await mkdtemp(join(tmpdir(), "superimg-inspect-time-"));
    roots.push(root);
    process.chdir(root);
    await writeFile(join(root, "package.json"), '{"type":"module"}\n');
    await writeFile(join(root, "clock.media.ts"), [
      'import { video, Html } from "@foxworth/superimg";',
      'export default video({ duration: "0.5s", fps: 10, size: { width: 320, height: 180 },',
      '  resolve: () => ({ duration: 2.1 }),',
      '  render: (ctx) => Html({ width: "fill", height: "fill", html: `<p>frame${ctx.timeline.frame}</p>` }),',
      '});',
    ].join("\n"));
    const output: string[] = [];
    vi.spyOn(console, "log").mockImplementation((value) => output.push(String(value)));

    await inspectCommand("clock", { at: "0.8", png: true });

    const report = JSON.parse(output.at(-1)!);
    expect(report.config).toMatchObject({ duration: 2.1, totalFrames: 21 });
    expect(report.samples[0]).toMatchObject({ frame: 16, text: ["frame16"] });
    expect(report.runtime.metadata.samples[0].html).toContain("frame16");
    expect(vi.mocked(render).mock.calls[0]![2]).toMatchObject({ as: "png", at: "16f" });
    expect(process.exitCode).toBeUndefined();
  }, 20_000);

  it("adds both sides of each retained-composition boundary to default inspection", async () => {
    const root = await mkdtemp(join(tmpdir(), "superimg-inspect-composition-"));
    roots.push(root);
    process.chdir(root);
    await writeFile(join(root, "package.json"), '{"type":"module"}\n');
    await writeFile(join(root, "composition.media.ts"), [
      'import { Html, sequence, time, video } from "@foxworth/superimg";',
      'const clip = (label: string, duration: `${number}f`) => video({ duration, fps: 10, size: { width: 320, height: 180 }, render: (ctx) => Html({ width: "fill", height: "fill", html: `<p>${label}:${ctx.timeline.frame}</p>` }) });',
      'export default time(sequence([{ id: "first", content: clip("first", "4f") }, { id: "second", content: clip("second", "6f") }]), { size: { width: 320, height: 180 }, fps: 10 });',
    ].join("\n"));
    const output: string[] = [];
    vi.spyOn(console, "log").mockImplementation((value) => output.push(String(value)));

    await inspectCommand("composition");

    const report = JSON.parse(output.at(-1)!);
    const frames = report.samples.map((sample: { frame: number }) => sample.frame);
    expect(frames).toContain(3);
    expect(frames).toContain(4);
    expect(new Set(frames).size).toBe(frames.length);
    expect(frames).toEqual([...frames].sort((left, right) => left - right));
    expect(report.samples.find((sample: { frame: number }) => sample.frame === 3)?.text).toContain("first:3");
    expect(report.samples.find((sample: { frame: number }) => sample.frame === 4)?.text).toContain("second:0");
    expect(report.samples.find((sample: { frame: number }) => sample.frame === 3)?.seconds).toBeCloseTo(0.3);
    expect(report.samples.find((sample: { frame: number }) => sample.frame === 4)?.seconds).toBeCloseTo(0.4);
    expect(process.exitCode).toBeUndefined();
  }, 20_000);

  it("bounds generic review evidence before PNG captures while retaining endpoints and handoff pairs", async () => {
    const root = await mkdtemp(join(tmpdir(), "superimg-inspect-bounded-review-"));
    roots.push(root);
    process.chdir(root);
    await writeFile(join(root, "package.json"), '{"type":"module"}\n');
    await writeFile(join(root, "composition.media.ts"), [
      'import { Html, sequence, time, video } from "@foxworth/superimg";',
      'const clip = (label: string) => video({ duration: "4f", fps: 10, size: { width: 320, height: 180 }, render: (ctx) => Html({ width: "fill", height: "fill", html: `<p>${label}:${ctx.timeline.frame}</p>` }) });',
      'export default time(sequence(Array.from({ length: 32 }, (_, index) => ({ id: `scene-${index}`, content: clip(`scene-${index}`) }))), { size: { width: 320, height: 180 }, fps: 10 });',
    ].join("\n"));
    const image = await sharp({ create: { width: 320, height: 180, channels: 4, background: "#00ff00" } }).png().toBuffer();
    for (let index = 0; index < 24; index++) {
      vi.mocked(render).mockImplementationOnce(async () => ({
        as: "png",
        mimeType: "image/png",
        byteLength: image.byteLength,
        sha256: "mock-png",
        coordinates: { editionId: "default", variantId: "default" },
        stream: () => new ReadableStream({ start(controller) { controller.enqueue(image); controller.close(); } }),
        bytes: async () => image,
        blob: async () => new Blob([new Uint8Array(image)], { type: "image/png" }),
        text: async () => { throw new Error("PNG is not text"); },
      }));
    }
    const output: string[] = [];
    vi.spyOn(console, "log").mockImplementation((value) => output.push(String(value)));

    await inspectCommand("composition", { review: true, diff: "0.1,0.9" });

    const packet = JSON.parse(output.at(-1)!);
    expect(packet.beats).toHaveLength(24);
    expect(packet.coverage.fullFrameCaptures).toBe(24);
    expect(vi.mocked(render)).toHaveBeenCalledTimes(24);
    const frames = packet.coverage.sampledFrames as number[];
    expect(frames[0]).toBe(0);
    expect(frames.at(-1)).toBe(127);
    expect(frames.some((frame) => frame > 0 && frame % 4 === 0 && frames.includes(frame - 1))).toBe(true);
    expect(new Set(frames).size).toBe(24);
    expect(frames).toEqual([...frames].sort((left, right) => left - right));
    expect(packet.technical.status).toBe("pass");
    expect(process.exitCode).toBeUndefined();
  }, 30_000);
});
