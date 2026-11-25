import { describe, expect, it } from "vitest";
import { Image } from "../superimg-stdlib/src/tree/primitives.js";
import { Instance, Scene, visual } from "../superimg-stdlib/src/tree/scene.js";
import { vector } from "../superimg-stdlib/src/tree/vector.js";
import { projectNativeScene } from "./authoring.js";

describe("native scene projection", () => {
  it("preserves shared part order, mirrored paint geometry, and anchor positions", () => {
    const resident = visual({
      id: "resident",
      render: () => ({
        parts: [
          { id: "body", bounds: { x: -3, y: -4, width: 6, height: 4 }, content: Image({ src: "sprite", fit: "fill" }) },
          { id: "shadow", band: -1, bounds: { x: -2, y: -1, width: 4, height: 2 }, content: vector.ellipse({ rx: 2, ry: 1, fill: "#112233" }) },
        ],
        anchors: { talk: { x: 3, y: -7 } },
      }),
    });
    const scene = Scene({ id: "lane", width: 100, height: 100 },
      Instance({ id: "visit", entityId: "nell", of: resident, data: null, at: { x: 20, y: 35 }, transform: { scaleX: -1 } }),
    );
    const frame = projectNativeScene(scene);
    expect(frame.draw.map(draw => draw.kind)).toEqual(["ellipse", "sprite"]);
    expect(frame.draw[1]).toMatchObject({ asset: "sprite", x: -3, y: -4, width: 6, height: 4, matrix: { a: -1, e: 20, f: 35 } });
    expect(frame.anchors).toEqual([{ entity: "nell", name: "talk", x: 17, y: 28 }]);
  });

  it("refuses a paint operation outside the native subset by part ID", () => {
    const figure = visual({
      id: "shape",
      render: () => ({
        parts: [{ id: "ink", bounds: { x: 0, y: 0, width: 5, height: 5 }, content: vector.path({ d: "M0 0 L5 5" }) }],
      }),
    });
    const tree = Scene({ id: "lane", width: 10, height: 10 }, Instance({ id: "figure", of: figure, data: null }));
    expect(() => projectNativeScene(tree)).toThrow("Unsupported native paint at lane/figure/parts/ink (VectorPath)");
  });
});
