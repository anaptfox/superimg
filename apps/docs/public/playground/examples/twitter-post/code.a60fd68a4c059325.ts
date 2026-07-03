// Twitter/X Post Animation
// Animated tweet card with engagement stats

const TWEET = {
  author: "Sarah Developer",
  handle: "@sarahdev",
  avatar: "👩‍💻",
  content: "Just shipped my first video with @superimg - the DX is incredible! 🚀\n\nProgrammatic videos in minutes, not hours. This is the future of content creation.",
  time: "2:34 PM",
  date: "Jan 15, 2025",
  likes: 1247,
  retweets: 384,
  replies: 89,
  views: 42800,
};

import { define } from "superimg";
export default define({
  render(ctx) {
  const { width, height, timeline } = ctx;

  // Animate engagement counters
  const eased = 1 - Math.pow(1 - Math.min(1, timeline.progress * 1.5), 3);
  const likes = Math.floor(TWEET.likes * eased);
  const retweets = Math.floor(TWEET.retweets * eased);
  const replies = Math.floor(TWEET.replies * eased);
  const views = Math.floor(TWEET.views * eased);

  // Card animation
  const cardOpacity = Math.min(1, timeline.progress * 3);
  const cardScale = 0.95 + Math.min(0.05, timeline.progress * 0.1);

  // Content fade in
  const contentOpacity = Math.min(1, Math.max(0, (timeline.progress - 0.1) * 2));

  // Stats animation
  const statsOpacity = Math.min(1, Math.max(0, (timeline.progress - 0.3) * 2));

  return `
    <div style="
      width: ${width}px;
      height: ${height}px;
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
        opacity: ${cardOpacity};
        transform: scale(${cardScale});
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
          ">${TWEET.avatar}</div>
          <div>
            <div style="color: white; font-weight: 700; font-size: 16px;">${TWEET.author}</div>
            <div style="color: #8899a6; font-size: 14px;">${TWEET.handle}</div>
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
          opacity: ${contentOpacity};
        ">${TWEET.content}</div>

        <!-- Time -->
        <div style="
          color: #8899a6;
          font-size: 14px;
          margin-bottom: 16px;
          opacity: ${contentOpacity};
        ">${TWEET.time} · ${TWEET.date}</div>

        <!-- Divider -->
        <div style="height: 1px; background: #38444d; margin-bottom: 16px;"></div>

        <!-- Stats row -->
        <div style="
          display: flex;
          gap: 24px;
          opacity: ${statsOpacity};
        ">
          <div style="display: flex; align-items: center; gap: 8px;">
            <span style="color: #8899a6;">💬</span>
            <span style="color: #8899a6; font-size: 14px;">${replies}</span>
          </div>
          <div style="display: flex; align-items: center; gap: 8px;">
            <span style="color: #00ba7c;">🔁</span>
            <span style="color: #8899a6; font-size: 14px;">${retweets.toLocaleString()}</span>
          </div>
          <div style="display: flex; align-items: center; gap: 8px;">
            <span style="color: #f91880;">❤️</span>
            <span style="color: #8899a6; font-size: 14px;">${likes.toLocaleString()}</span>
          </div>
          <div style="display: flex; align-items: center; gap: 8px;">
            <span style="color: #8899a6;">📊</span>
            <span style="color: #8899a6; font-size: 14px;">${(views / 1000).toFixed(1)}K</span>
          </div>
        </div>
      </div>
    </div>
  `;
  },
});