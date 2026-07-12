import { define } from "superimg";

/** Same structure as product-spin (known good) — orbit camera via progress. */
export default define({
  config: {
    width: 1920,
    height: 1080,
    fps: 30,
    duration: "5s",
    fonts: ["Inter:wght@400;600;700"],
    background: "#0a0a0f",
  },
  render(ctx) {
    const { std, width, height, timeline } = ctx;
    const three = std.viz.three;

    return three.scene({
      width,
      height,
      progress: timeline.progress,
      background: "#0a0a0f",
      setup: `
        ${three.helpers.ambient(0.55)}
        ${three.helpers.directional(3, 5, 4)}
        const geo = new THREE.IcosahedronGeometry(1.35, 0);
        const mat = new THREE.MeshStandardMaterial({
          color: 0x5b8cff,
          metalness: 0.45,
          roughness: 0.35,
          flatShading: true,
        });
        const mesh = new THREE.Mesh(geo, mat);
        scene.add(mesh);
        const edges = new THREE.EdgesGeometry(geo);
        mesh.add(new THREE.LineSegments(
          edges,
          new THREE.LineBasicMaterial({ color: 0x88b4ff })
        ));
      `,
      animate: `
        mesh.rotation.y = progress * Math.PI * 2;
        mesh.rotation.x = 0.3 + Math.sin(progress * Math.PI * 2) * 0.15;
        camera.position.set(
          Math.sin(progress * Math.PI * 2) * 4,
          1.1,
          Math.cos(progress * Math.PI * 2) * 4
        );
        camera.lookAt(0, 0, 0);
      `,
    });
  },
});
