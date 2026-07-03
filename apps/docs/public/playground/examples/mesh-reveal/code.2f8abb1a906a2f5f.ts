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
      progress: timeline,       background: "radial-gradient(ellipse 70% 60% at 50% 50%, #1a1030 0%, #0a0a0f 100%)",
      setup: `
        ${three.helpers.ambient(0.45)}
        ${three.helpers.directional(2, 4, 5)}
        const geo = new THREE.TorusKnotGeometry(0.85, 0.26, 160, 24);
        const mat = new THREE.MeshStandardMaterial({
          color: 0x667eea,
          metalness: 0.55,
          roughness: 0.25,
        });
        const mesh = new THREE.Mesh(geo, mat);
        scene.add(mesh);
      `,
      animate: `
        const hue = progress;
        mesh.material.color.setHSL(hue, 0.65, 0.55);
        mesh.rotation.x = progress * Math.PI * 1.5;
        mesh.rotation.y = progress * Math.PI * 2.2;
        mesh.scale.setScalar(0.85 + 0.15 * Math.sin(progress * Math.PI));
        renderer.render(scene, camera);
      `,
    });
  },
});