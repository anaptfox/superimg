// Logo Animation
// Brand reveal with glow effect

const BRAND = {
  name: "Acme Inc",
  icon: "◆",
  tagline: "Building the future",
};

import { define } from "superimg";
export default define({
  render(ctx) {
  const { width, height, timeline } = ctx;

  // Animation phases
  const iconPhase = Math.min(1, timeline.progress * 2);
  const textPhase = Math.max(0, Math.min(1, (timeline.progress - 0.3) * 2));
  const taglinePhase = Math.max(0, Math.min(1, (timeline.progress - 0.5) * 2));

  // Glow intensity
  const glowIntensity = 20 + Math.sin(timeline.progress * Math.PI * 3) * 10;

  // Icon rotation
  const rotation = timeline.progress * 360;

  // Particle effect
  const particles = Array.from({ length: 12 }, (_, i) => {
    const angle = (i / 12) * Math.PI * 2 + timeline.progress * 2;
    const distance = 80 + Math.sin(timeline.progress * Math.PI * 2 + i) * 20;
    const opacity = iconPhase * (0.3 + Math.sin(timeline.progress * Math.PI * 4 + i) * 0.3);
    return {
      x: width / 2 + Math.cos(angle) * distance * timeline,       y: height / 2 - 20 + Math.sin(angle) * distance * timeline,       opacity,
    };
  });

  return `
    <div style="
      width: ${width}px;
      height: ${height}px;
      background: radial-gradient(circle at center, #1a1a2e 0%, #0a0a15 100%);
      font-family: system-ui, sans-serif;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      position: relative;
      overflow: hidden;
    ">
      <!-- Particles -->
      ${particles.map(p => `
        <div style="
          position: absolute;
          left: ${p.x}px;
          top: ${p.y}px;
          width: 6px;
          height: 6px;
          background: #6366f1;
          border-radius: 50%;
          opacity: ${p.opacity};
          box-shadow: 0 0 10px #6366f1;
        "></div>
      `).join('')}

      <!-- Logo Icon -->
      <div style="
        font-size: 100px;
        color: #6366f1;
        transform: scale(${iconPhase}) rotate(${rotation}deg);
        text-shadow: 0 0 ${glowIntensity}px #6366f1, 0 0 ${glowIntensity * 2}px #6366f1;
        margin-bottom: 24px;
      ">${BRAND.icon}</div>

      <!-- Brand Name -->
      <div style="
        font-size: 48px;
        font-weight: 700;
        color: white;
        opacity: ${textPhase};
        transform: translateY(${(1 - textPhase) * 20}px);
        letter-spacing: 4px;
      ">${BRAND.name}</div>

      <!-- Tagline -->
      <div style="
        font-size: 18px;
        color: #888;
        margin-top: 16px;
        opacity: ${taglinePhase};
        transform: translateY(${(1 - taglinePhase) * 10}px);
        letter-spacing: 2px;
      ">${BRAND.tagline}</div>

      <!-- Bottom accent line -->
      <div style="
        width: ${200 * textPhase}px;
        height: 2px;
        background: linear-gradient(90deg, transparent, #6366f1, transparent);
        margin-top: 32px;
      "></div>
    </div>
  `;
  },
});