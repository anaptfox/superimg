import { describe, expect, it } from "vitest";
import { createInteractiveSceneAuthoring } from "./scene-semantic.js";

describe("semantic snapshot relationships", () => {
  it("preserves registration order when children precede their parents", () => {
    const scene = createInteractiveSceneAuthoring("forest");
    scene.node("second-child", { parent: "parent" });
    scene.node("other-root");
    scene.node("first-child", { parent: "parent" });
    scene.node("grandchild", { parent: "first-child" });
    scene.node("parent", { parent: null });
    const snapshot = scene.snapshot();
    expect(snapshot.rootIds).toEqual(["other-root", "parent"]);
    expect(snapshot.nodes.map(({ id, parentId, childIds }) => ({ id, parentId, childIds }))).toEqual([
      { id: "second-child", parentId: "parent", childIds: [] },
      { id: "other-root", parentId: null, childIds: [] },
      { id: "first-child", parentId: "parent", childIds: ["grandchild"] },
      { id: "grandchild", parentId: "first-child", childIds: [] },
      { id: "parent", parentId: null, childIds: ["second-child", "first-child"] },
    ]);
  });

  it("keeps relationships independent of visibility and snapshots", () => {
    const scene = createInteractiveSceneAuthoring("scene", {
      operations: [{ type: "hide", target: "child" }],
    });
    scene.node("parent");
    scene.node("child", { parent: "parent", initial: { transform: { x: 2 } } });
    const first = scene.snapshot();
    expect(first.nodes[0]?.childIds).toEqual(["child"]);
    expect(first.nodes[1]).toMatchObject({ visible: false, transform: { x: 2 } });
    // The current API freezes node objects, but child arrays are detached copies.
    (first.nodes[0]!.childIds as string[]).push("not-a-node");
    scene.node("later", { parent: "parent" });
    const second = scene.snapshot();
    expect(second.nodes[0]?.childIds).toEqual(["child", "later"]);
    expect(first.nodes).toHaveLength(2);
    expect(Object.isFrozen(second)).toBe(true);
    expect(second.nodes.every(Object.isFrozen)).toBe(true);
  });

  it("keeps empty, wide and deep graph ordering", () => {
    expect(createInteractiveSceneAuthoring().snapshot().nodes).toEqual([]);
    const scene = createInteractiveSceneAuthoring();
    scene.node("root");
    for (let i = 0; i < 100; i++) scene.node(`wide-${i}`, { parent: "root" });
    for (let i = 0; i < 100; i++) scene.node(`deep-${i}`, { parent: i === 0 ? "root" : `deep-${i - 1}` });
    const snapshot = scene.snapshot();
    expect(snapshot.nodes[0]?.childIds).toEqual([
      ...Array.from({ length: 100 }, (_, i) => `wide-${i}`), "deep-0",
    ]);
    for (let i = 0; i < 99; i++) expect(snapshot.nodes[101 + i]?.childIds).toEqual([`deep-${i + 1}`]);
    expect(snapshot.nodes.at(-1)?.childIds).toEqual([]);
  });

  it("preserves existing identity errors and permissive semantic cycles", () => {
    const missing = createInteractiveSceneAuthoring();
    missing.node("first", { parent: "absent-first" });
    missing.node("second", { parent: "absent-second" });
    expect(() => missing.snapshot()).toThrow('Unknown parent node "absent-first"');
    expect(() => missing.node("first")).toThrow('Duplicate scene node "first"');
    expect(() => missing.node("")).toThrow();

    // Semantic relationships currently permit cycles; spatial attachment cycles
    // have their own validation. Indexing must not change either contract.
    const cyclic = createInteractiveSceneAuthoring();
    cyclic.node("self", { parent: "self" });
    cyclic.node("a", { parent: "b" });
    cyclic.node("b", { parent: "a" });
    expect(cyclic.snapshot().nodes.map((node) => node.childIds)).toEqual([["self"], ["b"], ["a"]]);
  });
});
