import { describe, expect, it } from "vitest";
import { extractEditBindings as extract, type ExtractEditBindingsOptions } from "./source-bindings.js";

const IMPORTS = `import { Frame, Text, Image, Video, video, compose, time, sequence, together, choose } from '@foxworth/superimg';\n`;
function extractEditBindings(options: ExtractEditBindingsOptions) {
  return extract({ ...options, files: options.files.map((file) => ({ ...file, source: file.source.includes("import ") ? file.source : IMPORTS + file.source })) });
}

const coordinates = {
  sourceId: "reel",
  variantId: "default",
  editionId: "default",
} as const;

describe("extractEditBindings", () => {
  it("refuses overriding spreads and computed keys in legacy bindings", () => {
    const source = `import { Frame, compose, time, sequence } from '@foxworth/superimg';
      Frame({ id: 'box', x: 1, y: 2, ...later });
      compose([{ id: 'intro', template: t, duration: '3s', [key]: 4 }]);
      time(sequence([{ id: 'hold', content: t, hold: '1s', ...later }, { id: 'parent', content: sequence([{ id: 'child', content: t, hold: '1s' }]), ...later }]), opts);
      ctx.director({ enter: '20%', hold: '80%', ...later });`;
    const { manifest } = extractEditBindings({ coordinates, intentHash: "intent", files: [{ relativePath: "scene.media.ts", sceneId: "intro", source }] });
    expect(manifest.bindings.filter((b) => ["initial.transform.x", "initial.transform.y", "duration", "composition.hold"].includes(b.propertyPath)).every((b) => b.capability === "inspect-only")).toBe(true);
    expect(manifest.bindings.filter((b) => b.propertyPath.startsWith("phases.")).every((b) => b.capability === "inspect-only")).toBe(true);
    expect(manifest.bindings.find((b) => b.bindingId === "parent/child#hold")).toBeUndefined();
  });
  it("only binds verified imports, including aliases, and rejects shadowed or foreign constructors", () => {
    const source = `import { Text as Label, Frame } from '@foxworth/superimg'; import { Image } from 'foreign';
      Label({ id: 'ok' }, 'yes'); Image({ id: 'foreign', src: 'x' });
      function f(Frame) { return Frame({ id: 'shadow', x: 1, y: 2 }); }`;
    const { manifest } = extractEditBindings({ coordinates, intentHash: "intent", files: [{ relativePath: "scene.media.ts", sceneId: "intro", source }] });
    expect(manifest.bindings.find((b) => b.targetId === 'intro::ok')).toMatchObject({ capability: 'exact', value: 'yes' });
    expect(manifest.bindings.filter((b) => b.targetId === 'intro::shadow' || b.targetId === 'intro::foreign').every((b) => b.capability !== 'exact')).toBe(true);
  });
  it("keeps computed and spread properties and audio placements inspect-only", () => {
    const { manifest } = extractEditBindings({ coordinates, intentHash: "intent", files: [{ relativePath: "scene.media.ts", sceneId: "intro", source: `Text({ id: 'a', color: color }, 'x'); Image({ id: 'b', ...props, src: 'x.png' }); Frame({ id: 'c', ['width']: 4 }); video({ audio: { clips: [{ id: 'clip', at: '1s', ...opts }] } });` }] });
    expect(manifest.bindings.filter((b) => b.propertyPath.startsWith("property.") || b.propertyPath === "audio.placement.at").map((b) => b.reason)).toEqual(expect.arrayContaining(["expression-binding", "spread-property", "computed-property", "spread-property"]));
    expect(manifest.bindings.filter((b) => b.propertyPath.startsWith("property.") || b.propertyPath === "audio.placement.at").every((b) => b.capability === "inspect-only")).toBe(true);
  });
  it("does not offer scene-relative or expression-based audio placement", () => {
    const { manifest } = extractEditBindings({ coordinates, intentHash: "intent", files: [{ relativePath: "scene.media.ts", sceneId: "intro", source: `video({ audio: { clips: [{ id: 'a', at: '1s', atScene: 'intro' }, { id: 'b', at: start }, { id: 'c', at: '20f' }] } });` }] });
    expect(manifest.bindings.filter((b) => b.propertyPath === "audio.placement.at").map((b) => b.reason)).toEqual(["expression-binding", "expression-binding", "expression-binding"]);
  });
  it("refuses a node ID shared by different constructors", () => {
    const { manifest } = extractEditBindings({ coordinates, intentHash: "intent", files: [{ relativePath: "scene.media.ts", sceneId: "intro", source: `Frame({ id: 'same', width: 10 }); Text({ id: 'same', color: '#fff' }, 'hello');` }] });
    expect(manifest.bindings.filter((b) => b.targetId === "intro::same").every((b) => b.capability === "inspect-only" && b.reason === "duplicate-target")).toBe(true);
  });
  it("does not offer computed or spread Text bindings for editing", () => {
    const { manifest } = extractEditBindings({ coordinates, intentHash: "intent", files: [{ relativePath: "scene.media.ts", sceneId: "intro", source: `Text({ ["id"]: "a" }, "text"); Text({ id: "b", ...props }, "text"); Text({ id: "c" }, value);` }] });
    expect(manifest.bindings.map((b) => b.reason)).toEqual(["computed-property", "spread-property", "expression-binding"]);
    expect(manifest.bindings.every((b) => b.capability === "inspect-only")).toBe(true);
  });
  it("extracts exact literal box, duration, and phase bindings", () => {
    const result = extractEditBindings({
      coordinates,
      intentHash: "intent",
      files: [
        {
          relativePath: "scene.media.ts",
          sceneId: "intro",
          source: `
            Frame({ id: "title", x: 80, y: -20 });
            const d = ctx.director({ enter: "20%", hold: "80%" });
          `,
        },
        {
          relativePath: "reel.media.ts",
          source: `compose([{ template: intro, id: "intro", duration: "3s" }]);`,
        },
      ],
    });

    expect(result.manifest.summary).toEqual({
      exactBindingCount: 5,
      inspectOnlyCount: 0,
      opaqueCount: 0,
    });
    expect(result.manifest.bindings.map((binding) => binding.bindingId)).toEqual([
      "intro::title#initial.transform.x",
      "intro::title#initial.transform.y",
      "intro#duration",
      "intro#phases.enter",
      "intro#phases.hold",
    ]);
    expect(result.manifest.bindings.find((binding) =>
      binding.bindingId.endsWith("transform.y")
    )?.value).toBe(-20);
    expect(Object.keys(result.sourceHashes)).toEqual([
      "scene.media.ts",
      "reel.media.ts",
    ]);
  });

  it("keeps expressions, missing fields, and spreads inspect-only", () => {
    const result = extractEditBindings({
      coordinates,
      intentHash: "intent",
      files: [{
        relativePath: "scene.media.ts",
        sceneId: "intro",
        source: `
          Frame({ id: "title", x: position, ...layout });
          ctx.director({ enter: phase, ...rest });
          ctx.director({ exit: phase });
        `,
      }],
    });
    const reasons = result.manifest.bindings.map((binding) => binding.reason);
    expect(reasons).toContain("expression-binding");
    expect(reasons).toContain("spread-property");
    expect(result.manifest.summary.exactBindingCount).toBe(0);
  });

  it("marks duplicate stable targets as inspect-only", () => {
    const result = extractEditBindings({
      coordinates,
      intentHash: "intent",
      files: [{
        relativePath: "scene.media.ts",
        sceneId: "intro",
        source: `
          Frame({ id: "title", x: 1, y: 2 });
          Frame({ id: "title", x: 3, y: 4 });
        `,
      }],
    });
    expect(result.manifest.bindings).toHaveLength(4);
    expect(result.manifest.bindings.every((binding) =>
      binding.capability === "inspect-only" && binding.reason === "duplicate-target"
    )).toBe(true);
  });

  it("reports explicit compose scenes with derived durations", () => {
    const result = extractEditBindings({
      coordinates,
      intentHash: "intent",
      files: [{
        relativePath: "reel.media.ts",
        source: `compose([{ template: intro, id: "intro" }]);`,
      }],
    });
    expect(result.manifest.bindings[0]).toMatchObject({
      bindingId: "intro#duration",
      capability: "inspect-only",
      reason: "derived-duration",
    });
  });

  it("binds literal still holds by qualified inline time() occurrence path", () => {
    const result = extractEditBindings({
      coordinates,
      intentHash: "intent",
      files: [{
        relativePath: "reel.media.ts",
        source: `
          time(sequence([
            { id: "opening", content: card, hold: "12f" },
            { id: "chapter", content: sequence([
              { id: "answer", content: still, hold: "1.5s" },
            ]) },
          ]), options);
        `,
      }],
    });
    expect(result.manifest.bindings.filter((binding) =>
      binding.propertyPath === "composition.hold"
    )).toMatchObject([
      { bindingId: "chapter/answer#hold", targetId: "chapter/answer", capability: "exact", value: "1.5s" },
      { bindingId: "opening#hold", targetId: "opening", capability: "exact", value: "12f" },
    ]);
  });

  it("reports unstable boxes instead of inventing editable identity", () => {
    const result = extractEditBindings({
      coordinates,
      intentHash: "intent",
      files: [{
        relativePath: "scene.media.ts",
        sceneId: "intro",
        source: `Frame({ x: 1, y: 2 });`,
      }],
    });
    expect(result.manifest.bindings.every((binding) =>
      binding.capability === "inspect-only" && binding.reason === "missing-stable-id"
    )).toBe(true);
  });

  it("uses UTF-8 byte offsets and reports computed properties", () => {
    const source = `// 🎬\nFrame({ id: "title", ["x"]: 10, y: 20 });`;
    const result = extractEditBindings({
      coordinates,
      intentHash: "intent",
      files: [{ relativePath: "scene.media.ts", sceneId: "intro", source }],
    });
    const x = result.manifest.bindings.find((binding) => binding.bindingId.endsWith("transform.x"));
    const y = result.manifest.bindings.find((binding) => binding.bindingId.endsWith("transform.y"));
    expect(x).toMatchObject({ capability: "inspect-only", reason: "computed-property" });
    expect(y).toMatchObject({ capability: "inspect-only", reason: "computed-property" });
    const clean = `// 🎬\nFrame({ id: "title", x: 10, y: 20 });`;
    const cleanY = extractEditBindings({ coordinates, intentHash: "intent", files: [{ relativePath: "scene.media.ts", sceneId: "intro", source: clean }] }).manifest.bindings.find((binding) => binding.bindingId.endsWith("transform.y"))!;
    const bytes = Buffer.from(IMPORTS + clean, "utf8");
    expect(bytes.subarray(cleanY.source!.startByte, cleanY.source!.endByte).toString("utf8")).toBe("20");
  });

  it("marks stable identities duplicated across files as cross-file", () => {
    const result = extractEditBindings({
      coordinates,
      intentHash: "intent",
      files: ["a.media.ts", "b.media.ts"].map((relativePath) => ({
        relativePath,
        sceneId: "intro",
        source: `Frame({ id: "title", x: 1, y: 2 });`,
      })),
    });
    expect(result.manifest.bindings.every((binding) =>
      binding.capability === "inspect-only" && binding.reason === "cross-file-target"
    )).toBe(true);
  });
});
