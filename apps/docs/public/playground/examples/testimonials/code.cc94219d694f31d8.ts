// Testimonial Wall
// Social proof that animates in

const TESTIMONIALS = [
  { name: "Sarah Chen", handle: "@sarahc", text: "This changed how we build videos. Incredible!", avatar: "👩‍💻" },
  { name: "Mike Ross", handle: "@mikeross", text: "10x faster than our old workflow.", avatar: "👨‍🎨" },
  { name: "Alex Kim", handle: "@alexk", text: "Finally, programmatic video that doesn't suck.", avatar: "🧑‍🚀" },
];

import { define } from "superimg";
export default define({
  render(ctx) {
  const { width, height, timeline } = ctx;

  const cardWidth = (width - 100) / 3;

  return `
    <div style="
      width: ${width}px;
      height: ${height}px;
      background: linear-gradient(135deg, #1e1e2e 0%, #2d2d44 100%);
      font-family: system-ui, sans-serif;
      padding: 40px;
      box-sizing: border-box;
      display: flex;
      flex-direction: column;
    ">
      <h2 style="color: white; font-size: 32px; text-align: center; margin-bottom: 40px;">
        What people are saying
      </h2>
      <div style="display: flex; gap: 20px; justify-content: center;">
        ${TESTIMONIALS.map((t, i) => {
          const delay = i * 0.2;
          const opacity = Math.min(1, Math.max(0, (timeline.progress - delay) * 3));
          const translateY = (1 - opacity) * 30;
          return `
            <div style="
              width: ${cardWidth}px;
              background: rgba(255,255,255,0.05);
              border-radius: 12px;
              padding: 24px;
              opacity: ${opacity};
              transform: translateY(${translateY}px);
            ">
              <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 16px;">
                <span style="font-size: 36px;">${t.avatar}</span>
                <div>
                  <div style="color: white; font-weight: 600;">${t.name}</div>
                  <div style="color: #888; font-size: 14px;">${t.handle}</div>
                </div>
              </div>
              <p style="color: #ccc; font-size: 16px; line-height: 1.5; margin: 0;">
                "${t.text}"
              </p>
            </div>
          `;
        }).join('')}
      </div>
    </div>
  `;
  },
});