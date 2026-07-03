import { define } from "superimg";

/**
 * 14,000 particles placed on a logarithmic spiral — positions and colors are
 * pure functions of index + progress. Impossible to shoot: every frame is
 * mathematically exact, not motion-tracked footage.
 */
export default define({
  config: {
    width: 1920,
    height: 1080,
    fps: 30,
    duration: "8s",
    fonts: ["JetBrains+Mono:wght@400;600", "Inter:wght@400;600;700"],
    background: "#020208",
  },
  render(ctx) {
    const { std, width, height, timeline } = ctx;
    const three = std.viz.three;
    const t = timeline.progress;

    const theta = (t * 4 * Math.PI).toFixed(3);
    const radius = (2.8 - t * 1.6).toFixed(3);
    const particles = 14000;

    const sceneHtml = three.scene({
      width,
      height,
      progress: t,
      background: "radial-gradient(ellipse 90% 80% at 50% 50%, #0a0e24 0%, #020208 100%)",
      setup: `
        ${three.helpers.ambient(0.35)}
        ${three.helpers.point(0x667eea, 1.8, 2, 1, 3)}
        ${three.helpers.fog(0x020208, 2, 18)}

        const COUNT = ${particles};
        const positions = new Float32Array(COUNT * 3);
        const colors = new Float32Array(COUNT * 3);
        const arms = 4;
        const spread = 0.55;

        for (let i = 0; i < COUNT; i++) {
          const arm = i % arms;
          const t = i / COUNT;
          const theta = t * 28 + arm * (Math.PI * 2 / arms);
          const r = 0.15 + Math.pow(t, 0.65) * 5.5;
          const jitter = (Math.sin(i * 12.9898) * 43758.5453 % 1 - 0.5) * spread * (1 - t * 0.5);
          positions[i * 3] = Math.cos(theta) * (r + jitter);
          positions[i * 3 + 1] = (Math.sin(i * 78.233) * 43758.5453 % 1 - 0.5) * 0.35 * (1 - t);
          positions[i * 3 + 2] = Math.sin(theta) * (r + jitter);

          const hue = 0.58 + t * 0.22 + arm * 0.04;
          const sat = 0.55 + t * 0.25;
          const lit = 0.45 + (1 - t) * 0.35;
          const c = new THREE.Color().setHSL(hue % 1, sat, lit);
          colors[i * 3] = c.r;
          colors[i * 3 + 1] = c.g;
          colors[i * 3 + 2] = c.b;
        }

        const geo = new THREE.BufferGeometry();
        geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
        geo.setAttribute("color", new THREE.BufferAttribute(colors, 3));
        const mat = new THREE.PointsMaterial({
          size: 0.045,
          vertexColors: true,
          transparent: true,
          opacity: 0.92,
          depthWrite: false,
          blending: THREE.AdditiveBlending,
        });
        const galaxy = new THREE.Points(geo, mat);
        scene.add(galaxy);

        const core = new THREE.Mesh(
          new THREE.SphereGeometry(0.18, 32, 32),
          new THREE.MeshBasicMaterial({ color: 0xfff5e6 }),
        );
        scene.add(core);
      `,
      animate: `
        const orbit = progress * Math.PI * 2;
        const camR = 2.8 - progress * 1.6;
        camera.position.x = Math.cos(orbit) * camR;
        camera.position.z = Math.sin(orbit) * camR;
        camera.position.y = 0.35 + Math.sin(progress * Math.PI * 2) * 0.25;
        camera.lookAt(0, 0, 0);

        galaxy.rotation.y = progress * Math.PI * 0.35;
        const pulse = 0.038 + 0.014 * Math.sin(progress * Math.PI * 8);
        galaxy.material.size = pulse;
        core.scale.setScalar(1 + 0.25 * Math.sin(progress * Math.PI * 4));

        renderer.render(scene, camera);
      `,
    });

    const hudOp = std.interpolate(t, [0, 0.08, 0.92, 1], [0, 1, 1, 0]);

    return `
<div style="${std.css({ position: "relative", width, height })}">
  ${sceneHtml}
  <div style="${std.css(
    { position: "absolute", left: 48, bottom: 48, fontFamily: "'JetBrains Mono',monospace", color: "#c8d6ff", opacity: hudOp, gap: 8 },
    std.css.column(),
  )}">
    <div style="font-size:13px;letter-spacing:3px;color:#5b8cff;font-weight:600">PARAMETRIC GALAXY</div>
    <div style="font-size:22px;font-weight:600">r = ae<sup>bθ</sup> · ${particles.toLocaleString()} particles</div>
    <div style="font-size:15px;color:#8b95b0">θ = ${theta} rad · camera r = ${radius} · t = ${timeline.seconds.toFixed(2)}s</div>
    <div style="font-size:13px;color:#6b7795;max-width:520px;line-height:1.5">Every star position is computed from index — not simulated, not filmed. Change one constant, re-render, get a new universe.</div>
  </div>
</div>`;
  },
});