import { describe, expect, it } from "vitest";
import {
  captionStates,
  centeredCamera,
  focusOn,
  mergeNodePatch,
  scene,
} from "./scene-helpers.js";

describe("interactive scene centeredCamera", () => {
  it("compensates pan so zoom stays centered", () => {
    const cam = centeredCamera(1440, 960, { zoom: 1.2, rotation: 3, fit: { target: "wallet", padding: 72 } });
    expect(cam.x).toBeCloseTo(-(1440 * 0.2) / 2, 5);
    expect(cam.y).toBeCloseTo(-(960 * 0.2) / 2, 5);
    expect(cam.zoom).toBe(1.2);
    expect(cam.rotation).toBe(3);
    expect(cam.fit).toEqual({ target: "wallet", padding: 72 });
    expect(cam.follow).toBeNull();
  });

  it("is identity pan at zoom 1", () => {
    const cam = centeredCamera(1080, 1080, { zoom: 1 });
    expect(cam.x).toBe(0);
    expect(cam.y).toBe(0);
  });

  it("rejects non-positive dimensions", () => {
    expect(() => centeredCamera(0, 100, { zoom: 1 })).toThrow(/width/);
    expect(() => centeredCamera(100, -1, { zoom: 1 })).toThrow(/height/);
    expect(() => centeredCamera(100, 100, { zoom: 0 })).toThrow(/zoom/);
  });
});

describe("interactive scene focusOn / mergeNodePatch", () => {
  it("deep-merges transform fields", () => {
    const merged = mergeNodePatch(
      { opacity: 0.5, transform: { x: 10, y: 20, scale: 1 } },
      { transform: { y: 40, rotate: 5 } },
    );
    expect(merged).toEqual({
      opacity: 0.5,
      transform: { x: 10, y: 40, scale: 1, rotate: 5 },
    });
  });

  it("focusOn keeps base keys and applies overrides", () => {
    const result = focusOn(
      {
        owner: { opacity: 0 },
        "keep-path": { opacity: 0 },
      },
      {
        owner: { opacity: 0.8, transform: { x: -20 } },
      },
    );
    expect(result.owner).toEqual({ opacity: 0.8, transform: { x: -20 } });
    expect(result["keep-path"]).toEqual({ opacity: 0 });
  });

  it("focusOn can introduce override-only keys", () => {
    const result = focusOn({ a: { opacity: 1 } }, { b: { opacity: 0.2 } });
    expect(Object.keys(result).sort()).toEqual(["a", "b"]);
  });
});

describe("interactive scene captionStates", () => {
  it("sets one active caption and directional y offsets", () => {
    const states = captionStates(["encounter", "inventory", "temptation"], "inventory");
    expect(states["caption.inventory"]).toEqual({ opacity: 1, transform: { y: 0 } });
    expect(states["caption.encounter"]).toEqual({ opacity: 0, transform: { y: -18 } });
    expect(states["caption.temptation"]).toEqual({ opacity: 0, transform: { y: 24 } });
  });
});

describe("interactive scene namespace object", () => {
  it("exposes the same helpers as named exports", () => {
    expect(scene.centeredCamera).toBe(centeredCamera);
    expect(scene.focusOn).toBe(focusOn);
    expect(scene.captionStates).toBe(captionStates);
  });
});
