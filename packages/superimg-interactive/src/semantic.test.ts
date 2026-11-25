import { describe, expect, it } from "vitest";
import { Frame, Html, Text, h, vector, Vector } from "@superimg/stdlib/tree";
import { lower } from "@superimg/stdlib/tree/lower";
import {
  createInteractiveSceneAuthoring,
  projectInteractiveSceneHtml,
  projectInteractiveSceneTree,
} from "./semantic.js";

describe("typed interactive projection", () => {
  it("binds typed targets and preserves unaffected authored subtrees", () => {
    const scene = createInteractiveSceneAuthoring("lesson");
    const target = scene.node("answer", { actions: ["explain", "explain"] });
    const unchanged = Text({ id: "caption" }, "Caption");
    const answer = target.element(Frame({ id: "answer-art", width: 120, height: 80 }, "Answer"));
    const tree = Frame({ width: 320, height: 180 }, unchanged, answer);
    const pristine = projectInteractiveSceneTree(tree, scene.snapshot());
    expect(pristine).toBe(tree);
    expect(answer.props).toMatchObject({ "data-si-node": "answer", "data-si-actions": "explain" });
    expect(answer.key).toBeUndefined();
    scene.hide("answer").set("answer", { opacity: 0.4, transform: { x: 12, y: 5, scale: 0.9, rotate: 4 } });
    const snapshot = scene.snapshot();
    const projected = projectInteractiveSceneTree(tree, snapshot)!;
    expect(projected.children[0]).toBe(unchanged);
    expect(projected.children[1]).not.toBe(answer);
    expect(answer.props.style).toBeUndefined();
    const legacy = projectInteractiveSceneHtml(lower(tree), snapshot);
    const current = lower(projected);
    const read = (html: string) => {
      const box = document.createElement("div");
      box.innerHTML = html;
      const element = box.querySelector<HTMLElement>("[data-si-node=answer]")!;
      return { display: element.style.display, opacity: element.style.opacity, transform: element.style.transform,
        width: element.style.width, height: element.style.height, id: element.id,
        actions: element.getAttribute("data-si-actions") };
    };
    expect(read(current)).toEqual(read(legacy));
  });

  it("projects Html islands while leaving raw SVG definitions and namespace markup intact", () => {
    const scene = createInteractiveSceneAuthoring();
    const target = scene.node('actor&"');
    const raw = target.html('<g id="actor"><use href="#body"/></g>');
    const html = `<svg xmlns="http://www.w3.org/2000/svg"><defs><path id="body" d="M0 0L10 10"/></defs>${raw}</svg>`;
    const island = Html({ id: "art", width: 320, height: 180, html });
    const text = Text("Unaffected");
    const tree = Frame({ width: 320, height: 180 }, island, text);
    scene.set('actor&"', { transform: { x: 2 } });
    const snapshot = scene.snapshot();
    const projected = projectInteractiveSceneTree(tree, snapshot)!;
    expect(projected.children[1]).toBe(text);
    const projectedIsland = projected.children[0] as typeof island;
    expect(projectedIsland.type).toBe("Html");
    expect(projectedIsland.props.html).toBe(projectInteractiveSceneHtml(html, snapshot));
    expect(projectedIsland.props.html).toContain('<defs><path id="body"');
    expect(projectedIsland.props.html).toContain('href="#body"');
    expect(island.props.html).toBe(html);
  });

  it("keeps typed vector semantic attrs and id references", () => {
    const scene = createInteractiveSceneAuthoring();
    const actor = scene.node("actor");
    const tree = Vector({ width: 320, height: 180 },
      vector.defs(vector.clip({ id: "cut" }, vector.path({ d: "M0 0L10 10" }))),
      actor.element(vector.group({ id: "actor-art", clip: "cut" }, vector.path({ d: "M0 0L10 10" }))),
    );
    scene.set("actor", { transform: { x: 8 } });
    const projected = projectInteractiveSceneTree(tree, scene.snapshot())!;
    const html = lower(projected);
    expect(html).toContain('clip-path="url(#cut)"');
    expect(html).toContain('data-si-node="actor"');
    expect(html).toContain('transform:translate(8px,0px)');
  });

  it("keeps the legacy post-motion ordering for semantic transforms and opacity", () => {
    const scene = createInteractiveSceneAuthoring();
    const target = scene.node("target");
    const tree = target.element(h("div", { motion: {
      style: "transform:scale(2);opacity:0.5", opacity: 0.5, phase: "steady", transform: "scale(2)",
    }, style: "transform:rotate(3deg);opacity:0.8" }, "Animated"));
    expect(projectInteractiveSceneTree(tree, scene.snapshot())).toBe(tree);
    scene.hide("target");
    expect(projectInteractiveSceneTree(tree, scene.snapshot())).not.toBeNull();
    scene.set("target", { opacity: 0.7, transform: { x: 4 } });
    expect(projectInteractiveSceneTree(tree, scene.snapshot())).toBeNull();
  });
});
