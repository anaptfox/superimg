import { existsSync } from "node:fs";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { compileNodeMediaArtifact } from "./artifact.js";
import { createProjectMediaTargetRegistry } from "./targets.js";

const roots: string[] = [];

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

describe("Media IR artifact interaction", () => {
  it("does not publish a schema-0 artifact for a native surface", async () => {
    const root = await project();
    await writeFile(join(root, "world.ts"), 'export default { create() { return { sample() {}, dispose() {} }; } };');
    await writeFile(join(root, "native.media.ts"), 'import { image, NativeSurface } from "@foxworth/superimg"; import world from "./world.ts?superimg-surface"; export default image({ size: { width: 64, height: 64 }, render: () => NativeSurface({ id: "world", module: world, width: 64, height: 64, seconds: 0, data: {} }) });');
    await expect(compileNodeMediaArtifact({ projectRoot: root, input: { source: "native", target: { targetId: "project-artifacts", artifactId: "native.superimg" } }, context: {}, targets: createProjectMediaTargetRegistry(root) })).rejects.toMatchObject({ code: "unsupported_capability" });
    expect(existsSync(join(root, "output/native.superimg"))).toBe(false);
  }, 20_000);
  it("publishes an explicitly requested schema-1 native artifact", async () => {
    const root = await project();
    await writeFile(join(root, "world.ts"), 'export default { create() { return { sample() {}, dispose() {} }; } };');
    await writeFile(join(root, "native.media.ts"), 'import { image, NativeSurface } from "@foxworth/superimg"; import world from "./world.ts?superimg-surface"; export default image({ size: { width: 64, height: 64 }, render: () => NativeSurface({ id: "world", module: world, width: 64, height: 64, seconds: 0, data: {} }) });');
    const receipt = await compileNodeMediaArtifact({ projectRoot: root, input: { source: "native", artifactSchemaVersion: 1, verify: true, target: { targetId: "project-artifacts", artifactId: "native.superimg" } }, context: {}, targets: createProjectMediaTargetRegistry(root) });
    expect(receipt.manifest).toMatchObject({ schemaVersion: 1 });
    expect(existsSync(join(root, "output/native.superimg/native-modules.json"))).toBe(true);
  }, 20_000);
  it("vendors shared assets, fonts and timed audio for repeated composition occurrences", async () => {
    const root = await project();
    await writeFile(join(root, "mark.png"), new Uint8Array([1, 2, 3]));
    await writeFile(join(root, "face.ttf"), new Uint8Array([0, 1, 0, 0]));
    await writeFile(join(root, "tone.wav"), new Uint8Array([82, 73, 70, 70]));
    await writeFile(join(root, "world.ts"), 'export default { create() { return { sample() {}, dispose() {} }; } };');
    await writeFile(join(root, "repeat.media.ts"), `import { video, NativeSurface, sequence, time } from '@foxworth/superimg'; import world from './world.ts?superimg-surface'; const child=video({size:{width:64,height:64},fps:2,duration:'1s',assets:{mark:{url:new URL('./mark.png',import.meta.url).href,type:'image'}},fonts:[{family:'Fixture',src:new URL('./face.ttf',import.meta.url).pathname}],audio:{id:'tone',src:new URL('./tone.wav',import.meta.url).href},render:ctx=>NativeSurface({id:'world',module:world,width:64,height:64,seconds:ctx.timeline.seconds,data:{},assets:{mark:ctx.asset('mark')}})}); export default time(sequence([{id:'a',content:child},{id:'b',content:child}]),{size:{width:64,height:64},fps:2});`);
    const receipt = await compileNodeMediaArtifact({ projectRoot: root, input: { source: "repeat", artifactSchemaVersion: 1, verify: true, target: { targetId: "project-artifacts", artifactId: "repeat.superimg" } }, context: {}, targets: createProjectMediaTargetRegistry(root) });
    const job = JSON.parse(await readFile(join(root, "output/repeat.superimg/job.json"), "utf8"));
    const imageAssets = job.resolvedAssets.filter((asset: { key: string }) => asset.key.endsWith("/mark"));
    expect(imageAssets).toHaveLength(2);
    expect(imageAssets[0].src).toBe(imageAssets[1].src);
    expect(job.assetMap["font:0"]).toMatch(/^assets\//);
    expect(job.assetMap["audio:a/tone"]).toBe(job.assetMap["audio:b/tone"]);
    const manifest = receipt.manifest as { files: Array<{ path: string }> };
    expect(manifest.files.filter(file => file.path === imageAssets[0].src)).toHaveLength(1);
  }, 20_000);
  it("vendors a project-local declared font and audio and records their replay bindings", async () => {
    const root = await project();
    await writeFile(join(root, "face.ttf"), new Uint8Array([0, 1, 0, 0]));
    await writeFile(join(root, "tone.wav"), new Uint8Array([82, 73, 70, 70]));
    await writeFile(join(root, "font.media.ts"), `import { video, Html } from '@foxworth/superimg'; export default video({ duration: '1s', fps: 2, fonts: [{ family: 'Fixture', src: new URL('./face.ttf', import.meta.url).pathname }], audio: { id: 'tone', src: new URL('./tone.wav', import.meta.url).href }, render: () => Html({ html: 'hello' }) });`);
    await compileNodeMediaArtifact({ projectRoot: root, input: { source: "font", target: { targetId: "project-artifacts", artifactId: "font.superimg" } }, context: {}, targets: createProjectMediaTargetRegistry(root) });
    const job = JSON.parse(await readFile(join(root, "output/font.superimg/job.json"), "utf8"));
    expect(job.assetMap["font:0"]).toMatch(/^assets\//);
    expect(await readFile(join(root, "output/font.superimg", job.assetMap["font:0"]))).toEqual(Buffer.from([0, 1, 0, 0]));
    expect(job.assetMap["audio:tone"]).toMatch(/^assets\//);
    expect(await readFile(join(root, "output/font.superimg", job.assetMap["audio:tone"]))).toEqual(Buffer.from([82, 73, 70, 70]));
  }, 20_000);
  it("refuses ambiguous audio bindings before publishing", async () => {
    const root = await project();
    await writeFile(join(root, "a.wav"), "a");
    await writeFile(join(root, "b.wav"), "b");
    await writeFile(join(root, "ambiguous.media.ts"), `import { video, Html } from '@foxworth/superimg'; export default video({ duration: '1s', audio: [{ id: 'same', src: new URL('./a.wav', import.meta.url).href }, { id: 'same', src: new URL('./b.wav', import.meta.url).href }], render: () => Html({ html: 'hello' }) });`);
    await expect(compileNodeMediaArtifact({ projectRoot: root, input: { source: "ambiguous", target: { targetId: "project-artifacts", artifactId: "ambiguous.superimg" } }, context: {}, targets: createProjectMediaTargetRegistry(root) })).rejects.toThrow(/Ambiguous artifact audio binding/);
    expect(existsSync(join(root, "output/ambiguous.superimg"))).toBe(false);
  }, 20_000);
  it("publishes atomically through a logical target and returns no path", async () => {
    const root = await project();
    await writeFile(
      join(root, "launch.media.ts"),
      [
        'import { image, Html } from "@foxworth/superimg";',
        "export default image({",
        '  sample: { title: "Launch" },',
        '  assets: { badge: { bytes: new Uint8Array([1, 2, 3]), mimeType: "image/png" } },',
        '  render: (ctx) => Html({ html: `<main><img src="${ctx.asset("badge")}">${ctx.data.title}</main>` }),',
        "});",
      ].join("\n"),
    );
    const receipt = await compileNodeMediaArtifact({
      projectRoot: root,
      input: {
        source: "launch",
        target: { targetId: "project-artifacts", artifactId: "launch.superimg" },
        verify: true,
      },
      context: {},
      targets: createProjectMediaTargetRegistry(root),
    });

    expect(receipt).toMatchObject({
      schemaVersion: 0,
      kind: "media-artifact",
      targetId: "project-artifacts",
      artifactId: "launch.superimg",
    });
    expect(receipt).not.toHaveProperty("path");
    expect(receipt.artifactHash).toMatch(/^[a-f0-9]{64}$/);
    expect(existsSync(join(root, "output/launch.superimg/program.mjs"))).toBe(true);
    expect(JSON.parse(await readFile(
      join(root, "output/launch.superimg/artifact.json"),
      "utf8",
    ))).toEqual(receipt.manifest);
    const job = JSON.parse(await readFile(
      join(root, "output/launch.superimg/job.json"),
      "utf8",
    ));
    expect(job.resolvedAssets).toEqual([
      { key: "badge", type: "image", src: expect.stringMatching(/^assets\//) },
    ]);
    expect(JSON.stringify(job)).not.toContain(tmpdir());
  }, 20_000);

  it("requires a snapshot without executing a provider", async () => {
    const root = await project();
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
        'import { collection, image, Html } from "@foxworth/superimg";',
        'import { entries } from "./entries.server";',
        "export default collection({",
        "  entries,",
        "  media: image({ render: (ctx) => Html({ html: `<main>${ctx.data.id}</main>` }) }),",
        "});",
      ].join("\n"),
    );

    await expect(compileNodeMediaArtifact({
      projectRoot: root,
      input: {
        source: "cards",
        target: { targetId: "project-artifacts", artifactId: "cards.superimg" },
      },
      context: {},
      targets: createProjectMediaTargetRegistry(root),
    })).rejects.toThrow("requires an exact snapshot");
    expect(await readFile(counter, "utf8").catch(() => "")).toBe("");
    expect(existsSync(join(root, "output/cards.superimg"))).toBe(false);
  }, 20_000);

  it("preserves interactive offline lowering behind the artifact interaction", async () => {
    const root = await project();
    await writeFile(
      join(root, "lesson.media.ts"),
      [
        'import { Html } from "@foxworth/superimg";',
        'import { defineInteractive } from "@foxworth/superimg/interactive/define";',
        "export default defineInteractive({",
        '  guide: { id: "lesson", steps: [{ id: "one", label: "One", duration: "1s", scene: { state: "focus" } }] },',
        '  sample: { title: "Live lesson" },',
        "  render(ctx) {",
        "    ctx.scene.states({ focus: { interactions: [] } });",
        '    return Html({ width: "fill", height: "fill", html: `<h1>${ctx.data.title}:${ctx.scene.snapshot().activeState}</h1>` });',
        "  },",
        "});",
      ].join("\n"),
    );

    const receipt = await compileNodeMediaArtifact({
      projectRoot: root,
      input: {
        source: "lesson",
        target: { targetId: "project-artifacts", artifactId: "lesson.superimg" },
      },
      context: {},
      targets: createProjectMediaTargetRegistry(root),
    });

    expect(receipt).toMatchObject({
      targetId: "project-artifacts",
      artifactId: "lesson.superimg",
    });
    expect(await readFile(join(root, "output/lesson.superimg/program.mjs"), "utf8"))
      .toContain("Live lesson");
  }, 20_000);
});

async function project(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), "superimg-artifact-interaction-"));
  roots.push(root);
  await writeFile(join(root, "package.json"), '{"type":"module"}\n');
  await mkdir(join(root, "assets"));
  return root;
}
