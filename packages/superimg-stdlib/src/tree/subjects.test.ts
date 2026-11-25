import { describe, expect, expectTypeOf, it } from "vitest";
import { subjectSet } from "./subjects.js";
import { visual, Instance, Scene, collectSceneSnapshots, resolveSceneTree } from "./scene.js";
import { h } from "./h.js";
import { lower } from "./lower.js";

type MugData = {
  design: { color: string; handle: { radius: number } };
  state: { fill: number };
  performance: { tilt: number };
};
const mug = visual<MugData>({
  id: "mug",
  render: ({ data }) => ({
    parts: [{ id: "body", bounds: { x: 0, y: 0, width: 20, height: 30 },
      content: h("rect", { width: 20, height: 30, fill: data.design.color, opacity: data.state.fill }) }],
    anchors: { handle: { x: data.design.handle.radius, y: data.performance.tilt } },
  }),
});
const courier = visual<{ design: { coat: string }; state: { torn: boolean }; performance: { reach: number } }>({
  id: "courier", render: ({ data }) => ({
    parts: [{ id: "coat", bounds: { x: 0, y: 0, width: 30, height: 60 },
      content: h("rect", { width: 30, height: 60, fill: data.design.coat }) }],
    anchors: { hand: { x: data.performance.reach, y: 20 } },
  }),
});
function setup(revision = "mug-design-1") {
  return subjectSet({
    designs: {
      mug: { of: mug, design: { color: "gold", handle: { radius: 8 } }, revision, styleRevision: "ink-1" },
      courier: { of: courier, design: { coat: "blue" }, revision: "courier-design-1" },
    },
    entities: { breakfast: { design: "mug" }, counter: { design: "mug" }, maya: { design: "courier" } },
  });
}
const pose = { state: { fill: 1 }, performance: { tilt: 0 } };
const packet = (tree: ReturnType<typeof Scene>) => collectSceneSnapshots(resolveSceneTree(tree))[0]!;

describe("bound recurring subjects", () => {
  it("infers each entity's visual data without permitting design changes in a sample", () => {
    const cast = setup();
    const sample = cast.sample("breakfast", pose);
    expectTypeOf(sample.data).toEqualTypeOf<MugData>();
    expect(sample.binding).toMatchObject({ entityId: "breakfast", definitionId: "mug", designRevision: "mug-design-1", styleRevision: "ink-1" });
    // Type-only regressions: not executed with intentionally invalid data.
    const typeChecks = () => {
      // @ts-expect-error unknown entity
      cast.sample("stranger", pose);
      // @ts-expect-error courier uses a different performance contract
      cast.sample("maya", pose);
      // @ts-expect-error performance is required
      cast.sample("breakfast", { state: { fill: 1 } });
      // @ts-expect-error design is selected by the entity, not overridden by a shot
      cast.sample("breakfast", { ...pose, design: { color: "red" } });
      // @ts-expect-error unknown design reference
      subjectSet({ designs: { mug: { of: mug, design: sample.data.design, revision: "1" } }, entities: { other: { design: "unknown" } } });
      // @ts-expect-error accepted design must match visual's design type
      subjectSet({ designs: { mug: { of: mug, design: { color: 123 }, revision: "1" } }, entities: {} });
    };
    expect(typeChecks).toBeTypeOf("function");
  });

  it("detaches accepted designs, entity selection and per-occurrence state from caller mutation", () => {
    const design = { color: "gold", handle: { radius: 8 } };
    const definition = { of: mug, design, revision: "1" };
    const entities = { cup: { design: "mug" as const } };
    const cast = subjectSet({ designs: { mug: definition }, entities });
    design.handle.radius = 99; definition.revision = "changed";
    const input = { state: { fill: 0.5 }, performance: { tilt: 2 } };
    const first = cast.sample("cup", input), second = cast.sample("cup", input);
    input.state.fill = 0;
    expect(first.data.design.handle.radius).toBe(8);
    expect(first.binding.designRevision).toBe("1");
    expect(first.data.state.fill).toBe(0.5);
    expect(first.data.state).not.toBe(second.data.state);
    expect(() => { first.data.design.handle.radius = 10; }).toThrow();
    expect(() => { first.data.state.fill = 0; }).toThrow();
    expect(Object.isFrozen(design)).toBe(false);
    expect(Object.isFrozen(input.state)).toBe(false);
  });

  it("retains identity and design across shots without coupling two mugs", () => {
    const cast = setup();
    const sample = (time: number) => packet(Scene({ id: `shot-${time}`, width: 200, height: 100 },
      Instance({ ...cast.sample("breakfast", { state: { fill: time < 5 ? 1 : 0.5 }, performance: { tilt: time } }), id: "cup", at: { x: 20, y: 20 } }),
      Instance({ ...cast.sample("counter", pose), id: "other", at: { x: 100, y: 20 } }),
    ));
    const late = sample(7); sample(2);
    expect(sample(7)).toEqual(late);
    expect(late.instances.map(i => i.entityId)).toEqual(["breakfast", "counter"]);
    expect(late.instances[0]!.binding!.design).toEqual(late.instances[1]!.binding!.design);
    expect(late.instances[0]!.anchors.handle!.y).toBe(27);
    expect(late.instances[1]!.anchors.handle!.y).toBe(20);
    expect(sample(2).instances[0]!.binding).toEqual(late.instances[0]!.binding);
  });

  it("shares attachment geometry with paint and records portable binding evidence", () => {
    const cast = setup();
    const scene = Scene({ id: "handoff", width: 200, height: 100 },
      Instance({ ...cast.sample("maya", { state: { torn: false }, performance: { reach: 40 } }), id: "courier", at: { x: 20, y: 30 } }),
      Instance({ ...cast.sample("breakfast", pose), id: "cup", attachTo: { instance: "courier", anchor: "hand" } }),
    );
    const resolved = packet(scene);
    expect(resolved.instances[1]!.matrix).toMatchObject({ e: 60, f: 50 });
    expect(lower(scene)).toContain("matrix(1 0 0 1 60 50)");
    expect(JSON.parse(JSON.stringify(resolved)).instances[1].binding).toMatchObject({ entityId: "breakfast", designRevision: "mug-design-1" });
  });

  it("rejects substituted identity, definition and accepted design, including raw trees", () => {
    const sample = setup().sample("breakfast", pose);
    expect(() => Instance({ ...sample, id: "cup", entityId: "someone-else" })).toThrow("entityId");
    expect(() => Instance({ ...sample, id: "cup", of: visual({ id: "different", render: mug.render }) })).toThrow("definitionId");
    const changed = { ...sample, id: "cup", data: { ...sample.data, design: { color: "red", handle: { radius: 8 } } } };
    expect(() => Instance(changed)).toThrow("design does not match");
    expect(() => packet(Scene({ id: "s", width: 100, height: 100 }, h("Instance", changed)))).toThrow("design does not match");
    // Key order is not a design change; independently materialized portable data is valid.
    expect(() => Instance({ ...sample, id: "cup", data: { ...sample.data, design: { handle: { radius: 8 }, color: "gold" } } })).not.toThrow();
  });

  it("requires an explicit new design revision and leaves earlier samples unchanged", () => {
    const old = setup().sample("breakfast", pose);
    const next = setup("mug-design-2").sample("breakfast", pose);
    expect(old.binding.designRevision).toBe("mug-design-1");
    expect(next.binding.designRevision).toBe("mug-design-2");
    expect(old.entityId).toBe(next.entityId);
  });

  it("leaves unbound visuals on their original data contract and packet shape", () => {
    const unbound = visual<number>({ id: "ordinary", render: ({ data }) => ({
      parts: [{ id: "body", bounds: { x: 0, y: 0, width: data, height: 10 }, content: h("rect", { width: data, height: 10 }) }],
    }) });
    const resolved = packet(Scene({ id: "s", width: 100, height: 100 }, Instance({ id: "plain", of: unbound, data: 12 })));
    expect(resolved.instances[0]!.definitionId).toBe("ordinary");
    expect(resolved.instances[0]).not.toHaveProperty("binding");
  });

  it("rejects nonportable or ambiguous snapshots without invoking getters", () => {
    const cast = setup();
    const cycle: unknown[] = []; cycle.push(cycle);
    let called = false;
    const getter = { get fill() { called = true; return 1; } };
    for (const state of [undefined, NaN, Infinity, new Date(), new Map(), cycle, [, 1], { fill: undefined }, getter, { [Symbol()]: 1 }]) {
      expect(() => Reflect.apply(cast.sample, cast, ["breakfast", { state, performance: {} }])).toThrow();
    }
    expect(called).toBe(false);
    expect(() => Reflect.apply(cast.sample, cast, ["missing", pose])).toThrow("Unknown subject entity");
    expect(() => setup(" ")).toThrow("revision");
    expect(() => Reflect.apply(cast.sample, cast, ["breakfast", { ...pose, design: {} }])).toThrow("only state and performance");
    expect(() => Reflect.apply(subjectSet, undefined, [{ designs: {}, entities: { missing: { design: "absent" } } }])).toThrow("Unknown subject design");
  });
});
