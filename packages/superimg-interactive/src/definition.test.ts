import { describe, expect, it } from "vitest";
import type { MediaCapabilities, RenderContext } from "@superimg/types";
import {
  attachInteractiveActions,
  defineInteractive,
  lowerInteractiveDefinition,
  resolveInteractiveClock,
} from "./definition.js";
import { createInteractiveSceneAuthoring } from "./semantic.js";
import { Frame, Html, Text, Scene, Instance, visual, h } from "@superimg/stdlib/tree";
import { lower } from "@superimg/stdlib/tree/lower";

const boxed = (html: string) => Html({ width: "fill", height: "fill", html });
const zeroContext = { sceneId: "scene", timeline: { frame: 0 }, width: 320, height: 180 } as RenderContext;

const guide = {
  id: "lesson",
  steps: [
    {
      id: "question",
      label: "Question",
      duration: "1s",
      scene: { state: "question" },
    },
    {
      id: "answer",
      label: "Answer",
      duration: "500ms",
      scene: { state: "answer" },
    },
  ],
} as const;

describe("defineInteractive", () => {
  it("uses the unsuffixed schema-0 semantic snapshot contract", () => {
    expect(createInteractiveSceneAuthoring().snapshot()).toMatchObject({
      schemaVersion: 0,
      sceneId: "default",
    });
  });

  it("creates one singular definition and derives its clock from the guide", () => {
    const lesson = defineInteractive<{ title: string }>({
      guide,
      sample: { title: "Why?" },
      render: (ctx) => boxed(`<h1>${ctx.data.title}</h1>`),
    });

    expect(lesson.kind).toBe("interactive");
    expect(lesson).not.toHaveProperty("entries");
    expect(lesson).not.toHaveProperty("size");
    expect(resolveInteractiveClock(lesson.guide)).toEqual({
      fps: 30,
      durationSeconds: 1.5,
      totalFrames: 45,
    });

    const lowered = lowerInteractiveDefinition(lesson);
    expect(lowered).toMatchObject({
      kind: "media",
      media: "video",
      fallbackFormat: "mp4",
      medium: "html",
      animated: true,
      config: {
        width: 1920,
        height: 1080,
        fps: 30,
        duration: "1.5s",
        temporal: "once",
      },
    });
  });

  it("carries authored size through the definition and offline lower", () => {
    const lesson = defineInteractive({
      guide,
      size: { width: 1200, height: 720 },
      render: () => boxed("<div />"),
    });
    expect(lesson.size).toEqual({ width: 1200, height: 720 });
    expect(lowerInteractiveDefinition(lesson).config).toMatchObject({
      width: 1200,
      height: 720,
    });
  });

  it("retains a pure typed authored tree under the scene wrapper", () => {
    const tree = Frame({ width: "fill", height: "fill" }, Text({ id: "title" }, "Typed"));
    const lesson = defineInteractive({
      size: { width: 320, height: 180 },
      guide: { id: "typed", steps: [{ id: "start", label: "Start", duration: "1s", scene: {} }] },
      render: () => tree,
    });
    const output = lowerInteractiveDefinition(lesson).render(zeroContext);
    expect(output.type).toBe("Frame");
    expect(output.children[0]).toMatchObject({ props: { "data-si-scene-id": zeroContext.sceneId }, children: [tree] });
    expect((output.children[0] as typeof tree).children[0]).toBe(tree);
    expect(lower(output)).not.toContain('data-si-primitive="Html"');
  });

  it("keeps custom HTML scene renderers and explicitly different root typography canvases on the legacy path", () => {
    const make = (width: number | "fill") => defineInteractive({
      size: { width: 320, height: 180 },
      guide: { id: "custom", steps: [{ id: "start", label: "Start", duration: "1s", scene: {} }] },
      render: () => Frame({ width, height: "fill" }, Text("Content")),
    });
    let customHtml = "";
    const custom = lowerInteractiveDefinition(make("fill"), {
      sceneRenderer: { id: "custom", render: ({ html }) => { customHtml = html; return `<section>${html}</section>`; } },
    }).render(zeroContext);
    expect(custom.type).toBe("Html");
    expect(customHtml).toContain('data-si-primitive="Text"');
    expect(lower(custom)).toContain("<section>");
    const rootCanvas = lowerInteractiveDefinition(make(160)).render(zeroContext);
    expect(rootCanvas.type).toBe("Html");
  });

  it("exposes a composition runtime while keeping the guide-derived media clock", () => {
    const lesson = defineInteractive({
      guide,
      size: { width: 320, height: 180 },
      render: () => boxed("<button>Continue</button>"),
    });
    const runtime = lesson.createCompositionRuntime();
    expect(runtime.media.config).toMatchObject({ width: 320, height: 180, fps: 30, duration: "1.5s" });
    expect(runtime.getSnapshot()).toMatchObject({ schemaVersion: 0 });
    expect(typeof runtime.setScene).toBe("function");
    expect(typeof runtime.attachActions).toBe("function");
  });

  it.each([
    ["declared packs", { version: 0, names: ["code", { name: "three", mode: "scene" }, "interactive"] }],
    ["explicit empty packs", { version: 0, names: [] }],
  ] as const)("preserves %s through lowering and a stamped clone's composition runtime", (_label, manifest) => {
    const mediaCapabilities: MediaCapabilities = manifest;
    const lesson = defineInteractive({
      guide,
      render: () => boxed("<p />"),
    });
    const stamped = { ...lesson, mediaCapabilities };

    expect(lowerInteractiveDefinition(stamped).mediaCapabilities).toBe(mediaCapabilities);
    expect(stamped.createCompositionRuntime().media.mediaCapabilities).toBe(mediaCapabilities);
    // A stamped clone cannot change the original definition's runtime metadata.
    expect(lesson.createCompositionRuntime().media).not.toHaveProperty("mediaCapabilities");
  });

  it("leaves absent capability metadata absent and supports detached runtime factories", () => {
    const lesson = defineInteractive({
      guide,
      size: { width: 320, height: 180 },
      render: () => boxed("<p />"),
    });
    const createRuntime = lesson.createCompositionRuntime;

    expect(lowerInteractiveDefinition(lesson)).not.toHaveProperty("mediaCapabilities");
    const runtime = createRuntime();
    expect(runtime.media).not.toHaveProperty("mediaCapabilities");
    expect(runtime.media.config).toMatchObject({ width: 320, height: 180, fps: 30, duration: "1.5s" });
    expect(runtime.getSnapshot()).toMatchObject({ schemaVersion: 0 });
  });

  it("matches actions against the scene ID at click time, after render", () => {
    const priorIframeClass = globalThis.HTMLIFrameElement;
    class FakeIframeElement {}
    Object.assign(globalThis, { HTMLIFrameElement: FakeIframeElement });
    let clickHandler: ((event: Event) => void) | undefined;
    const iframe = Object.assign(new FakeIframeElement(), {
      style: {},
      closest: () => null,
      contentDocument: {
        querySelectorAll: () => [],
        addEventListener: (_type: string, handler: (event: Event) => void) => { clickHandler = handler; },
        removeEventListener: () => undefined,
      },
    });
    const container = { querySelectorAll: () => [iframe] } as unknown as HTMLElement;
    let sceneId = "scene";
    const actions: unknown[] = [];
    const dispose = attachInteractiveActions(container, () => sceneId, () => 12, (event) => actions.push(event));
    // The listener is bound before the first render, but the rendered scene is
    // now identified as "lesson" when the semantic action is clicked.
    sceneId = "lesson";
    const sceneRoot = { getAttribute: () => "lesson" };
    const node = {
      getAttribute: (name: string) => name === "data-si-node" ? "accept" : name === "data-si-actions" ? "accept" : null,
      closest: () => sceneRoot,
    };
    const target = { closest: (selector: string) => selector === "[data-si-node][data-si-actions]" ? node : null };
    clickHandler?.({ target } as unknown as Event);
    expect(actions).toEqual([{ action: "accept", nodeId: "accept", frame: 12 }]);
    dispose();
    Object.assign(globalThis, { HTMLIFrameElement: priorIframeClass });
  });

  it("rejects non-positive size", () => {
    expect(() =>
      defineInteractive({
        guide,
        size: { width: 0, height: 720 },
        render: () => boxed("<div />"),
      }),
    ).toThrow(/positive integers/);
  });

  it("rejects collection semantics and malformed guides", () => {
    expect(() =>
      defineInteractive({
        guide,
        render: () => boxed("<p />"),
        entries: [],
      } as never),
    ).toThrow(/singular/);

    expect(() =>
      defineInteractive({
        guide: { id: "bad", steps: [] },
        render: () => boxed("<p />"),
      }),
    ).toThrow(/no steps/i);
  });
  it.each(["fill", 160] as const)("projects listener mutations after snapshot publication on %s canvas", (width) => {
    const lesson = defineInteractive({
      size: { width: 320, height: 180 },
      guide: { id: "mutation", steps: [{ id: "one", label: "One", duration: "1s", scene: {} }] },
      render(ctx) {
        ctx.scene.node("subject");
        return Frame({ width, height: "fill" }, h("div", { "data-si-node": "subject" }, "Subject"));
      },
    });
    const runtime = lowerInteractiveDefinition(lesson);
    runtime.subscribeInteractiveScene(snapshot => { Object.assign(snapshot.nodes[0]!.transform, { x: 37 }); });
    expect(lower(runtime.render(zeroContext))).toContain("37px");
  });

  it("retargets spatial scene ids while preserving unchanged sibling nodes and child arrays", () => {
    const stable = h("aside", {}, h("span", {}, "Unchanged"));
    const art = visual<null>({ id: "art", render: () => ({ parts: [{ id: "body", bounds: { x: 0, y: 0, width: 10, height: 10 }, content: h("rect", { width: 10, height: 10 }) }] }) });
    const runtime = lowerInteractiveDefinition(defineInteractive({
      guide: { id: "spatial", steps: [{ id: "one", label: "One", duration: "1s", scene: {} }] },
      render: () => Frame({ width: "fill", height: "fill" }, stable, Scene({ id: "world", width: 100, height: 100 }, Instance({ id: "actor", of: art, data: null }))),
    }));
    const output = runtime.render(zeroContext);
    const sceneWrapper = output.children[0] as typeof stable;
    const authoredRoot = sceneWrapper.children[0] as typeof stable;
    expect(authoredRoot.children[0]).toBe(stable);
    expect((authoredRoot.children[0] as typeof stable).children).toBe(stable.children);
    expect(lower(output)).not.toContain('data-si-scene-id="world"');
    expect(runtime.getInteractiveSnapshot().nodes.map(node => node.id)).toContain("world/actor");
  });

});
