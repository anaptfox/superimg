import { define } from "superimg";

/**
 * Fly-through a tube along a helical centerline. Radius and path phase are
 * pure functions of timeline.progress — rebuilds exactly each frame.
 */
export default define({
  config: {
    width: 1920,
    height: 1080,
    fps: 30,
    duration: "7s",
    fonts: ["JetBrains+Mono:wght@400;600", "Inter:wght@400;600;700"],
    background: "#03030a",
  },
  render(ctx) {
    const { std, width, height, timeline, timeline } = ctx;
    const three = std.viz.three;
    const t = timeline.progress;

    // 0 → circle-ish, 1 → pinched superellipse, 2 → rounded square (via exponent)
    const morph = std.interpolate(t, [0, 0.33, 0.66, 1], [0, 1, 2, 0], "easeInOutCubic");
    const morphLabel = morph < 0.5 ? "wide" : morph < 1.5 ? "pinched" : "square";

    const sceneHtml = three.scene({
      width,
      height,
      progress: t,
      background: "linear-gradient(180deg, #03030a 0%, #0d1030 50%, #03030a 100%)",
      setup: `
        ${three.helpers.ambient(0.3)}
        ${three.helpers.directional(5, 8, 3)}
        ${three.helpers.point(0xf093fb, 1.8, 0, 0, 0)}
        ${three.helpers.fog(0x03030a, 2, 20)}

        const MORPH = ${morph.toFixed(4)};
        const SEGMENTS = 180;
        const points = [];

        // Superellipse exponent: 2 = circle, 8+ = squircle, 0.5 = star-ish (clamped)
        const exponent = MORPH < 1
          ? 2 + MORPH * 5
          : 7 + (MORPH - 1) * 3;

        // Build centerline: helix rising along Y with radius modulated by arc length
        for (let i = 0; i <= SEGMENTS; i++) {
          const u = i / SEGMENTS;
          const theta = u * Math.PI * 5 + progress * Math.PI * 1.2;
          const helixR = 2.4 + 0.5 * Math.sin(u * Math.PI * 3 + progress * Math.PI * 2);
          const y = (u - 0.5) * 24 + Math.sin(u * 12 + progress * 5) * 0.5;
          const x = helixR * Math.cos(theta);
          const z = helixR * Math.sin(theta);
          points.push(new THREE.Vector3(x, y, z));
        }

        const curve = new THREE.CatmullRomCurve3(points, false, "centripetal", 0.35);

        // Radius from superellipse exponent: n=2 → wide, n=7 → pinched, n=10 → tight
        const tubeRadius = 0.44 * Math.pow(2 / exponent, 0.35);
        const tubeGeo = new THREE.TubeGeometry(curve, 240, tubeRadius, 24, false);
        const tubeMat = new THREE.MeshStandardMaterial({
          color: 0x5b8cff,
          metalness: 0.6,
          roughness: 0.25,
          emissive: 0x1a2040,
          emissiveIntensity: 0.45,
          side: THREE.BackSide,
        });
        const tunnel = new THREE.Mesh(tubeGeo, tubeMat);
        scene.add(tunnel);

        const railGeo = new THREE.TubeGeometry(curve, 160, tubeRadius + 0.06, 12, false);
        const rails = new THREE.Mesh(
          railGeo,
          new THREE.MeshBasicMaterial({
            color: 0x88b4ff,
            wireframe: true,
            transparent: true,
            opacity: 0.2,
          }),
        );
        scene.add(rails);

        // Inner ring markers spaced along curve
        const ringGroup = new THREE.Group();
        const ringCount = 12;
        for (let k = 0; k < ringCount; k++) {
          const ru = k / (ringCount - 1);
          const pt = curve.getPointAt(ru);
          const tan = curve.getTangentAt(ru).normalize();
          const ring = new THREE.Mesh(
            new THREE.TorusGeometry(tubeRadius * 0.85, 0.012, 8, 32),
            new THREE.MeshBasicMaterial({
              color: 0xf093fb,
              transparent: true,
              opacity: 0.35 + 0.25 * Math.sin(ru * Math.PI * 4 + progress * 6),
            }),
          );
          ring.position.copy(pt);
          ring.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), tan);
          ringGroup.add(ring);
        }
        scene.add(ringGroup);
      `,
      animate: `
        const u = Math.min(0.995, Math.max(0.005, progress));
        const pos = curve.getPointAt(u);
        const tan = curve.getTangentAt(u).normalize();
        camera.position.copy(pos);
        camera.lookAt(pos.clone().add(tan.multiplyScalar(3)));

        const hue = 0.58 + 0.08 * Math.sin(progress * Math.PI * 4);
        tunnel.material.color.setHSL(hue, 0.7, 0.55);
        tunnel.material.emissiveIntensity = 0.4 + 0.2 * Math.sin(progress * Math.PI * 6);

        renderer.render(scene, camera);
      `,
    });

    const hudOp = std.interpolate(t, [0, 0.06, 0.94, 1], [0, 1, 1, 0]);

    return `
<div style="${std.css({ position: "relative", width, height })}">
  ${sceneHtml}
  <div style="${std.css(
    { position: "absolute", right: 48, top: 48, textAlign: "right", fontFamily: "'JetBrains Mono',monospace", color: "#e2e8f0", opacity: hudOp, gap: 6 },
    std.css.column(),
  )}">
    <div style="font-size:13px;letter-spacing:3px;color:#f093fb;font-weight:600">MATH TUNNEL</div>
    <div style="font-size:18px">u = ${t.toFixed(4)} · ${(t * 100).toFixed(1)}% along helix</div>
    <div style="font-size:15px;color:#8b95b0">profile: ${morphLabel} · t = ${timeline.seconds.toFixed(2)}s</div>
    <div style="font-size:13px;color:#6b7795;max-width:400px;line-height:1.45">Helix r(t)·[cos θ, sin θ] + y(t) — camera follows Frenet tangent. Rebuilt every frame from progress.</div>
  </div>
</div>`;
  },
});