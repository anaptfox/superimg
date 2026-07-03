// Git Branch Animation
// Visualizing git workflow with branches

import { define } from "superimg";

const COMMITS = {
  main: [
    { hash: "a1b2c3", msg: "init" },
    { hash: "d4e5f6", msg: "feat: setup" },
    { hash: "g7h8i9", msg: "merge: feature" },
    { hash: "j0k1l2", msg: "release v1.0" },
  ],
  feature: [
    { hash: "f1f2f3", msg: "feat: add auth" },
    { hash: "f4f5f6", msg: "fix: validation" },
    { hash: "f7f8f9", msg: "test: auth" },
  ],
};

export default define({
  render(ctx) {
    const { width, height, timeline } = ctx;

    const padding = 50;
    const mainY = height * 0.35;
    const featureY = height * 0.6;
    const commitSpacing = (width - padding * 2) / 5;

    // Animation phases
    const mainProgress = Math.min(1, timeline.progress * 2);
    const branchProgress = Math.max(0, Math.min(1, (timeline.progress - 0.3) * 2.5));
    const mergeProgress = Math.max(0, Math.min(1, (timeline.progress - 0.7) * 3));

    return `
    <div style="
      width: ${width}px;
      height: ${height}px;
      background: #0d1117;
      font-family: 'SF Mono', Monaco, monospace;
      position: relative;
      overflow: hidden;
    ">
      <!-- Branch labels -->
      <div style="position: absolute; left: 20px; top: ${mainY - 8}px; color: #3fb950; font-size: 14px; font-weight: 600;">main</div>
      <div style="position: absolute; left: 20px; top: ${featureY - 8}px; color: #a371f7; font-size: 14px; font-weight: 600; opacity: ${branchProgress};">feature</div>

      <!-- Main branch line -->
      <svg width="${width}" height="${height}" style="position: absolute; top: 0; left: 0;">
        <!-- Main branch -->
        <line
          x1="${padding}" y1="${mainY}"
          x2="${padding + commitSpacing * 4 * mainProgress}" y2="${mainY}"
          stroke="#3fb950" stroke-width="3" stroke-linecap="round"
        />

        <!-- Feature branch fork -->
        <path
          d="M ${padding + commitSpacing} ${mainY} Q ${padding + commitSpacing + 30} ${(mainY + featureY) / 2} ${padding + commitSpacing + 50} ${featureY}"
          stroke="#a371f7" stroke-width="3" fill="none" stroke-linecap="round"
          stroke-dasharray="${100 * branchProgress} 100"
        />

        <!-- Feature branch line -->
        <line
          x1="${padding + commitSpacing + 50}" y1="${featureY}"
          x2="${padding + commitSpacing + 50 + commitSpacing * 2 * branchProgress}" y2="${featureY}"
          stroke="#a371f7" stroke-width="3" stroke-linecap="round"
        />

        <!-- Merge line -->
        <path
          d="M ${padding + commitSpacing * 3 + 50} ${featureY} Q ${padding + commitSpacing * 3 + 80} ${(mainY + featureY) / 2} ${padding + commitSpacing * 3} ${mainY}"
          stroke="#a371f7" stroke-width="3" fill="none" stroke-linecap="round"
          stroke-dasharray="${100 * mergeProgress} 100"
        />
      </svg>

      <!-- Main commits -->
      ${COMMITS.main.map((c, i) => {
        const x = padding + i * commitSpacing + (i > 1 ? 0 : 0);
        const showAt = i / COMMITS.main.length;
        const opacity = mainProgress > showAt ? 1 : 0;
        return `
          <div style="
            position: absolute;
            left: ${x}px;
            top: ${mainY}px;
            transform: translate(-50%, -50%);
            opacity: ${opacity};
          ">
            <div style="
              width: 20px; height: 20px;
              background: #3fb950;
              border-radius: 50%;
              border: 3px solid #0d1117;
            "></div>
            <div style="
              position: absolute;
              top: 28px;
              left: 50%;
              transform: translateX(-50%);
              color: #8b949e;
              font-size: 11px;
              white-space: nowrap;
            ">${c.msg}</div>
          </div>
        `;
      }).join('')}

      <!-- Feature commits -->
      ${COMMITS.feature.map((c, i) => {
        const x = padding + commitSpacing + 50 + i * commitSpacing;
        const opacity = branchProgress > (i + 1) / COMMITS.feature.length ? 1 : 0;
        return `
          <div style="
            position: absolute;
            left: ${x}px;
            top: ${featureY}px;
            transform: translate(-50%, -50%);
            opacity: ${opacity};
          ">
            <div style="
              width: 20px; height: 20px;
              background: #a371f7;
              border-radius: 50%;
              border: 3px solid #0d1117;
            "></div>
            <div style="
              position: absolute;
              top: 28px;
              left: 50%;
              transform: translateX(-50%);
              color: #8b949e;
              font-size: 11px;
              white-space: nowrap;
            ">${c.msg}</div>
          </div>
        `;
      }).join('')}
    </div>
  `;
  },
});