import { describe, expect, it } from "vitest";
import { image, video } from "@superimg/types";
import { subjectSet, visual, Instance, Scene, h, collectSceneSnapshots } from "@superimg/stdlib/tree";
import { resolveMediaIR } from "../ir/resolve-media-ir.js";
import { together } from "../composition/together.js";
import { time } from "../composition/time.js";
import { createRenderContext } from "../rendering/create-render-context.js";

const mug = visual<{ design: { color: string }; state: { fill: number }; performance: { tilt: number } }>({
  id: "mug",
  render: ({ data }) => ({ parts: [{ id: "body", bounds: { x: 0, y: 0, width: 20, height: 30 },
    content: h("rect", { width: 20, height: 30, fill: data.design.color, opacity: data.state.fill }) }],
    anchors: { handle: { x: 20, y: data.performance.tilt } } }),
});
function cast(revision = "design-1", styleRevision = "style-1") {
  return subjectSet({ designs: { mug: { of: mug, design: { color: "gold" }, revision, styleRevision } },
    entities: { jonesMug: { design: "mug" } } });
}
function scene(subjects = cast(), seconds = 0) {
  return Scene({ id: "world", width: 100, height: 100 },
    Instance({ id: "cup", ...subjects.sample("jonesMug", { state: { fill: seconds < 0.5 ? 1 : 0.5 }, performance: { tilt: seconds } }), at: { x: 10, y: 20 } }));
}
describe("subject binding through retained composition and IR", () => {
  it("keeps binding identity while qualifying occurrence paths and placing geometry", () => {
    const subjects = cast();
    const child = video({ size: { width: 100, height: 100 }, duration: "1s", fps: 10, render: ctx => scene(subjects, ctx.timeline.seconds) });
    const media = time(together([
      { id: "wide", content: child, fit: "contain", rect: { x: 0, y: 0, width: 100, height: 100 } },
      { id: "panel", content: child, fit: "contain", rect: { x: 100, y: 0, width: 100, height: 100 } },
    ], { end: "hold" }), { size: { width: 200, height: 100 }, fps: 10 });
    const render = (frame: number) => media.render(createRenderContext(frame, 10, 10, 200, 100));
    const first = collectSceneSnapshots(render(7));
    const early = collectSceneSnapshots(render(2));
    expect(first[0]!.instances[0]!.anchors.handle!.y).not.toBe(early[0]!.instances[0]!.anchors.handle!.y);
    expect(collectSceneSnapshots(render(7))).toEqual(first);
    expect(first.map(p => p.instances[0]!.id)).toEqual(["wide/world/cup", "panel/world/cup"]);
    expect(first.map(p => p.instances[0]!.bounds.x)).toEqual([10, 110]);
    expect(first[0]!.instances[0]!.binding).toEqual(first[1]!.instances[0]!.binding);
    expect(first[0]!.instances[0]!.binding).toMatchObject({ entityId: "jonesMug", definitionId: "mug", designRevision: "design-1" });
  });

  it("retains detached binding evidence in still IR and hashes revisions even when paint is unchanged", async () => {
    const resolve = (revision: string, style = "style-1") => resolveMediaIR(image({ size: { width: 100, height: 100 }, render: () => scene(cast(revision, style)) }));
    const { ir } = await resolve("design-1");
    const payload = ir.extensions["superimg/scene"]!.payload;
    expect(payload).toMatchObject({ ranges: [{ scenes: [{ instances: [{ binding: {
      entityId: "jonesMug", designRevision: "design-1", design: { color: "gold" }, styleRevision: "style-1",
    } }] }] }] });
    const changed = await resolve("design-2"), restyled = await resolve("design-1", "style-2");
    expect(changed.ir.hashes.intentHash).not.toBe(ir.hashes.intentHash);
    expect(restyled.ir.hashes.intentHash).not.toBe(ir.hashes.intentHash);
    expect(JSON.parse(JSON.stringify(payload))).toEqual(payload);
  });
});
