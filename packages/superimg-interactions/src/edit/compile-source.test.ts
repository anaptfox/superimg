import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { compileTemplate, resolveMediaIR } from "@superimg/core";
import { compileNodeEditableSource } from "./compile-source.js";
import { NodeEditEngine } from "@superimg/node/edit";
import { createNodeEditInteractionMount } from "./node-mount.js";
import { EDIT_INTERACTION_IDS } from "./contracts.js";

describe("editable native source", () => {
  it("rejects an unused literal target and accepts a resolved no-op", async () => {
    const root = await mkdtemp(join(tmpdir(), "superimg-edit-semantic-"));
    try {
      const path = join(root, "scene.media.ts");
      await writeFile(path, `import { image, Text } from '@foxworth/superimg'; const unused = () => Text({ id: 'ghost', color: '#fff' }, 'old'); export default image({ render: () => Text({ id: 'visible', color: '#fff' }, 'shown') });`);
      const engine = new NodeEditEngine({ projectRoot: root });
      const state = await engine.bindings("scene.media.ts", {});
      const b = state.manifest.bindings.find((item) => item.targetId.endsWith("::ghost") && item.propertyPath === "text")!;
      const command = { schemaVersion: 0 as const, source: "scene.media.ts", kind: "set-node-text" as const, target: { nodeId: b.targetId, textBindingId: b.bindingId }, value: { text: "new" }, expected: { intentHash: state.manifest.intentHash, sourceHashes: { ...state.sourceHashes } } };
      await expect(engine.plan(command, {})).rejects.toMatchObject({ code: "INSUFFICIENT_OBSERVATION" });
      const ghostColor = state.manifest.bindings.find((item) => item.targetId.endsWith("::ghost") && item.propertyPath === "property.color")!;
      await expect(engine.plan({ schemaVersion: 0, source: "scene.media.ts", kind: "set-node-property", target: { nodeId: ghostColor.targetId, property: "color", bindingId: ghostColor.bindingId }, value: { value: "#000" }, expected: command.expected }, {})).rejects.toMatchObject({ code: "INSUFFICIENT_OBSERVATION" });
      const visible = state.manifest.bindings.find((item) => item.targetId.endsWith("::visible") && item.propertyPath === "text")!;
      await expect(engine.plan({ ...command, target: { nodeId: visible.targetId, textBindingId: visible.bindingId }, value: { text: "shown" } }, {})).resolves.toBeDefined();
    } finally { await rm(root, { recursive: true, force: true }); }
  });
  it("edits supported properties and inline audio placement through compiled source", async () => {
    const root = await mkdtemp(join(tmpdir(), "superimg-edit-properties-"));
    try {
      const path = join(root, "scene.media.ts");
      const original = `import { video, Frame, Text, Image, Video } from '@foxworth/superimg';
export default video({ duration: '3s', fps: 30, audio: { clips: [{ id: 'voice', src: 'voice.mp3', at: '0.2s', duration: '1s' }] }, render: () => Frame({ id: 'card', fill: '#111', width: 100, height: 100 }, Text({ id: 'title', color: '#fff', size: 20, weight: 400 }, 'Hello'), Image({ id: 'photo', src: 'https://example.com/old.png', width: 20, height: 20 }), Video({ id: 'movie', src: 'https://example.com/old.mp4', width: 20, height: 20 })) });`;
      await writeFile(path, original);
      const engine = new NodeEditEngine({ projectRoot: root });
      const mount = createNodeEditInteractionMount({ engine });
      const cases = [
        ["title", "color", "#ff0000"], ["title", "size", 24], ["title", "weight", 600],
        ["card", "fill", "#222"], ["card", "width", 120], ["card", "height", 130],
        ["photo", "src", "https://example.com/new.png"], ["photo", "width", 25],
        ["movie", "src", "https://example.com/new.mp4"], ["movie", "height", 30],
      ] as const;
      for (const [id, property, value] of cases) {
        const state = await engine.bindings("scene.media.ts", {});
        const binding = state.manifest.bindings.find((b) => b.targetId.endsWith(`::${id}`) && b.propertyPath === `property.${property}`)!;
        expect(binding.capability).toBe("exact");
        const command = { schemaVersion: 0 as const, source: "scene.media.ts", kind: "set-node-property" as const,
          target: { nodeId: binding.targetId, property, bindingId: binding.bindingId }, value: { value },
          expected: { intentHash: state.manifest.intentHash, sourceHashes: { ...state.sourceHashes } } };
        const result = await mount.dispatch({ interactionId: EDIT_INTERACTION_IDS.setNodeProperty, input: command }, {});
        expect((await engine.bindings("scene.media.ts", {})).manifest.bindings.find((b) => b.bindingId === binding.bindingId)?.value).toBe(value);
        if (property === "color" || property === "src") {
          const revision = await compileNodeEditableSource(root, { source: "scene.media.ts", context: {} });
          const { captures } = await resolveMediaIR(compileTemplate(revision.programBundle!).media!, { captureFrames: [0] });
          expect(captures?.get(0)?.html).toContain(value);
        }
        await expect(engine.plan(command, {})).rejects.toMatchObject({ code: "SOURCE_STALE" });
        await engine.execute(result.transaction.inverse, {});
        expect((await engine.bindings("scene.media.ts", {})).manifest.bindings.find((b) => b.bindingId === binding.bindingId)?.value).toBe(binding.value);
      }
      const state = await engine.bindings("scene.media.ts", {});
      const clip = state.manifest.bindings.find((b) => b.bindingId === "audio::voice#placement.at")!;
      expect(clip).toMatchObject({ capability: "exact", value: 0.2 });
      const command = { schemaVersion: 0 as const, source: "scene.media.ts", kind: "set-audio-clip-placement" as const,
        target: { clipId: "voice", bindingId: clip.bindingId }, value: { atSeconds: 0.7 },
        expected: { intentHash: state.manifest.intentHash, sourceHashes: { ...state.sourceHashes } } };
      await expect(engine.plan({ ...command, value: { atSeconds: 4 } }, {})).rejects.toMatchObject({ code: "EFFECT_POLICY_VIOLATION" });
      const result = await mount.dispatch({ interactionId: EDIT_INTERACTION_IDS.setAudioClipPlacement, input: command }, {});
      expect(result.media.tracks.find((t) => t.id === "audio::voice")?.meta?.startSeconds).toBe(0.7);
      await expect(engine.plan(command, {})).rejects.toMatchObject({ code: "SOURCE_STALE" });
      await engine.execute(result.transaction.inverse, {});
      expect((await engine.bindings("scene.media.ts", {})).manifest.bindings.find((b) => b.bindingId === clip.bindingId)?.value).toBe(0.2);
    } finally { await rm(root, { recursive: true, force: true }); }
  }, 30_000); // The matrix recompiles every property before apply, inverse and stale checks.
  it("edits literal Text through the standard compiler and refuses stale and ambiguous sources", async () => {
    const root = await mkdtemp(join(tmpdir(), "superimg-edit-text-"));
    try {
      const path = join(root, "scene.media.ts");
      const original = `import { image, Text as Label } from '@foxworth/superimg'; // keep café\nexport default image({ render: () => Label({ id: 'title' }, 'Before') });`;
      await writeFile(path, original);
      const engine = new NodeEditEngine({ projectRoot: root });
      const bindings = await engine.bindings("scene.media.ts", {});
      const b = bindings.manifest.bindings.find((item) => item.propertyPath === "text")!;
      expect(b).toMatchObject({ capability: "exact", value: "Before" });
      const command = { schemaVersion: 0 as const, source: "scene.media.ts", kind: "set-node-text" as const,
        target: { nodeId: b.targetId, textBindingId: b.bindingId }, value: { text: 'After "✓"' },
        expected: { intentHash: bindings.manifest.intentHash, sourceHashes: { ...bindings.sourceHashes } } };
      const plan = await engine.plan(command, {});
      const output = await engine.apply(plan, {});
      expect(await readFile(path, "utf8")).toBe(original.replace("'Before'", '"After \\"✓\\""'));
      expect((await engine.bindings("scene.media.ts", {})).manifest.bindings.find((item) => item.propertyPath === "text")?.value).toBe('After "✓"');
      expect(await engine.verify(plan, output, {})).toMatchObject({ ok: true });
      await expect(engine.plan(command, {})).rejects.toMatchObject({ code: "SOURCE_STALE" });
      await engine.execute(output.transaction.inverse, {});
      expect((await engine.bindings("scene.media.ts", {})).manifest.bindings.find((item) => item.propertyPath === "text")?.value).toBe("Before");
      const mount = createNodeEditInteractionMount({ engine });
      const current = await mount.dispatch({ interactionId: EDIT_INTERACTION_IDS.bindings, input: { source: "scene.media.ts" } }, {});
      const applied = await mount.dispatch({ interactionId: EDIT_INTERACTION_IDS.setNodeText, input: {
        ...command, expected: { intentHash: current.manifest.intentHash, sourceHashes: { ...current.sourceHashes } },
      } }, {});
      expect(applied.transaction.operation.kind).toBe("set-node-text");
      expect((await engine.bindings("scene.media.ts", {})).manifest.bindings.find((item) => item.propertyPath === "text")?.value).toBe('After "✓"');
      const revision = await compileNodeEditableSource(root, { source: "scene.media.ts", context: {} });
      const media = compileTemplate(revision.programBundle!).media!;
      const { captures } = await resolveMediaIR(media, { captureFrames: [0] });
      expect(captures?.get(0)?.html).toContain("After &quot;✓&quot;");
    } finally { await rm(root, { recursive: true, force: true }); }
  });
  it("constructs an edit engine with the standard compiler", async () => {
    const root = await mkdtemp(join(tmpdir(), "superimg-edit-default-"));
    try {
      await writeFile(join(root, "scene.media.ts"), `import { image, Frame } from '@foxworth/superimg'; export default image({ render: () => Frame({ id: 'title', x: 10, y: 20, width: 10, height: 10 }) });`);
      const engine = new NodeEditEngine({ projectRoot: root });
      const result = await engine.bindings("scene.media.ts", {});
      expect(result.manifest.bindings).toEqual(expect.arrayContaining([
        expect.objectContaining({ propertyPath: "initial.transform.x", capability: "exact", value: 10 }),
        expect.objectContaining({ propertyPath: "initial.transform.y", capability: "exact", value: 20 }),
      ]));
      const x = result.manifest.bindings.find((binding) => binding.propertyPath === "initial.transform.x")!;
      const y = result.manifest.bindings.find((binding) => binding.propertyPath === "initial.transform.y")!;
      const plan = await engine.plan({
        schemaVersion: 0, source: "scene.media.ts", kind: "set-node-transform",
        target: { nodeId: x.targetId, xBindingId: x.bindingId, yBindingId: y.bindingId },
        value: { x: 30, y: 40 },
        expected: { intentHash: result.manifest.intentHash, sourceHashes: { ...result.sourceHashes } },
      }, {});
      const output = await engine.apply(plan, {});
      expect(await engine.verify(plan, output, {})).toMatchObject({ ok: true });
      expect(await engine.reconcile(plan, {})).toMatchObject({ status: "completed" });
      await engine.execute(output.transaction.inverse, {});
      expect(await readFile(join(root, "scene.media.ts"), "utf8")).toContain("x: 10, y: 20");
    } finally { await rm(root, { recursive: true, force: true }); }
  });
  it("retains the prepared native files with each executable revision", async () => {
    const root = await mkdtemp(join(tmpdir(), "superimg-edit-native-"));
    try {
      await writeFile(join(root, "world.ts"), `export default { create() { return { sample() {}, dispose() {} }; } };`);
      await writeFile(join(root, "scene.media.ts"), `import { image, NativeSurface } from '@foxworth/superimg'; import world from './world.ts?superimg-surface'; export default image({ size: { width: 64, height: 64 }, render: () => NativeSurface({ id: 'world', module: world, width: 64, height: 64, seconds: 0, data: {} }) });`);
      const revision = await compileNodeEditableSource(root, { source: "scene.media.ts", context: {} });
      expect(revision.programBundle?.nativeModuleSets).toHaveLength(1);
      expect(compileTemplate(revision.programBundle!).media?.config?.nativeModuleSets?.[0]?.outputs.length).toBeGreaterThan(0);
      expect(compileTemplate(revision.programCode!).error?.message).toMatch(/Missing prepared native surface/);
    } finally { await rm(root, { recursive: true, force: true }); }
  });
});
