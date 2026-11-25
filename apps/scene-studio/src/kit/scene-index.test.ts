import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { SceneNodeSnapshot, SceneSnapshot } from "@foxworth/superimg/interactive/define";
import { SemanticTree } from "../components/SemanticTree";
import { MeaningDrawer } from "../components/MeaningDrawer";
import { indexScene, sceneMatches, visibleSceneIds } from "./scene-index";

function node(id: string, parentId: string | null = null, childIds: string[] = [], role = "subject"): SceneNodeSnapshot {
  return { id, parentId, childIds, kind: "item", role, label: null, state: null,
    tags: [], actions: [], space: "world", visible: true, opacity: 1,
    transform: {}, animation: null, properties: {}, metadata: {} };
}

function snapshot(nodes: SceneNodeSnapshot[], rootIds = nodes.filter(n => n.parentId === null).map(n => n.id)): SceneSnapshot {
  return { schemaVersion: 0, sceneId: "index-test", activeState: null, nodes, rootIds,
    states: {}, camera: { x: 0, y: 0, zoom: 1, rotation: 0, fit: null, follow: null } };
}

describe("accepted scene inspector index", () => {
  it("keeps root and child order and derives current role membership", () => {
    const first = indexScene(snapshot([
      node("parent", null, ["second", "first"]), node("first", "parent", [], "evidence"),
      node("second", "parent", [], "evidence"), node("other"),
    ]));
    expect(first.roots.map(n => n.node.id)).toEqual(["parent", "other"]);
    expect(first.roots[0]!.children.map(n => n.node.id)).toEqual(["second", "first"]);
    expect(sceneMatches(first, "evidence").map(n => n.id)).toEqual(["first", "second"]);
    expect([...visibleSceneIds(first, sceneMatches(first, "evidence"))]).toEqual(["first", "parent", "second"]);
    const next = indexScene(snapshot([node("parent", null, ["new"]), node("new", "parent", [], "evidence")]));
    expect(sceneMatches(next, "evidence").map(n => n.id)).toEqual(["new"]);
    expect(next.byId.has("first")).toBe(false);
    expect(sceneMatches(null, "evidence")).toEqual([]);
    expect(sceneMatches(next, null)).toEqual([]);
  });

  it("renders finite cyclic paths and ignores missing children and ancestors", () => {
    const index = indexScene(snapshot([
      node("a", "b", ["b", "missing"], "evidence"), node("b", "a", ["a"]),
      node("orphan", "absent", [], "evidence"),
    ], ["a", "orphan", "missing"]));
    const visibleIds = visibleSceneIds(index, sceneMatches(index, "evidence"));
    expect([...visibleIds]).toEqual(["a", "b", "orphan"]);
    const html = renderToStaticMarkup(createElement(SemanticTree, {
      index, visibleIds, selectedId: "orphan", onSelect() {},
    }));
    expect((html.match(/data-node-id=/g) ?? []).length).toBe(3);
    expect(html).toContain('data-node-id="orphan"');
    expect(html).not.toContain('data-node-id="missing"');
  });

  it("indexes a deep hierarchy without recursive ancestry construction", () => {
    const count = 5_000;
    const nodes = Array.from({ length: count }, (_, i) => node(String(i), i ? String(i - 1) : null,
      i + 1 < count ? [String(i + 1)] : [], i === count - 1 ? "evidence" : "subject"));
    const index = indexScene(snapshot(nodes));
    expect(index.byId.size).toBe(count);
    expect(visibleSceneIds(index, sceneMatches(index, "evidence")).size).toBe(count);
    let branch = index.roots[0]!;
    for (let i = 1; i < count; i++) branch = branch.children[0]!;
    expect(branch.node.id).toBe(String(count - 1));
  });

  it("renders empty/loading states and leaves disappeared selection empty", () => {
    const index = indexScene(snapshot([]));
    const html = renderToStaticMarkup(createElement(MeaningDrawer, {
      index, selected: null, selectedId: "gone", queryRole: "evidence", queryMatches: [],
      roleFilters: [], onQuery() {}, onSelect() {},
    }));
    expect(html).toContain("→ 0");
    expect(html).toContain("Select a node");
    expect(html).not.toContain('data-node-id=');
    expect(renderToStaticMarkup(createElement(SemanticTree, {
      index: null, selectedId: null, visibleIds: null, onSelect() {},
    }))).toContain("Reading semantic scene");
  });
});
