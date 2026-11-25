import { expect, it } from "vitest";
import { Scene, Instance, visual, h } from "@superimg/stdlib/tree";
import { defineInteractive, lowerInteractiveDefinition } from "./definition.js";
import type { RenderContext } from "@superimg/types";
import type { SceneOperation } from "./contracts.js";
import { InteractiveSceneController } from "./scene-controller.js";
import { lower } from "@superimg/stdlib/tree/lower";
import { isMediaElement } from "@superimg/stdlib/tree";
it("applies declared guide state and host overrides to one sampled geometry packet", () => {
  let samples = 0;
  const art = visual<null>({ id: "actor", render: () => { samples++; return {parts:[{id:"body",bounds:{x:0,y:0,width:10,height:10},content:h("rect",{width:10,height:10})}]}; } });
  const media = lowerInteractiveDefinition(defineInteractive({
    guide: {id:"guide",steps:[{id:"select",label:"Select",duration:"1s",scene:{state:"selected"}}]},
    render(ctx) {
      ctx.scene.state("selected", {nodes:{"world/actor":{transform:{x:20}}}});
      return Scene({id:"world",width:100,height:100}, Instance({id:"actor",of:art,data:null,at:{x:5,y:5}}));
    },
  }));
  const context = {sceneId:"guide",timeline:{frame:0},width:100,height:100} as RenderContext;
  media.render(context);
  expect(samples).toBe(1);
  expect(media.getInteractiveSnapshot().spatial![0]!.instances[0]!.matrix.e).toBe(25);
  media.setInteractiveScene({operations:[{type:"set",target:"world/actor",value:{transform:{x:30}}}]});
  media.render(context);
  expect(media.getInteractiveSnapshot().spatial![0]!.instances[0]!.matrix.e).toBe(35);
});

it("compacted commands preserve guide-driven geometry, hit regions and HTML after every prefix", async () => {
  let base = 0;
  const art = visual<null>({
    id: "actor",
    render: () => ({
      parts: [{ id: "body", bounds: { x: 0, y: 0, width: 10, height: 10 }, content: h("rect", { width: 10, height: 10 }) }],
      anchors: { hand: { x: 10, y: 5 } },
    }),
  });
  const definition = defineInteractive({
    guide: { id: "guide", steps: [
      { id: "select", label: "Select", duration: "1s", scene: { state: "selected" } },
      { id: "idle", label: "Idle", duration: "1s", scene: { state: "idle" } },
    ] },
    render(ctx) {
      ctx.scene.states({
        selected: { nodes: { "world/actor": { transform: { y: 20 }, properties: { selected: true } } } },
        idle: { nodes: { "world/actor": { transform: { y: 0 }, properties: { selected: false } } } },
      });
      return Scene({ id: "world", width: 100, height: 100 },
        Instance({ id: "actor", of: art, data: null, at: { x: base, y: 5 },
          semantic: { actions: ["select"], hit: { kind: "rect", x: 0, y: 0, width: 10, height: 10 } } }),
        Instance({ id: "prop", of: art, data: null, attachTo: { instance: "actor", anchor: "hand" } }),
      );
    },
  });
  const compacted = lowerInteractiveDefinition(definition);
  const replay = lowerInteractiveDefinition(definition);
  const context = { sceneId: "guide", timeline: { frame: 0 }, width: 100, height: 100 } as RenderContext;
  let actualHtml = "";
  const controller = new InteractiveSceneController({
    getSnapshot: () => compacted.getInteractiveSnapshot(),
    setInput: (input) => compacted.setInteractiveScene(input),
    render: async () => {
      const tree = compacted.render(context);
      if (!isMediaElement(tree)) throw new Error("Expected a typed scene");
      actualHtml = lower(tree);
    },
  });
  const operations: SceneOperation[] = [];
  for (let index = 0; index < 60; index++) {
    base = index % 7;
    context.timeline.frame = index;
    const operation: SceneOperation = index % 5 === 0
      ? { type: "hide", target: "world/actor" }
      : index % 5 === 1 ? { type: "fadeIn", target: "world/actor", options: { progress: 0.5 } }
      : index % 5 === 2 ? { type: "set", target: "world/actor", value: { transform: { x: index }, properties: { nested: { step: index } } } }
      : index % 5 === 3 ? { type: "set", target: "world/prop", value: { transform: { rotate: index }, opacity: 0 } }
      : { type: "pulse", target: "world/prop", options: { progress: 0.2, intensity: 1 } };
    operations.push(structuredClone(operation));
    await controller.apply(operation);
    replay.setInteractiveScene({ operations });
    const expectedTree = replay.render(context);
    if (!isMediaElement(expectedTree)) throw new Error("Expected a typed scene");
    expect(controller.snapshot).toEqual(replay.getInteractiveSnapshot());
    expect(actualHtml).toBe(lower(expectedTree));
    const hit = controller.snapshot.spatial![0]!.instances[0]!.hit;
    if (index % 5 === 0) expect(hit).toBeUndefined();
    else expect(hit).toBeDefined();
  }
  expect(controller.snapshot.activeState).toBe("idle");
});
