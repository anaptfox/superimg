import { describe, expect, it } from "vitest";
import { copyFile, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
import { image, video } from "@superimg/types";
import { createRuntime, exportMedia, render } from "@superimg/core/runtime";
import { createNodeRuntimeAdapter } from "./adapter.js";
import { prepareRuntimeResources } from "./resources.js";
import { inspectNativeMedia } from "./media.js";
import { hashTemplateOutputs, sequence, time } from "@superimg/core";
import { compileTemplate } from "@superimg/core";

const sourceModule = (path: string) => import(fileURLToPath(new URL(path, import.meta.url)));
const { bundleNativeSurfaceModule } = await sourceModule("../../../superimg-core/src/bundler/bundler.ts");
const { bundleMediaProgram } = await sourceModule("../../../superimg-core/src/bundler/bundler.ts");
const { NativeSurface } = await sourceModule("../../../superimg-stdlib/src/tree/native-surface.ts");
const { compileMediaArtifact, readMediaArtifact, templateFromArtifact } = await sourceModule("../../../superimg-core/src/ir/artifact.ts");

describe("host-prepared native module value", () => {
  it("replays an integrity-checked schema-1 native artifact after removing its source", async () => {
    const directory = await mkdtemp(join(tmpdir(), "superimg-native-artifact-"));
    const runtime = createRuntime(createNodeRuntimeAdapter({ defaultFonts: false }));
    try {
      const entry = join(directory, "scene.media.ts"), world = join(directory, "world.ts"), helper = join(directory, "color.ts");
      await writeFile(helper, `export const color = 'red';`);
      await writeFile(world, `export default { async create({canvas}) { const {color} = await import('./color'); const ctx = canvas.getContext('2d'); return { sample(){ctx.fillStyle=color;ctx.fillRect(0,0,64,64)}, dispose(){} }; } };`);
      await writeFile(entry, `import { image, NativeSurface } from '@foxworth/superimg'; import world from './world.ts?superimg-surface'; export default image({ size: { width: 64, height: 64 }, render: () => NativeSurface({ id: 'world', module: world, width: 64, height: 64, seconds: 0, data: {} }) });`);
      const bundled = await bundleMediaProgram(entry);
      const compiled = compileTemplate(bundled);
      if (!compiled.media || compiled.error) throw compiled.error ?? new Error("Missing media");
      const outDir = join(directory, "world.superimg");
      await compileMediaArtifact(compiled.media, { outDir, sourceId: "world", programCode: bundled.code, artifactSchemaVersion: 1, verify: true });
      await Promise.all([rm(entry), rm(world), rm(helper)]);
      const artifact = await readMediaArtifact(outDir);
      const replay = templateFromArtifact(artifact);
      const result = await render(runtime, replay as ReturnType<typeof image>, { as: "png" });
      const pixels = await sharp(await result.bytes()).ensureAlpha().raw().toBuffer();
      expect([...pixels.subarray(0, 4)]).toEqual([255, 0, 0, 255]);
    } finally { await runtime.dispose(); await rm(directory, { recursive: true, force: true }); }
  }, 30000);
  it("replays a native artifact with a vendored declared asset after removing the source asset", async () => {
    const directory = await mkdtemp(join(tmpdir(), "superimg-native-artifact-asset-"));
    const runtime = createRuntime(createNodeRuntimeAdapter({ defaultFonts: false }));
    try {
      const entry = join(directory, "scene.media.ts"), world = join(directory, "world.ts"), mark = join(directory, "mark.png");
      await sharp({ create: { width: 2, height: 2, channels: 4, background: "#ff0000" } }).png().toFile(mark);
      await writeFile(world, `export default { async create({canvas,assets}) { const img = new Image(); img.src = assets.mark; await img.decode(); const ctx = canvas.getContext('2d'); return { sample(){ctx.drawImage(img,0,0,64,64)}, dispose(){} }; } };`);
      await writeFile(entry, `import { image, NativeSurface } from '@foxworth/superimg'; import world from './world.ts?superimg-surface'; export default image({ size: { width: 64, height: 64 }, assets: { mark: { url: new URL('./mark.png', import.meta.url).href, type: 'image' } }, render: ctx => NativeSurface({ id: 'world', module: world, width: 64, height: 64, seconds: 0, data: {}, assets: { mark: ctx.asset('mark') } }) });`);
      const bundle = await bundleMediaProgram(entry), compiled = compileTemplate(bundle);
      if (!compiled.media || compiled.error) throw compiled.error ?? new Error("Missing media");
      const outDir = join(directory, "world.superimg");
      await compileMediaArtifact(compiled.media, { outDir, sourceId: "world", programCode: bundle.code, artifactSchemaVersion: 1, verify: true, localAssets: { "asset:mark": mark } });
      await Promise.all([rm(entry), rm(world), rm(mark)]);
      const artifact = await readMediaArtifact(outDir);
      const replay = templateFromArtifact(artifact);
      const retained = artifact.job.resolvedAssets.find((asset: { key: string }) => asset.key === "mark");
      if (!retained) throw new Error("Missing vendored asset");
      await writeFile(join(outDir, retained.src), "changed");
      const result = await render(runtime, replay as ReturnType<typeof image>, { as: "png" });
      const pixels = await sharp(await result.bytes()).ensureAlpha().raw().toBuffer();
      expect([...pixels.subarray(0, 4)]).toEqual([255, 0, 0, 255]);
      expect(() => templateFromArtifact(artifact)).toThrow(/Resolved asset changed/);
    } finally { await runtime.dispose(); await rm(directory, { recursive: true, force: true }); }
  }, 30000);
  it("replays native artwork with the exact vendored font after its source is removed", async () => {
    const directory = await mkdtemp(join(tmpdir(), "superimg-native-artifact-font-"));
    const runtime = createRuntime(createNodeRuntimeAdapter({ defaultFonts: false }));
    try {
      const entry = join(directory, "scene.media.ts"), world = join(directory, "world.ts"), font = join(directory, "font.ttf");
      await copyFile(fileURLToPath(new URL("../../../superimg-core/assets/fonts/Inter-400.ttf", import.meta.url)), font);
      await writeFile(world, `export default { create() { return { sample(){}, dispose(){} }; } };`);
      await writeFile(entry, `import { image, Frame, Fill, Text, NativeSurface } from '@foxworth/superimg'; import world from './world.ts?superimg-surface'; export default image({ size: { width: 200, height: 80 }, fonts: [{ family: 'OwnedFace', src: new URL('./font.ttf', import.meta.url).pathname }], render: () => Frame({ width: 200, height: 80 }, Fill({ color: '#ffffff' }), Text({ id: 'label', x: 5, y: 5, size: 36, fontFamily: 'OwnedFace', color: '#000000' }, 'Tea time'), NativeSurface({ id: 'world', module: world, width: 1, height: 1, seconds: 0, data: {} })) });`);
      const bundle = await bundleMediaProgram(entry), compiled = compileTemplate(bundle);
      if (!compiled.media || compiled.error) throw compiled.error ?? new Error("Missing media");
      const before = await render(runtime, compiled.media as ReturnType<typeof image>, { as: "png" });
      const beforePixels = await sharp(await before.bytes()).ensureAlpha().raw().toBuffer();
      const outDir = join(directory, "world.superimg");
      await compileMediaArtifact(compiled.media, { outDir, sourceId: "world", programCode: bundle.code, artifactSchemaVersion: 1, localAssets: { "font:0": font } });
      await Promise.all([rm(entry), rm(world), rm(font)]);
      const replay = templateFromArtifact(await readMediaArtifact(outDir));
      const after = await render(runtime, replay as ReturnType<typeof image>, { as: "png" });
      const afterPixels = await sharp(await after.bytes()).ensureAlpha().raw().toBuffer();
      expect(afterPixels).toEqual(beforePixels);
    } finally { await runtime.dispose(); await rm(directory, { recursive: true, force: true }); }
  }, 30000);
  it("exports vendored audio from a native artifact after its source is removed", async () => {
    const directory = await mkdtemp(join(tmpdir(), "superimg-native-artifact-audio-"));
    const runtime = createRuntime(createNodeRuntimeAdapter({ defaultFonts: false }));
    try {
      const entry = join(directory, "scene.media.ts"), world = join(directory, "world.ts"), tone = join(directory, "tone.wav");
      const samples = 8000, wav = Buffer.alloc(44 + samples * 2);
      wav.write("RIFF", 0); wav.writeUInt32LE(36 + samples * 2, 4); wav.write("WAVEfmt ", 8);
      wav.writeUInt32LE(16, 16); wav.writeUInt16LE(1, 20); wav.writeUInt16LE(1, 22); wav.writeUInt32LE(8000, 24); wav.writeUInt32LE(16000, 28); wav.writeUInt16LE(2, 32); wav.writeUInt16LE(16, 34); wav.write("data", 36); wav.writeUInt32LE(samples * 2, 40);
      for (let i = 0; i < samples; i++) wav.writeInt16LE(Math.round(Math.sin(i * Math.PI * 2 * 440 / 8000) * 12000), 44 + i * 2);
      await writeFile(tone, wav);
      await writeFile(world, `export default { create({canvas}) { const ctx=canvas.getContext('2d'); return { sample(){ctx.fillStyle='red';ctx.fillRect(0,0,64,64)}, dispose(){} }; } };`);
      await writeFile(entry, `import { video, NativeSurface } from '@foxworth/superimg'; import world from './world.ts?superimg-surface'; export default video({ size: { width: 64, height: 64 }, fps: 2, duration: '1s', audio: { id: 'tone', role: 'music', src: new URL('./tone.wav', import.meta.url).href }, render: ctx => NativeSurface({ id: 'world', module: world, width: 64, height: 64, seconds: ctx.timeline.seconds, data: {} }) });`);
      const bundle = await bundleMediaProgram(entry), compiled = compileTemplate(bundle);
      if (!compiled.media || compiled.error) throw compiled.error ?? new Error("Missing media");
      const outDir = join(directory, "world.superimg");
      await compileMediaArtifact(compiled.media, { outDir, sourceId: "world", programCode: bundle.code, artifactSchemaVersion: 1, localAssets: { "audio:tone": tone } });
      await Promise.all([rm(entry), rm(world), rm(tone)]);
      const replay = templateFromArtifact(await readMediaArtifact(outDir));
      const result = await exportMedia(runtime, replay as ReturnType<typeof video>, { for: [{ id: "clip", format: "mp4", width: 64, height: 64 }] });
      try {
        const bytes = await result.artifacts[0]!.bytes();
        const inspection = await inspectNativeMedia({ kind: "bytes", bytes }, fetch);
        expect(inspection.tracks.some(track => track.kind === "audio")).toBe(true);
      } finally { await result.dispose(); }
    } finally { await runtime.dispose(); await rm(directory, { recursive: true, force: true }); }
  }, 30000);
  it("replays repeated native composition occurrences with shared artwork, font and timed audio", async () => {
    const directory = await mkdtemp(join(tmpdir(), "superimg-native-artifact-repeat-"));
    const runtime = createRuntime(createNodeRuntimeAdapter({ defaultFonts: false }));
    try {
      const entry = join(directory, "scene.media.ts"), world = join(directory, "world.ts"), mark = join(directory, "mark.png"), font = join(directory, "font.ttf"), tone = join(directory, "tone.wav");
      await sharp({ create: { width: 2, height: 2, channels: 4, background: "#ff0000" } }).png().toFile(mark);
      await copyFile(fileURLToPath(new URL("../../../superimg-core/assets/fonts/Inter-400.ttf", import.meta.url)), font);
      const samples = 8000, wav = Buffer.alloc(44 + samples * 2);
      wav.write("RIFF", 0); wav.writeUInt32LE(36 + samples * 2, 4); wav.write("WAVEfmt ", 8); wav.writeUInt32LE(16, 16); wav.writeUInt16LE(1, 20); wav.writeUInt16LE(1, 22); wav.writeUInt32LE(8000, 24); wav.writeUInt32LE(16000, 28); wav.writeUInt16LE(2, 32); wav.writeUInt16LE(16, 34); wav.write("data", 36); wav.writeUInt32LE(samples * 2, 40);
      for (let i = 0; i < samples; i++) wav.writeInt16LE(Math.round(Math.sin(i * Math.PI * 2 * 440 / 8000) * 12000), 44 + i * 2);
      await writeFile(tone, wav);
      await writeFile(world, `export default { async create({canvas,assets}) { const img=new Image(); img.src=assets.mark; await img.decode(); const ctx=canvas.getContext('2d'); return { sample(){ctx.drawImage(img,0,0,64,64)}, dispose(){} }; } };`);
      await writeFile(entry, `import { video, Frame, Text, NativeSurface, sequence, time } from '@foxworth/superimg'; import world from './world.ts?superimg-surface'; const child = video({ size:{width:64,height:64}, fps:2, duration:'1s', assets:{mark:{url:new URL('./mark.png',import.meta.url).href}}, fonts:[{family:'OwnedFace',src:new URL('./font.ttf',import.meta.url).pathname}], audio:{id:'tone',role:'music',src:new URL('./tone.wav',import.meta.url).href}, render:ctx => Frame({width:64,height:64}, NativeSurface({id:'world',module:world,width:64,height:64,seconds:ctx.timeline.seconds,data:{},assets:{mark:ctx.asset('mark')}}), Text({id:'label',x:5,y:5,size:14,fontFamily:'OwnedFace',color:'#ffffff'},'Tea')) }); export default time(sequence([{id:'a',content:child},{id:'b',content:child}]),{size:{width:64,height:64},fps:2});`);
      const bundle = await bundleMediaProgram(entry), compiled = compileTemplate(bundle);
      if (!compiled.media || compiled.error) throw compiled.error ?? new Error("Missing media");
      const before = await render(runtime, compiled.media as ReturnType<typeof video>, { as: "png", at: "2f" });
      const beforePixels = await sharp(await before.bytes()).ensureAlpha().raw().toBuffer();
      const outDir = join(directory, "world.superimg");
      await compileMediaArtifact(compiled.media, { outDir, sourceId: "world", programCode: bundle.code, artifactSchemaVersion: 1, localAssets: { "asset:a/mark": mark, "asset:b/mark": mark, "font:0": font, "audio:a/tone": tone, "audio:b/tone": tone } });
      await Promise.all([rm(entry), rm(world), rm(mark), rm(font), rm(tone)]);
      const replay = templateFromArtifact(await readMediaArtifact(outDir));
      const audio = replay.config?.audio;
      if (!audio || Array.isArray(audio) || !("clips" in audio)) throw new Error("Missing composition audio");
      expect(audio.clips.map((clip: { at?: unknown }) => clip.at)).toEqual([0, 1]);
      expect(audio.clips.every((clip: { src: string }) => clip.src.startsWith("data:audio/wav;base64,"))).toBe(true);
      const result = await render(runtime, replay as ReturnType<typeof video>, { as: "png", at: "2f" });
      const pixels = await sharp(await result.bytes()).ensureAlpha().raw().toBuffer();
      expect(pixels).toEqual(beforePixels);
      const exported = await exportMedia(runtime, replay as ReturnType<typeof video>, { for: [{ id: "clip", format: "mp4", width: 64, height: 64 }] });
      try {
        const inspection = await inspectNativeMedia({ kind: "bytes", bytes: await exported.artifacts[0]!.bytes() }, fetch);
        const track = inspection.tracks.find(track => track.kind === "audio");
        expect(track?.durationSeconds).toBeGreaterThan(1.9);
      } finally { await exported.dispose(); }
    } finally { await runtime.dispose(); await rm(directory, { recursive: true, force: true }); }
  }, 30000);
  it("renders an authored static surface import without manual module preparation", async () => {
    const directory = await mkdtemp(join(tmpdir(), "superimg-native-source-"));
    const runtime = createRuntime(createNodeRuntimeAdapter({ defaultFonts: false }));
    try {
      await writeFile(join(directory, "color.ts"), 'export const color = "red";');
      await writeFile(join(directory, "world.ts"), `export default { async create({ canvas }) { const { color } = await import('./color'); const ctx = canvas.getContext('2d'); return { sample() { ctx.fillStyle = color; ctx.fillRect(0, 0, 64, 64); }, dispose() {} }; } };`);
      const entry = join(directory, "scene.media.ts");
      await writeFile(entry, `import { image, NativeSurface } from '@foxworth/superimg'; import world from './world.ts?superimg-surface'; export default image({ size: { width: 64, height: 64 }, render: () => NativeSurface({ id: 'world', module: world, width: 64, height: 64, seconds: 0, data: {} }) });`);
      const bundle = await bundleMediaProgram(entry);
      const compiled = compileTemplate(bundle);
      if (compiled.error || !compiled.media) throw compiled.error ?? new Error("Missing media");
      if (compiled.media.media !== "image") throw new Error("Expected an image");
      const result = await render(runtime, compiled.media as ReturnType<typeof image>, { as: "png" });
      const raw = await sharp(await result.bytes()).ensureAlpha().raw().toBuffer();
      expect([...raw.subarray(0, 4)]).toEqual([255, 0, 0, 255]);
    } finally { await runtime.dispose(); await rm(directory, { recursive: true, force: true }); }
  }, 30000);
  it("owns the declared bytes and reports a changed closure", async () => {
    const bytes = new Uint8Array([1, 2, 3]);
    const outputs = [{ type: "asset" as const, fileName: "data.bin", source: bytes }];
    const identity = hashTemplateOutputs(outputs);
    const media = image({ nativeModuleSets: [{ identity, outputs }], render: () => NativeSurface({ id: "world", module: { identity, moduleUrl: "https://example.invalid/world.js", bridgeUrl: "https://example.invalid/bridge.js" }, width: 1, height: 1, seconds: 0, data: {} }) });
    const prepared = await prepareRuntimeResources(media, fetch, undefined, false);
    bytes[0] = 9;
    expect(prepared.nativeModuleSets[0]!.outputs[0]).toMatchObject({ source: new Uint8Array([1, 2, 3]) });
    const changed = await prepareRuntimeResources(media, fetch, undefined, false);
    expect(changed.findings).toEqual(expect.arrayContaining([expect.objectContaining({ code: "NATIVE_MODULE_RESOLUTION_FAILED", severity: "error" })]));
    expect(changed.nativeModuleSets).toHaveLength(0);
  });
  it("passes a declared portable asset to an asynchronously created surface", async () => {
    const directory = await mkdtemp(join(tmpdir(), "superimg-native-asset-"));
    const runtime = createRuntime(createNodeRuntimeAdapter({ defaultFonts: false }));
    try {
      const surface = join(directory, "world.ts");
      await writeFile(surface, `export default { async create({canvas,assets}) {
        const img = new Image(); img.src = assets.mark; await img.decode();
        const ctx = canvas.getContext('2d');
        return { sample() { ctx.drawImage(img,0,0,64,64); }, dispose() {} };
      } };`);
      const prepared = await bundleNativeSurfaceModule(surface);
      const base = `https://superimg-native.invalid/${prepared.outputSetIdentity}/`;
      const module = { identity: prepared.outputSetIdentity, moduleUrl: base + prepared.surfaceEntry, bridgeUrl: base + prepared.bridgeEntry };
      const mark = await sharp({ create: { width: 2, height: 2, channels: 4, background: "#ff0000" } }).png().toBuffer();
      const media = image({ size: { width: 64, height: 64 }, assets: { mark: { bytes: mark, mimeType: "image/png" } },
        nativeModuleSets: [{ identity: prepared.outputSetIdentity, outputs: prepared.outputs }],
        render: ctx => NativeSurface({ id: "world", module, width: 64, height: 64, seconds: 0, data: {}, assets: { mark: ctx.asset("mark") } }) });
      const result = await render(runtime, media, { as: "png" });
      const raw = await sharp(await result.bytes()).ensureAlpha().raw().toBuffer();
      expect([...raw.subarray(0, 4)]).toEqual([255, 0, 0, 255]);
    } finally { await runtime.dispose(); await rm(directory, { recursive: true, force: true }); }
  }, 30000);
  it("renders a module and its dynamic companion through the Node runtime", async () => {
    const directory = await mkdtemp(join(tmpdir(), "superimg-native-value-"));
    const runtime = createRuntime(createNodeRuntimeAdapter({ defaultFonts: false }));
    try {
      const surface = join(directory, "world.ts");
      await writeFile(join(directory, "color.ts"), 'export const color = "red";');
      await writeFile(surface, `export default { async create({ canvas }) { const { color } = await import('./color'); const ctx = canvas.getContext('2d'); return { sample({ seconds }) { ctx.fillStyle = seconds < 0.2 ? color : 'blue'; ctx.fillRect(0, 0, 64, 64); }, dispose() {} }; } };`);
      const prepared = await bundleNativeSurfaceModule(surface);
      const base = `https://superimg-native.invalid/${prepared.outputSetIdentity}/`;
      const module = { identity: prepared.outputSetIdentity, moduleUrl: base + prepared.surfaceEntry, bridgeUrl: base + prepared.bridgeEntry };
      const media = image({ size: { width: 64, height: 64 }, nativeModuleSets: [{ identity: prepared.outputSetIdentity, outputs: prepared.outputs }], render: () => NativeSurface({ id: "world", module, width: 64, height: 64, seconds: 0, data: {} }) });
      const result = await render(runtime, media, { as: "png" });
      const raw = await sharp(await result.bytes()).ensureAlpha().raw().toBuffer();
      expect([...raw.subarray(0, 4)]).toEqual([255, 0, 0, 255]);
      const composed = time(sequence([{ id: "native", content: media, hold: "1s" }]), { size: { width: 64, height: 64 }, fps: 5 });
      const composedFrame = await render(runtime, composed, { as: "png", at: "0f" });
      const composedPixels = await sharp(await composedFrame.bytes()).ensureAlpha().raw().toBuffer();
      expect([...composedPixels.subarray(0, 4)]).toEqual([255, 0, 0, 255]);
      const animated = video({ size: { width: 64, height: 64 }, fps: 5, duration: "1s", nativeModuleSets: [{ identity: prepared.outputSetIdentity, outputs: prepared.outputs }], render: (ctx) => NativeSurface({ id: "world", module, width: 64, height: 64, seconds: ctx.timeline.seconds, data: {} }) });
      const later = await render(runtime, animated, { as: "png", at: "3f" });
      const laterPixels = await sharp(await later.bytes()).ensureAlpha().raw().toBuffer();
      expect([...laterPixels.subarray(0, 4)]).toEqual([0, 0, 255, 255]);
      const bundle = await exportMedia(runtime, animated, { for: [{ id: "native", format: "mp4", width: 64, height: 64 }] });
      try {
        const bytes = await bundle.artifacts[0]!.bytes();
        expect(Buffer.from(bytes).subarray(4, 8).toString()).toBe("ftyp");
        expect(bytes.length).toBeGreaterThan(100);
      } finally { await bundle.dispose(); }
    } finally { await runtime.dispose(); await rm(directory, { recursive: true, force: true }); }
  }, 30000);
});
