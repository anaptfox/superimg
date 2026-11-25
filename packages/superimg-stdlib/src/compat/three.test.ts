import { describe, it, expect } from "vitest";
import { scene, helpers, THREE_VERSION, THREE_MODULE } from "./three.js";

describe("viz.three", () => {
  it("pins to npm latest three version", () => {
    expect(THREE_VERSION).toMatch(/^\d+\.\d+\.\d+$/);
  });

  it("inlines progress per frame", () => {
    const html = scene({
      width: 800,
      height: 600,
      progress: 0.42,
      setup: "const mesh = new THREE.Mesh(); scene.add(mesh);",
      animate: "mesh.rotation.y = progress * Math.PI;",
    });
    expect(html).toContain("const progress = 0.42");
    expect(html).not.toContain("__SUPERIMG_PROGRESS__");
  });

  it("uses preloaded window.__SUPERIMG_THREE__ (ESM from npm, not deprecated three.min.js)", () => {
    const html = scene({
      width: 100,
      height: 100,
      progress: 0,
      setup: "",
      animate: "renderer.render(scene, camera);",
    });
    expect(THREE_MODULE).toContain(`three@${THREE_VERSION}/build/three.module.min.js`);
    expect(html).toContain("window.__SUPERIMG_THREE__");
    expect(html).not.toContain("three.min.js");
    expect(html).not.toContain('type="module"');
  });

  it("exposes scene/camera/renderer to setup and animate blocks", () => {
    const html = scene({
      width: 100,
      height: 100,
      progress: 0.5,
      setup: "scene.add(new THREE.AmbientLight());",
      animate: "camera.position.z = 4 + progress;",
    });
    expect(html).toContain("const scene = new THREE.Scene()");
    expect(html).toContain("const camera = new THREE.PerspectiveCamera");
    expect(html).toContain("const renderer = new THREE.WebGLRenderer");
  });

  it("helpers emit valid three.js setup snippets", () => {
    expect(helpers.ambient(0.5)).toContain("AmbientLight");
    expect(helpers.directional(1, 2, 3)).toContain("DirectionalLight");
    expect(helpers.point()).toContain("PointLight");
    expect(helpers.fog()).toContain("Fog");
    expect(helpers.grid()).toContain("GridHelper");
    expect(helpers.seed(7)).toContain("seededRandom");
  });

  it("disposes GL context after paint", () => {
    const html = scene({
      width: 100,
      height: 100,
      progress: 0.1,
      setup: "",
      animate: "",
    });
    expect(html).toContain("preserveDrawingBuffer: true");
    expect(html).toContain("renderer.dispose()");
    expect(html).toContain("forceContextLoss()");
    expect(html).toContain("setSize(100, 100, false)");
  });

  it("rejects non-finite progress", () => {
    expect(() =>
      scene({
        width: 10,
        height: 10,
        progress: Number.NaN,
        setup: "",
        animate: "",
      }),
    ).toThrow(/progress/);
  });
});
