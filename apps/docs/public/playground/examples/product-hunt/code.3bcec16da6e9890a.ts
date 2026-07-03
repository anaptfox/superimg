// Product Hunt Launch Card
// Animated launch card with upvote counter

const PRODUCT = {
  name: "SuperImg",
  tagline: "Programmatic video generation for developers",
  icon: "🎬",
  upvotes: 847,
  rank: 1,
};

import { define } from "superimg";
export default define({
  render(ctx) {
  const { width, height, timeline } = ctx;

  // Animate upvote count with easing
  const eased = 1 - Math.pow(1 - Math.min(1, timeline.progress * 1.3), 3);
  const currentUpvotes = Math.floor(PRODUCT.upvotes * eased);

  // Card scale animation
  const cardScale = 0.9 + Math.min(0.1, timeline.progress * 0.15);
  const cardOpacity = Math.min(1, timeline.progress * 2);

  // Upvote button pulse
  const pulseScale = 1 + Math.sin(timeline.progress * Math.PI * 4) * 0.05;

  return `
    <div style="
      width: ${width}px;
      height: ${height}px;
      background: linear-gradient(135deg, #ff6154 0%, #ff8c42 100%);
      font-family: system-ui, sans-serif;
      display: flex;
      align-items: center;
      justify-content: center;
    ">
      <div style="
        background: white;
        border-radius: 16px;
        padding: 32px;
        display: flex;
        gap: 24px;
        align-items: center;
        box-shadow: 0 20px 60px rgba(0,0,0,0.3);
        transform: scale(${cardScale});
        opacity: ${cardOpacity};
      ">
        <!-- Product Icon -->
        <div style="
          width: 80px;
          height: 80px;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          border-radius: 16px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 40px;
        ">${PRODUCT.icon}</div>

        <!-- Product Info -->
        <div style="flex: 1;">
          <div style="
            font-size: 24px;
            font-weight: 700;
            color: #1a1a1a;
            margin-bottom: 8px;
          ">${PRODUCT.name}</div>
          <div style="
            font-size: 16px;
            color: #666;
          ">${PRODUCT.tagline}</div>
        </div>

        <!-- Upvote Button -->
        <div style="
          display: flex;
          flex-direction: column;
          align-items: center;
          padding: 16px 24px;
          background: ${timeline.progress > 0.3 ? '#ff6154' : '#f5f5f5'};
          border-radius: 8px;
          transform: scale(${pulseScale});
          transition: background 0.3s;
        ">
          <div style="
            font-size: 24px;
            color: ${timeline.progress > 0.3 ? 'white' : '#ff6154'};
          ">▲</div>
          <div style="
            font-size: 20px;
            font-weight: 700;
            color: ${timeline.progress > 0.3 ? 'white' : '#1a1a1a'};
          ">${currentUpvotes}</div>
        </div>
      </div>

      <!-- Rank Badge -->
      <div style="
        position: absolute;
        top: 60px;
        right: 80px;
        background: #ff6154;
        color: white;
        padding: 12px 24px;
        border-radius: 100px;
        font-weight: 700;
        font-size: 18px;
        opacity: ${Math.min(1, (timeline.progress - 0.5) * 3)};
        transform: translateY(${(1 - Math.min(1, (timeline.progress - 0.5) * 3)) * 20}px);
      ">
        #${PRODUCT.rank} Product of the Day
      </div>
    </div>
  `;
  },
});