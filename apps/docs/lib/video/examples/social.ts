export const TESTIMONIALS = `// Testimonial Wall
// Social proof that animates in

const TESTIMONIALS = [
  { name: "Sarah Chen", handle: "@sarahc", text: "This changed how we build videos. Incredible!", avatar: "👩‍💻" },
  { name: "Mike Ross", handle: "@mikeross", text: "10x faster than our old workflow.", avatar: "👨‍🎨" },
  { name: "Alex Kim", handle: "@alexk", text: "Finally, programmatic video that doesn't suck.", avatar: "🧑‍🚀" },
];

import { defineTemplate } from "superimg";
export default defineTemplate({
  render(ctx) {
  const { width, height, sceneProgress } = ctx;

  const cardWidth = (width - 100) / 3;

  return \`
    <div style="
      width: \${width}px;
      height: \${height}px;
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
        \${TESTIMONIALS.map((t, i) => {
          const delay = i * 0.2;
          const opacity = Math.min(1, Math.max(0, (sceneProgress - delay) * 3));
          const translateY = (1 - opacity) * 30;
          return \`
            <div style="
              width: \${cardWidth}px;
              background: rgba(255,255,255,0.05);
              border-radius: 12px;
              padding: 24px;
              opacity: \${opacity};
              transform: translateY(\${translateY}px);
            ">
              <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 16px;">
                <span style="font-size: 36px;">\${t.avatar}</span>
                <div>
                  <div style="color: white; font-weight: 600;">\${t.name}</div>
                  <div style="color: #888; font-size: 14px;">\${t.handle}</div>
                </div>
              </div>
              <p style="color: #ccc; font-size: 16px; line-height: 1.5; margin: 0;">
                "\${t.text}"
              </p>
            </div>
          \`;
        }).join('')}
      </div>
    </div>
  \`;
  },
});`;

export const MILESTONE = `// Follower Milestone
// Dramatic counter reveal

const MILESTONE = 100000;
const PLATFORM = "Twitter";

import { defineTemplate } from "superimg";
export default defineTemplate({
  render(ctx) {
  const { width, height, sceneProgress } = ctx;

  // Easing function for dramatic effect
  const eased = 1 - Math.pow(1 - Math.min(1, sceneProgress * 1.2), 3);
  const count = Math.floor(MILESTONE * eased);

  // Particle effect
  const particles = Array.from({ length: 20 }, (_, i) => ({
    x: width / 2 + Math.sin(i * 0.5 + sceneProgress * 10) * (100 + i * 10) * sceneProgress,
    y: height / 2 + Math.cos(i * 0.7 + sceneProgress * 8) * (80 + i * 8) * sceneProgress,
    size: 4 + Math.random() * 4,
    opacity: Math.max(0, 1 - sceneProgress * 1.5 + 0.5),
  }));

  return \`
    <div style="
      width: \${width}px;
      height: \${height}px;
      background: radial-gradient(circle at center, #1d4ed8 0%, #0f172a 70%);
      font-family: system-ui, sans-serif;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      position: relative;
      overflow: hidden;
    ">
      \${particles.map(p => \`
        <div style="
          position: absolute;
          left: \${p.x}px;
          top: \${p.y}px;
          width: \${p.size}px;
          height: \${p.size}px;
          background: #60a5fa;
          border-radius: 50%;
          opacity: \${p.opacity};
        "></div>
      \`).join('')}
      <div style="color: #60a5fa; font-size: 24px; margin-bottom: 16px;">
        🎉 \${PLATFORM} Milestone
      </div>
      <div style="
        color: white;
        font-size: 96px;
        font-weight: bold;
        text-shadow: 0 0 40px rgba(96, 165, 250, 0.5);
      ">
        \${count.toLocaleString()}
      </div>
      <div style="color: #94a3b8; font-size: 28px; margin-top: 8px;">
        followers
      </div>
    </div>
  \`;
  },
});`;

export const MRR = `// MRR Counter
// Revenue milestone celebration

const TARGET_MRR = 50000;
const CURRENCY = "$";

import { defineTemplate } from "superimg";
export default defineTemplate({
  render(ctx) {
  const { width, height, sceneProgress } = ctx;

  // Dramatic easing
  const eased = 1 - Math.pow(1 - Math.min(1, sceneProgress * 1.1), 4);
  const amount = Math.floor(TARGET_MRR * eased);

  // Glow intensity based on progress
  const glowIntensity = 20 + sceneProgress * 40;

  return \`
    <div style="
      width: \${width}px;
      height: \${height}px;
      background: linear-gradient(180deg, #0a0a0a 0%, #1a1a2e 100%);
      font-family: system-ui, sans-serif;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
    ">
      <div style="color: #10b981; font-size: 20px; letter-spacing: 4px; margin-bottom: 24px;">
        MONTHLY RECURRING REVENUE
      </div>
      <div style="
        color: #10b981;
        font-size: 120px;
        font-weight: bold;
        text-shadow: 0 0 \${glowIntensity}px rgba(16, 185, 129, 0.6);
      ">
        \${CURRENCY}\${amount.toLocaleString()}
      </div>
      <div style="
        color: #6b7280;
        font-size: 24px;
        margin-top: 24px;
      ">
        🚀 We hit \${CURRENCY}\${(TARGET_MRR / 1000)}K MRR!
      </div>
    </div>
  \`;
  },
});`;

export const WEEKLY_SCHEDULE = `// Weekly Schedule
// Calendar grid with animated time blocks

const SCHEDULE = {
  Mon: [{ start: 9, duration: 2, type: "deep", label: "Focus Time" }],
  Tue: [
    { start: 10, duration: 1, type: "meeting", label: "Standup" },
    { start: 14, duration: 2, type: "deep", label: "Coding" },
  ],
  Wed: [{ start: 11, duration: 2, type: "meeting", label: "Planning" }],
  Thu: [
    { start: 9, duration: 1, type: "meeting", label: "1:1" },
    { start: 13, duration: 3, type: "deep", label: "Project Work" },
  ],
  Fri: [{ start: 10, duration: 2, type: "deep", label: "Review" }],
};

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri"];
const HOURS = [9, 10, 11, 12, 13, 14, 15, 16];

import { defineTemplate } from "superimg";
export default defineTemplate({
  render(ctx) {
  const { width, height, sceneProgress } = ctx;

  const padding = 40;
  const labelWidth = 60;
  const headerHeight = 50;
  const gridWidth = width - padding * 2 - labelWidth;
  const gridHeight = height - padding * 2 - headerHeight;
  const colWidth = gridWidth / DAYS.length;
  const rowHeight = gridHeight / HOURS.length;

  const colors = {
    deep: { bg: "#3b82f6", border: "#2563eb" },
    meeting: { bg: "#f59e0b", border: "#d97706" },
  };

  return \`
    <div style="
      width: \${width}px;
      height: \${height}px;
      background: #1e1e2e;
      font-family: system-ui, sans-serif;
      padding: \${padding}px;
      box-sizing: border-box;
    ">
      <!-- Header row with days -->
      <div style="
        display: flex;
        margin-left: \${labelWidth}px;
        margin-bottom: 10px;
      ">
        \${DAYS.map((day, i) => {
          const opacity = Math.min(1, Math.max(0, (sceneProgress * 2 - i * 0.1) * 2));
          return \`
            <div style="
              width: \${colWidth}px;
              text-align: center;
              color: #94a3b8;
              font-weight: 600;
              font-size: 16px;
              opacity: \${opacity};
            ">\${day}</div>
          \`;
        }).join('')}
      </div>

      <!-- Grid container -->
      <div style="display: flex; position: relative;">
        <!-- Time labels -->
        <div style="width: \${labelWidth}px;">
          \${HOURS.map((hour, i) => {
            const opacity = Math.min(1, Math.max(0, sceneProgress * 3 - i * 0.05));
            return \`
              <div style="
                height: \${rowHeight}px;
                color: #64748b;
                font-size: 13px;
                display: flex;
                align-items: center;
                opacity: \${opacity};
              ">\${hour}:00</div>
            \`;
          }).join('')}
        </div>

        <!-- Grid lines -->
        <div style="
          position: relative;
          width: \${gridWidth}px;
          height: \${gridHeight}px;
        ">
          <!-- Horizontal lines -->
          \${HOURS.map((_, i) => \`
            <div style="
              position: absolute;
              top: \${i * rowHeight}px;
              left: 0;
              right: 0;
              height: 1px;
              background: rgba(148, 163, 184, 0.1);
            "></div>
          \`).join('')}

          <!-- Vertical lines -->
          \${DAYS.map((_, i) => \`
            <div style="
              position: absolute;
              left: \${i * colWidth}px;
              top: 0;
              bottom: 0;
              width: 1px;
              background: rgba(148, 163, 184, 0.1);
            "></div>
          \`).join('')}

          <!-- Schedule blocks -->
          \${DAYS.map((day, dayIndex) => {
            const dayProgress = Math.max(0, Math.min(1, (sceneProgress - 0.2 - dayIndex * 0.1) * 3));
            return SCHEDULE[day].map((block, blockIndex) => {
              const blockProgress = Math.max(0, Math.min(1, (dayProgress - blockIndex * 0.2) * 2));
              const x = dayIndex * colWidth + 4;
              const y = (block.start - HOURS[0]) * rowHeight + 4;
              const blockHeight = block.duration * rowHeight - 8;
              const blockWidth = colWidth - 8;
              const color = colors[block.type];

              return \`
                <div style="
                  position: absolute;
                  left: \${x}px;
                  top: \${y}px;
                  width: \${blockWidth}px;
                  height: \${blockHeight * blockProgress}px;
                  background: \${color.bg};
                  border-left: 3px solid \${color.border};
                  border-radius: 4px;
                  opacity: \${blockProgress};
                  overflow: hidden;
                ">
                  <div style="
                    padding: 8px;
                    color: white;
                    font-size: 12px;
                    font-weight: 500;
                  ">\${block.label}</div>
                </div>
              \`;
            }).join('');
          }).join('')}
        </div>
      </div>

      <!-- Legend -->
      <div style="
        display: flex;
        gap: 24px;
        margin-top: 20px;
        margin-left: \${labelWidth}px;
        opacity: \${Math.min(1, sceneProgress * 2)};
      ">
        <div style="display: flex; align-items: center; gap: 8px;">
          <div style="width: 16px; height: 16px; background: #3b82f6; border-radius: 3px;"></div>
          <span style="color: #94a3b8; font-size: 13px;">Deep Work</span>
        </div>
        <div style="display: flex; align-items: center; gap: 8px;">
          <div style="width: 16px; height: 16px; background: #f59e0b; border-radius: 3px;"></div>
          <span style="color: #94a3b8; font-size: 13px;">Meetings</span>
        </div>
      </div>
    </div>
  \`;
  },
});`;

export const TWITTER_POST = `// Twitter/X Post Animation
// Animated tweet card with engagement stats

const TWEET = {
  author: "Sarah Developer",
  handle: "@sarahdev",
  avatar: "👩‍💻",
  content: "Just shipped my first video with @superimg - the DX is incredible! 🚀\\n\\nProgrammatic videos in minutes, not hours. This is the future of content creation.",
  time: "2:34 PM",
  date: "Jan 15, 2025",
  likes: 1247,
  retweets: 384,
  replies: 89,
  views: 42800,
};

import { defineTemplate } from "superimg";
export default defineTemplate({
  render(ctx) {
  const { width, height, sceneProgress } = ctx;

  // Animate engagement counters
  const eased = 1 - Math.pow(1 - Math.min(1, sceneProgress * 1.5), 3);
  const likes = Math.floor(TWEET.likes * eased);
  const retweets = Math.floor(TWEET.retweets * eased);
  const replies = Math.floor(TWEET.replies * eased);
  const views = Math.floor(TWEET.views * eased);

  // Card animation
  const cardOpacity = Math.min(1, sceneProgress * 3);
  const cardScale = 0.95 + Math.min(0.05, sceneProgress * 0.1);

  // Content fade in
  const contentOpacity = Math.min(1, Math.max(0, (sceneProgress - 0.1) * 2));

  // Stats animation
  const statsOpacity = Math.min(1, Math.max(0, (sceneProgress - 0.3) * 2));

  return \`
    <div style="
      width: \${width}px;
      height: \${height}px;
      background: #15202b;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 40px;
      box-sizing: border-box;
    ">
      <div style="
        background: #192734;
        border-radius: 16px;
        padding: 24px;
        max-width: 550px;
        width: 100%;
        border: 1px solid #38444d;
        opacity: \${cardOpacity};
        transform: scale(\${cardScale});
      ">
        <!-- Author row -->
        <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 16px;">
          <div style="
            width: 48px;
            height: 48px;
            background: linear-gradient(135deg, #1da1f2 0%, #0d8bd9 100%);
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 24px;
          ">\${TWEET.avatar}</div>
          <div>
            <div style="color: white; font-weight: 700; font-size: 16px;">\${TWEET.author}</div>
            <div style="color: #8899a6; font-size: 14px;">\${TWEET.handle}</div>
          </div>
          <div style="margin-left: auto;">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="#1da1f2">
              <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
            </svg>
          </div>
        </div>

        <!-- Tweet content -->
        <div style="
          color: white;
          font-size: 18px;
          line-height: 1.5;
          margin-bottom: 16px;
          white-space: pre-wrap;
          opacity: \${contentOpacity};
        ">\${TWEET.content}</div>

        <!-- Time -->
        <div style="
          color: #8899a6;
          font-size: 14px;
          margin-bottom: 16px;
          opacity: \${contentOpacity};
        ">\${TWEET.time} · \${TWEET.date}</div>

        <!-- Divider -->
        <div style="height: 1px; background: #38444d; margin-bottom: 16px;"></div>

        <!-- Stats row -->
        <div style="
          display: flex;
          gap: 24px;
          opacity: \${statsOpacity};
        ">
          <div style="display: flex; align-items: center; gap: 8px;">
            <span style="color: #8899a6;">💬</span>
            <span style="color: #8899a6; font-size: 14px;">\${replies}</span>
          </div>
          <div style="display: flex; align-items: center; gap: 8px;">
            <span style="color: #00ba7c;">🔁</span>
            <span style="color: #8899a6; font-size: 14px;">\${retweets.toLocaleString()}</span>
          </div>
          <div style="display: flex; align-items: center; gap: 8px;">
            <span style="color: #f91880;">❤️</span>
            <span style="color: #8899a6; font-size: 14px;">\${likes.toLocaleString()}</span>
          </div>
          <div style="display: flex; align-items: center; gap: 8px;">
            <span style="color: #8899a6;">📊</span>
            <span style="color: #8899a6; font-size: 14px;">\${(views / 1000).toFixed(1)}K</span>
          </div>
        </div>
      </div>
    </div>
  \`;
  },
});`;
