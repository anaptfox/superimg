import { describe, expect, it } from "vitest";

describe("assembled public package", () => {
  it("loads the authoring, runtime, interactions, and player exports", async () => {
    const [root, runtime, htmlRuntime, interactions, player] = await Promise.all([
      import("@foxworth/superimg"),
      import("@foxworth/superimg/runtime"),
      import("@foxworth/superimg/runtime/html"),
      import("@foxworth/superimg-interactions"),
      import("@foxworth/superimg/player"),
    ]);

    expect(root.define).toBeTypeOf("function");
    expect(root.compose).toBeTypeOf("function");
    expect(root.layoutTimeline).toBeTypeOf("function");
    expect(root.Vector).toBeTypeOf("function");
    expect(root.vector).toBeTypeOf("object");
    expect(root.Plate).toBeTypeOf("function");
    expect("Card" in root).toBe(false);
    expect("LowerThird" in root).toBe(false);
    expect("Caption" in root).toBe(false);
    expect("compileTemplate" in root).toBe(false);
    expect("Player" in root).toBe(false);
    expect(runtime.init).toBeTypeOf("function");
    expect(runtime.check).toBeTypeOf("function");
    expect(runtime.inspect).toBeTypeOf("function");
    expect(runtime.render).toBeTypeOf("function");
    expect(runtime.exportMedia).toBeTypeOf("function");
    expect(htmlRuntime.renderToHtml).toBeTypeOf("function");
    expect(interactions.createMediaInteractionMount).toBeTypeOf("function");
    expect(interactions.createNodeMediaInteractionProgressJournal).toBeTypeOf("function");
    expect(interactions.MEDIA_INTERACTION_IDS).toEqual({
      discover: "media.project.discover",
      describe: "media.source.describe",
      check: "media.source.check",
      inspect: "media.source.inspect",
      snapshot: "media.collection.snapshot",
      compile: "media.artifact.compile",
      thumbnail: "media.artifact.thumbnail",
      arrange: "media.arrange.still",
      speechVoices: "media.speech.voices",
      speechSynthesize: "media.speech.synthesize",
      narrationPrepare: "media.narration.prepare",
      narrationReview: "media.narration.review",
      export: "media.export",
    });
    expect(interactions.MEDIA_COMPILED_INTERACTIONS.program.interactions.map(({ contract }) => contract.id).sort())
      .toEqual(Object.values(interactions.MEDIA_INTERACTION_IDS).sort());
    expect(interactions.EDIT_INTERACTION_IDS.setCompositionHold).toBe("media.edit.set-composition-hold");
    expect(interactions.EDIT_COMPILED_INTERACTIONS.program.interactions.map(({ contract }) => contract.id).sort())
      .toEqual(Object.values(interactions.EDIT_INTERACTION_IDS).sort());
    expect(interactions.RENDER_COMPILED_INTERACTIONS.program.interactions).toHaveLength(1);
    expect(interactions.installMediaInteractions).toBeTypeOf("function");
    expect(interactions.installEditInteractions).toBeTypeOf("function");
    expect(interactions.installRenderInteractions).toBeTypeOf("function");
    expect(interactions.createEditInteractionMount).toBeTypeOf("function");
    expect(interactions.createRenderInteractionMount).toBeTypeOf("function");
    expect("createApp" in interactions).toBe(false);
    expect(player.Player).toBeTypeOf("function");
    expect(player.createMediaSession).toBeTypeOf("function");
    expect(player.MediaClock).toBeTypeOf("function");
  });

  it("loads curated granular exports", async () => {
    const easing = await import("@foxworth/superimg/stdlib/easing");
    expect(easing).toBeDefined();
  });

  it("does not resolve removed compatibility subpaths", async () => {
    const dynamicImport = new Function(
      "specifier",
      "return import(specifier)",
    ) as (specifier: string) => Promise<unknown>;
    for (const subpath of [
      "define",
      "node",
      "browser",
      "edge",
      "server",
      "adapters",
      "bundler",
      "compile",
    ]) {
      await expect(dynamicImport(`@foxworth/superimg/${subpath}`)).rejects.toThrow();
    }
  });
});
