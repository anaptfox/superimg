import { define } from "superimg";

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
        const geo = new THREE.BoxGeometry(1.5, 1.5, 1.5);
        const mat = new THREE.MeshStandardMaterial({
          color: 0x5b8cff,
          metalness: 0.5,
          roughness: 0.3,
        });
        const mesh = new THREE.Mesh(geo, mat);
        scene.add(mesh);
        const edges = new THREE.EdgesGeometry(geo);
        const line = new THREE.LineSegments(
          edges,
          new THREE.LineBasicMaterial({ color: 0x88b4ff }),
        );
        mesh.add(line);
      `,
      animate: `
        mesh.rotation.x = progress * Math.PI * 2;
        mesh.rotation.y = progress * Math.PI * 2.5;
        mesh.position.y = Math.sin(progress * Math.PI * 2) * 0.08;
        renderer.render(scene, camera);
      `,
    });
  },
});