// GitHub README Animation
// Animated stats badge for your README.md

import { define } from "superimg";

const STATS = {
  repo: "superimg/superimg",
  stars: 2847,
  forks: 156,
  contributors: 42,
  version: "v2.1.0",
};

export default define({
  render(ctx) {
  const { width, height, timeline } = ctx;

  // Animate counters
  const eased = 1 - Math.pow(1 - Math.min(1, timeline.progress * 1.5), 3);
  const stars = Math.floor(STATS.stars * eased);
  const forks = Math.floor(STATS.forks * eased);
  const contributors = Math.floor(STATS.contributors * eased);

  // Badge animations
  const badge1 = Math.min(1, timeline.progress * 4);
  const badge2 = Math.min(1, Math.max(0, (timeline.progress - 0.1) * 4));
  const badge3 = Math.min(1, Math.max(0, (timeline.progress - 0.2) * 4));
  const badge4 = Math.min(1, Math.max(0, (timeline.progress - 0.3) * 4));

  return `
    <div style="
      width: ${width}px;
      height: ${height}px;
      background: #0d1117;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      padding: 40px;
      box-sizing: border-box;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
    ">
      <!-- Repo name -->
      <div style="
        display: flex;
        align-items: center;
        gap: 12px;
        margin-bottom: 32px;
        opacity: ${Math.min(1, timeline.progress * 3)};
      ">
        <svg width="32" height="32" viewBox="0 0 16 16" fill="#fff">
          <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"/>
        </svg>
        <span style="color: white; font-size: 24px; font-weight: 600;">${STATS.repo}</span>
      </div>

      <!-- Badges row -->
      <div style="display: flex; gap: 16px; flex-wrap: wrap; justify-content: center;">
        <!-- Stars badge -->
        <div style="
          display: flex;
          border-radius: 6px;
          overflow: hidden;
          opacity: ${badge1};
          transform: translateY(${(1 - badge1) * 10}px);
        ">
          <div style="background: #21262d; color: #c9d1d9; padding: 8px 12px; font-size: 14px;">⭐ Stars</div>
          <div style="background: #238636; color: white; padding: 8px 12px; font-size: 14px; font-weight: 600;">${stars.toLocaleString()}</div>
        </div>

        <!-- Forks badge -->
        <div style="
          display: flex;
          border-radius: 6px;
          overflow: hidden;
          opacity: ${badge2};
          transform: translateY(${(1 - badge2) * 10}px);
        ">
          <div style="background: #21262d; color: #c9d1d9; padding: 8px 12px; font-size: 14px;">🍴 Forks</div>
          <div style="background: #1f6feb; color: white; padding: 8px 12px; font-size: 14px; font-weight: 600;">${forks}</div>
        </div>

        <!-- Contributors badge -->
        <div style="
          display: flex;
          border-radius: 6px;
          overflow: hidden;
          opacity: ${badge3};
          transform: translateY(${(1 - badge3) * 10}px);
        ">
          <div style="background: #21262d; color: #c9d1d9; padding: 8px 12px; font-size: 14px;">👥 Contributors</div>
          <div style="background: #8957e5; color: white; padding: 8px 12px; font-size: 14px; font-weight: 600;">${contributors}</div>
        </div>

        <!-- Version badge -->
        <div style="
          display: flex;
          border-radius: 6px;
          overflow: hidden;
          opacity: ${badge4};
          transform: translateY(${(1 - badge4) * 10}px);
        ">
          <div style="background: #21262d; color: #c9d1d9; padding: 8px 12px; font-size: 14px;">📦 Version</div>
          <div style="background: #f0883e; color: white; padding: 8px 12px; font-size: 14px; font-weight: 600;">${STATS.version}</div>
        </div>
      </div>

      <!-- Activity graph hint -->
      <div style="
        margin-top: 40px;
        color: #484f58;
        font-size: 12px;
        opacity: ${Math.max(0, (timeline.progress - 0.5) * 2)};
      ">Perfect for your GitHub README.md</div>
    </div>
  `;
  },
});