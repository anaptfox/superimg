import { describe, expect, it } from "vitest";
import type {
  SceneAnimation,
  SceneCameraPatch,
  SceneNodeStatePatch,
  SceneOperation,
  SceneRuntimeInput,
  SceneTransform,
} from "./contracts.js";
import { InteractiveSceneController } from "./scene-controller.js";
import { createInteractiveSceneAuthoring, projectInteractiveSceneHtml } from "./semantic.js";

function fixture() {
  let input: SceneRuntimeInput = {};
  let revision = 0;
  const targets = new Set(["actor", "other", "third"]);
  const evaluate = (runtime = input) => {
    const scene = createInteractiveSceneAuthoring("scene", runtime);
    for (const id of targets) scene.node(id, { initial: {
      transform: { x: revision, y: revision + 1 },
      opacity: 0.8,
      properties: { authored: revision, nested: { untouched: true } },
    } });
    scene.state("selected", { nodes: { actor: { transform: { y: 42 }, properties: { selected: true } } } });
    scene.state("idle", { nodes: { actor: { transform: { y: 3 }, properties: { selected: false } } } });
    scene.camera.zoom(revision + 1);
    return scene.snapshot();
  };
  const controller = new InteractiveSceneController({
    getSnapshot: () => evaluate(),
    setInput: (value) => { input = value; },
    render: async () => { evaluate(); },
  });
  return { controller, evaluate, targets, input: () => input, nextFrame: () => { revision++; } };
}

describe("persistent scene commands", () => {
  it("retains only the latest touched fields while rendering every command", async () => {
    let input: SceneRuntimeInput = {};
    let renders = 0;
    const controller = new InteractiveSceneController({
      getSnapshot: () => createInteractiveSceneAuthoring("scene", input).snapshot(),
      setInput: (value) => { input = value; },
      render: async () => { renders++; },
    });
    for (let index = 0; index < 10_000; index++) {
      await controller.set("actor", { transform: { x: index } });
    }
    expect(renders).toBe(10_000);
    expect(input.operations?.length).toBe(1);
    expect(input.operations).toEqual([
      { type: "set", target: "actor", value: { transform: { x: 9_999 } } },
    ]);
    await controller.reset();
    expect(input).toEqual({});
    expect(renders).toBe(10_001);
  });

  it("captures nested command values before their asynchronous render completes", async () => {
    const { controller } = fixture();
    const transform = { x: 7 };
    const animation: SceneAnimation = { type: "custom", progress: 0.2 };
    const properties = { nested: { path: ["accepted", { value: 2 }] }, keep: false };
    const value: SceneNodeStatePatch = { transform, animation, properties };
    const operation: SceneOperation = { type: "set", target: "actor", value };
    const pending = controller.apply(operation);
    transform.x = 99;
    animation.progress = 1;
    properties.nested.path[0] = "mutated";
    const nested = properties.nested.path[1];
    if (typeof nested === "object") nested.value = 99;
    properties.keep = true;
    value.opacity = 0;
    await pending;
    await controller.use("selected");
    expect(controller.get("actor")).toMatchObject({
      transform: { x: 7, y: 42 }, opacity: 0.8,
      animation: { type: "custom", progress: 0.2 },
      properties: { nested: { path: ["accepted", { value: 2 }] }, keep: false, selected: true },
    });
    const options = { progress: 0.3, intensity: 2 };
    await controller.apply({ type: "pulse", target: "actor", options });
    options.progress = 1;
    expect(controller.get("actor")?.animation).toEqual({ type: "pulse", progress: 0.3, intensity: 2 });
    await controller.apply({ type: "fadeIn", target: "actor", options });
    options.progress = 0;
    expect(controller.get("actor")).toMatchObject({ opacity: 1, animation: { type: "fadeIn", progress: 1 } });
  });

  it("preserves own undefined transform fields, top-level no-ops, shallow properties, null and zero", async () => {
    const { controller } = fixture();
    await controller.set("actor", {
      visible: false, opacity: 0, transform: { x: 7, y: 8 },
      animation: { type: "pulse" }, properties: { nested: { a: 1, b: 2 }, keep: 9 },
    });
    const transform: SceneTransform = {};
    Object.defineProperty(transform, "x", { value: undefined, enumerable: true });
    const patch: SceneNodeStatePatch = { transform, animation: null, properties: { nested: { b: 3 } } };
    Object.defineProperty(patch, "visible", { value: undefined, enumerable: true });
    Object.defineProperty(patch, "opacity", { value: undefined, enumerable: true });
    await controller.set("actor", patch);
    expect(controller.get("actor")).toMatchObject({
      visible: false, opacity: 0, transform: { x: undefined, y: 8 },
      animation: null, properties: { nested: { b: 3 }, keep: 9 },
    });
    expect(Object.hasOwn(controller.get("actor")!.transform, "x")).toBe(true);
    await controller.show("actor");
    expect(controller.get("actor")).toMatchObject({ visible: true, opacity: 0, animation: null });
    await controller.apply({ type: "fadeIn", target: "actor", options: { progress: 0 } });
    expect(controller.get("actor")).toMatchObject({ visible: true, opacity: 0, animation: { type: "fadeIn", progress: 0 } });
    await controller.apply({ type: "fadeIn", target: "actor" });
    expect(controller.get("actor")).toMatchObject({ opacity: 1, animation: { type: "fadeIn" } });
  });

  it("keeps untouched authored fields live across states, frames and camera changes until reset", async () => {
    const f = fixture();
    await f.controller.hide("actor");
    await f.controller.set("actor", { transform: { x: 10 } });
    await f.controller.use("selected");
    const camera: SceneCameraPatch = { zoom: 2, fit: { target: "actor", padding: 3 }, follow: { target: "other" } };
    await f.controller.camera(camera);
    camera.fit!.padding = 99;
    camera.follow!.target = "mutated";
    f.nextFrame();
    expect(f.controller.get("actor")).toMatchObject({ visible: false, transform: { x: 10, y: 42 }, properties: { authored: 1 } });
    expect(f.controller.snapshot.camera).toMatchObject({ zoom: 2, fit: { target: "actor", padding: 3 }, follow: { target: "other" } });
    await f.controller.use("idle");
    expect(f.controller.get("actor")?.transform).toEqual({ x: 10, y: 3 });
    const clearCamera: SceneCameraPatch = { fit: null, follow: null };
    Object.defineProperty(clearCamera, "zoom", { value: undefined, enumerable: true });
    await f.controller.camera(clearCamera);
    f.nextFrame();
    expect(f.controller.snapshot.camera).toMatchObject({ zoom: 3, fit: null, follow: null });
    await f.controller.reset();
    expect(f.input()).toEqual({});
    expect(f.controller.get("actor")).toMatchObject({ visible: true, transform: { x: 2, y: 3 } });
    await f.controller.set("other", {});
    expect(f.input().operations?.map((op) => op.target)).toEqual(["other"]);
  });

  it("retains attempted inputs after failure and validates no-op targets in first-touch order", async () => {
    const f = fixture();
    await expect(f.controller.apply(
      { type: "set", target: "missing-first", value: {} },
      { type: "show", target: "missing-second" },
    )).rejects.toThrow('Unknown scene node "missing-first"');
    await expect(f.controller.hide("missing-first")).rejects.toThrow('Unknown scene node "missing-first"');
    expect(f.input().operations?.map((op) => op.target)).toEqual(["missing-first", "missing-second"]);
    f.targets.add("missing-first");
    await expect(f.controller.use("idle")).rejects.toThrow('Unknown scene node "missing-second"');
    f.targets.add("missing-second");
    await f.controller.use("selected");
    expect(f.controller.get("missing-first")?.visible).toBe(false);
    f.targets.delete("missing-first");
    await expect(f.controller.camera({ x: 3 })).rejects.toThrow('Unknown scene node "missing-first"');
    expect(f.input().camera).toEqual({ x: 3 });
    await f.controller.reset();
  });

  it("starts every concurrent command and preserves earlier pending inputs", async () => {
    const inputs: SceneRuntimeInput[] = [];
    const completions: (() => void)[] = [];
    const controller = new InteractiveSceneController({
      getSnapshot: () => createInteractiveSceneAuthoring().snapshot(),
      setInput: (value) => { inputs.push(value); },
      render: () => new Promise<void>((resolve) => { completions.push(resolve); }),
    });
    const first = controller.set("actor", { transform: { x: 1 } });
    const second = controller.set("actor", { transform: { y: 2 } });
    const third = controller.hide("actor");
    expect(completions).toHaveLength(3);
    expect(inputs.map((input) => input.operations)).toEqual([
      [{ type: "set", target: "actor", value: { transform: { x: 1 } } }],
      [{ type: "set", target: "actor", value: { transform: { x: 1, y: 2 } } }],
      [{ type: "set", target: "actor", value: { transform: { x: 1, y: 2 }, visible: false } }],
    ]);
    let firstDone = false;
    void first.then(() => { firstDone = true; });
    completions[1]!();
    await second;
    expect(firstDone).toBe(false);
    completions[0]!();
    completions[2]!();
    await Promise.all([first, third]);
  });

  it("matches captured uncompressed replay after every generated prefix", async () => {
    const f = fixture();
    const operations: SceneOperation[] = [];
    let state: string | undefined;
    let seed = 0x51ce;
    const random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed; };
    const html = '<div data-si-node="actor"></div><i data-si-node="other"></i><b data-si-node="third"></b>';
    for (let index = 0; index < 256; index++) {
      const target = ["actor", "other", "third"][random() % 3]!;
      const choice = random() % 8;
      const operation: SceneOperation = choice === 0 ? { type: "show", target }
        : choice === 1 ? { type: "hide", target }
        : choice === 2 ? { type: "fadeIn", target, options: { progress: (random() % 11) / 10 } }
        : choice === 3 ? { type: "pulse", target, options: { intensity: random() % 4 } }
        : { type: "set", target, value: choice === 4 ? { transform: { x: random() % 30 } }
          : choice === 5 ? { transform: { y: random() % 30 }, animation: null }
          : choice === 6 ? { properties: { nested: { prefix: index }, selected: false } }
          : {} };
      operations.push(structuredClone(operation));
      await f.controller.apply(operation);
      if (index % 13 === 0) {
        state = index % 2 ? "selected" : "idle";
        await f.controller.use(state);
      }
      f.nextFrame();
      const expected = f.evaluate({ operations, ...(state ? { state } : {}) });
      expect(f.controller.snapshot).toEqual(expected);
      expect(projectInteractiveSceneHtml(html, f.controller.snapshot)).toBe(projectInteractiveSceneHtml(html, expected));
      expect(f.input().operations!.length).toBeLessThanOrEqual(3);
    }
  });

  it("leaves low-level authored and runtime operation arrays reference-based", () => {
    const value: SceneNodeStatePatch = { opacity: 0.3 };
    const scene = createInteractiveSceneAuthoring("direct", { operations: [{ type: "set", target: "actor", value }] });
    scene.node("actor");
    value.opacity = 0.6;
    expect(scene.snapshot().nodes[0]!.opacity).toBe(0.6);
    const authored: SceneNodeStatePatch = { transform: { x: 1 } };
    scene.set("actor", authored);
    authored.transform!.x = 9;
    expect(scene.snapshot().nodes[0]!.transform.x).toBe(9);
  });
});
