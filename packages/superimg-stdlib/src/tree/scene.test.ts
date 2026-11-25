import { describe, it, expect } from "vitest";
import {
  visual,
  Instance,
  Scene,
  resolveSceneTree,
  collectSceneSnapshots,
} from "./scene.js";
import { h } from "./h.js";
import { lower } from "./lower.js";
import { walkMediaTree } from "./walk.js";
import { Html } from "./primitives.js";
import { scanTreeSemanticIssues } from "../../../superimg-core/src/validation/tree.js";
const art = visual<{ pose?: number }>({
  id: "person",
  render: ({ data }) => ({
    parts: [
      {
        id: "body",
        bounds: { x: -10, y: -40, width: 20, height: 40 },
        content: h("path", { d: "M-10 0L0 -40L10 0Z", fill: "blue" }),
      },
    ],
    anchors: { hand: { x: 10, y: -20 + (data.pose ?? 0) } },
  }),
});
const cup = visual<null>({
  id: "cup",
  render: () => ({
    parts: [
      {
        id: "body",
        bounds: { x: 0, y: 0, width: 5, height: 7 },
        content: h("rect", { x: 0, y: 0, width: 5, height: 7, fill: "gold" }),
      },
    ],
  }),
});
const packet = (tree: ReturnType<typeof Scene>) =>
  collectSceneSnapshots(resolveSceneTree(tree))[0]!;
describe("shared spatial scenes", () => {
  it("treats children of a Scene foreignObject as HTML", () => {
    const subject = visual<null>({ id: "subject", render: () => ({ parts: [{
      id: "box", bounds: { x: 2, y: 3, width: 20, height: 30 },
      content: h("Frame", { width: 20, height: 30 }, h("div", {}, "hello")),
    }] }) });
    const scene = Scene({ id: "s", width: 100, height: 100 }, Instance({ id: "a", of: subject, data: null }));
    const nodes = walkMediaTree(scene);
    expect(nodes.find((node) => node.tag === "foreignObject")?.namespace).toBe("svg");
    expect(nodes.find((node) => node.tag === "Frame")?.namespace).toBe("html");
    expect(scanTreeSemanticIssues(nodes, { frame: 0, progress: 0 }))
      .not.toContainEqual(expect.objectContaining({ code: "NAMESPACE_MISMATCH" }));
    expect(lower(scene)).toMatch(/<div[^>]*xmlns="http:\/\/www\.w3\.org\/1999\/xhtml"/);
  });
  it("still rejects HTML layout directly inside SVG outside foreignObject", () => {
    const nodes = walkMediaTree(h("Vector", { width: 100, height: 100 }, h("Frame", { width: 20, height: 30 })));
    expect(nodes.find((node) => node.tag === "Frame")?.namespace).toBe("svg");
    expect(scanTreeSemanticIssues(nodes, { frame: 0, progress: 0 }))
      .toContainEqual(expect.objectContaining({ code: "NAMESPACE_MISMATCH" }));
  });
  it("places boxed Html artwork at the part's local bounds origin", () => {
    const subject = visual<null>({
      id: "subject",
      render: () => ({ parts: [{
        id: "art",
        bounds: { x: -12, y: 7, width: 20, height: 30 },
        content: Html({ width: 20, height: 30, html: '<svg viewBox="0 0 20 30"><rect width="20" height="30"/></svg>' }),
      }] }),
    });
    const output = lower(Scene({ id: "s", width: 100, height: 100 }, Instance({ id: "a", of: subject, data: null })));
    expect(output).toContain('transform="translate(-12 7)"');
  });
  it("resolves mirrored sockets and one attached prop using the same matrices as paint", () => {
    const tree = Scene(
      { id: "street", width: 200, height: 100 },
      Instance({
        id: "worker",
        of: art,
        data: {},
        at: { x: 100, y: 80 },
        transform: { scaleX: -1 },
      }),
      Instance({
        id: "cup",
        of: cup,
        data: null,
        attachTo: { instance: "worker", anchor: "hand" },
      }),
    );
    const s = packet(tree),
      hand = s.instances[0]!.anchors.hand!,
      item = s.instances[1]!;
    expect(hand).toMatchObject({ x: 90, y: 60 });
    expect(item.matrix.e).toBe(hand.x);
    expect(item.matrix.f).toBe(hand.y);
    expect(s.instances.filter((i) => i.definitionId === "cup")).toHaveLength(1);
    expect(lower(tree)).toContain("matrix(-1 0 0 1 90 60)");
    expect(walkMediaTree(tree).some((n) => n.id === "street/worker")).toBe(
      true,
    );
  });
  it("allows a worker between separately depth-sorted walls", () => {
    const wagon = visual<null>({
      id: "wagon",
      render: () => ({
        parts: [
          {
            id: "back",
            bounds: { x: 0, y: 0, width: 30, height: 30 },
            placement: { x: 0, y: 0, z: 1 },
            content: h("rect", { width: 30, height: 30 }),
          },
          {
            id: "front",
            bounds: { x: 0, y: 0, width: 30, height: 15 },
            placement: { x: 0, y: 0, z: -1 },
            content: h("rect", { width: 30, height: 15 }),
          },
        ],
      }),
    });
    const s = packet(
      Scene(
        { id: "street", width: 100, height: 100 },
        Instance({ id: "wagon", of: wagon, data: null }),
        Instance({ id: "worker", of: art, data: {} }),
      ),
    );
    expect(s.parts.map((p) => p.id)).toEqual([
      "street/wagon/parts/back",
      "street/worker/parts/body",
      "street/wagon/parts/front",
    ]);
  });
  it("fits required content including a mirrored prop and leaves screen instances alone", () => {
    const s = packet(
      Scene(
        {
          id: "s",
          width: 200,
          height: 100,
          camera: { fit: { targets: ["worker"], padding: 10 } },
        },
        Instance({ id: "worker", of: art, data: {}, at: { x: 400, y: 500 } }),
        Instance({
          id: "hud",
          of: cup,
          data: null,
          at: { x: 3, y: 4 },
          semantic: { space: "screen" },
        }),
      ),
    );
    expect(s.instances[0]!.bounds).toEqual({
      x: 80,
      y: 10,
      width: 40,
      height: 80,
    });
    expect(s.instances[1]!.matrix.e).toBe(3);
  });
  it("samples deterministically out of order and retains persistent versus visual identity", () => {
    const sample = (pose: number) =>
      packet(
        Scene(
          { id: "s", width: 100, height: 100 },
          Instance({
            id: "visit-2",
            entityId: "patron-1",
            of: art,
            data: { pose },
          }),
        ),
      );
    const a = sample(7);
    sample(2);
    expect(sample(7)).toEqual(a);
    expect(a.instances[0]).toMatchObject({
      entityId: "patron-1",
      definitionId: "person",
      id: "s/visit-2",
    });
  });
  it("rejects duplicate identity, missing socket, attachment cycles and invalid geometry", () => {
    const base = () => Instance({ id: "p", of: art, data: {} });
    expect(() =>
      packet(Scene({ id: "s", width: 100, height: 100 }, base(), base())),
    ).toThrow("Duplicate");
    expect(() =>
      packet(
        Scene(
          { id: "s", width: 100, height: 100 },
          base(),
          Instance({
            id: "c",
            of: cup,
            data: null,
            attachTo: { instance: "p", anchor: "missing" },
          }),
        ),
      ),
    ).toThrow("Missing anchor");
    expect(() =>
      packet(
        Scene(
          { id: "s", width: 100, height: 100 },
          Instance({
            id: "a",
            of: art,
            data: {},
            attachTo: { instance: "b", anchor: "hand" },
          }),
          Instance({
            id: "b",
            of: art,
            data: {},
            attachTo: { instance: "a", anchor: "hand" },
          }),
        ),
      ),
    ).toThrow("cycle");
    expect(() =>
      packet(
        Scene(
          { id: "s", width: 100, height: 100 },
          Instance({ id: "p", of: art, data: {}, at: { x: NaN, y: 0 } }),
        ),
      ),
    ).toThrow("finite");
    expect(() => resolveSceneTree(base())).toThrow("inside Scene");
  });
  it("resolves host visibility and transform overrides into paint and bounds together", () => {
    const t = Scene(
      { id: "s", width: 100, height: 100 },
      Instance({
        id: "p",
        of: art,
        data: {},
        semantic: {
          actions: ["select"],
          hit: { kind: "rect", x: -15, y: -45, width: 30, height: 45 },
        },
      }),
    );
    const r = resolveSceneTree(t, {
      runtime: {
        operations: [
          { type: "set", target: "s/p", value: { transform: { x: 20 } } },
        ],
      },
    });
    expect(r.sceneSnapshot!.instances[0]!.matrix.e).toBe(20);
    expect(lower(r)).toContain('data-si-hit="1"');
    const hidden = resolveSceneTree(t, {
      runtime: { operations: [{ type: "hide", target: "s/p" }] },
    });
    expect(lower(hidden)).not.toContain('data-si-hit="1"');
    expect(
      hidden.sceneSnapshot!.nodes.find((n) => n.id === "s/p")!.visible,
    ).toBe(false);
  });
  it("namespaces repeated SVG resources without changing logical identities", () => {
    const v = visual<null>({
      id: "logo",
      render: () => ({
        parts: [
          {
            id: "body",
            bounds: { x: 0, y: 0, width: 20, height: 20 },
            content: h(
              "Vector",
              { width: 20, height: 20 },
              h("VectorDefs", {}, h("linearGradient", { id: "paint" })),
              h("path", { d: "M0 0L20 20", fill: "url(#paint)" }),
            ),
          },
        ],
      }),
    });
    const html = lower(
      Scene(
        { id: "s", width: 100, height: 100 },
        Instance({ id: "a", of: v, data: null }),
        Instance({ id: "b", of: v, data: null }),
      ),
    );
    const ids = [...html.matchAll(/id="(si_[^"]+paint)"/g)].map((m) => m[1]);
    expect(new Set(ids).size).toBe(2);
    for (const id of ids) expect(html).toContain(`url(#${id})`);
  });
  it("scopes url-form filter and mask references with their definitions", () => {
    const v = visual<null>({ id: "art", render: () => ({ parts: [{ id: "body", bounds: { x: 0, y: 0, width: 10, height: 10 }, content: h("Vector", { width: 10, height: 10 }, h("defs", {}, h("filter", { id: "blur" }), h("mask", { id: "mask" })), h("rect", { width: 10, height: 10, filter: "url(#blur)", mask: "url(#mask)" })) }] }) });
    const output = lower(Scene({ id: "s", width: 20, height: 10 }, Instance({ id: "a", of: v, data: null })));
    const filter = output.match(/id="(si_[^"]+blur)"/)?.[1];
    const mask = output.match(/id="(si_[^"]+mask)"/)?.[1];
    expect(filter).toBeTruthy(); expect(mask).toBeTruthy();
    expect(output).toContain(`filter="url(#${filter})"`);
    expect(output).toContain(`mask="url(#${mask})"`);
  });

  it("keeps ordered adjacency when attached children precede parents and parts sort independently", () => {
    const resolved = resolveSceneTree(Scene({ id: "s", width: 100, height: 100 },
      Instance({ id: "child", of: cup, data: null, attachTo: { instance: "parent", anchor: "hand" } }),
      Instance({ id: "parent", of: art, data: {} }),
    ));
    const snapshot = collectSceneSnapshots(resolved)[0]!;
    expect(snapshot.nodes.map(({ id, childIds }) => ({ id, childIds }))).toEqual([
      { id: "s", childIds: ["s/parent"] },
      { id: "s/child", childIds: ["s/child/parts/body"] },
      { id: "s/parent", childIds: ["s/child", "s/parent/parts/body"] },
      { id: "s/child/parts/body", childIds: [] },
      { id: "s/parent/parts/body", childIds: [] },
    ]);
    expect(Object.isFrozen(snapshot.nodes[2]!.childIds)).toBe(true);
  });

  it("keeps local camera-fit identity precedence and ordered qualified overrides", () => {
    const make = (target: string) => resolveSceneTree(Scene(
      { id: "s", width: 100, height: 100, camera: { fit: { targets: [target] } } },
      Instance({ id: "a", of: cup, data: null, at: { x: 100, y: 0 } }),
      Instance({ id: "s/a", of: cup, data: null, at: { x: 500, y: 0 } }),
    ), { runtime: { operations: [
      { type: "hide", target: "s/a" },
      { type: "show", target: "s/a" },
      { type: "set", target: "s/a", value: { transform: { x: 20 } } },
    ] } });
    const snapshot = collectSceneSnapshots(make("s/a"))[0]!;
    // A local id literally named s/a wins over the qualified id of a.
    expect(snapshot.camera.x).toBe(502.5);
    expect(snapshot.nodes.find(node => node.id === "s/a")).toMatchObject({ visible: true, transform: { x: 20 } });
  });
});

it("detaches and freezes snapshot metadata, and validates screen coordinates independently", () => {
  const metadata = { acceptedRevision: 4 };
  const tree = Scene({ id: "s", width: 100, height: 100, projection: {x:[100,0],y:[0,-90],z:[0,-45]} }, Instance({id:"hud",of:cup,data:null,at:{x:8,y:9},semantic:{space:"screen",metadata}}));
  const first = packet(tree);
  metadata.acceptedRevision = 99;
  expect(first.nodes.find(n => n.id === "s/hud")!.metadata.acceptedRevision).toBe(4);
  expect(Object.isFrozen(first.instances[0]!.matrix)).toBe(true);
  expect(first.instances[0]!.bounds).toMatchObject({x:8,y:9});
  expect(() => packet(Scene({id:"s",width:100,height:100},Instance({id:"actor",of:art,data:{}}),Instance({id:"hud",of:cup,data:null,semantic:{space:"screen"},attachTo:{instance:"actor",anchor:"hand"}})))).toThrow("same coordinate space");
});
