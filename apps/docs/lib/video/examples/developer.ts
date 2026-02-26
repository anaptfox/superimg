export const CODE_TYPEWRITER = `// Code Typewriter
// Syntax highlighted code typing animation

import { defineTemplate } from "superimg";

const CODE = \`function fibonacci(n) {
  if (n <= 1) return n;
  return fibonacci(n - 1) + fibonacci(n - 2);
}

console.log(fibonacci(10)); // 55\`;

export default defineTemplate({
  render(ctx) {
  const { width, height, sceneProgress, sceneTimeSeconds } = ctx;

  const visibleChars = Math.floor(CODE.length * sceneProgress * 1.2);
  const displayCode = CODE.slice(0, Math.min(visibleChars, CODE.length));
  const showCursor = Math.floor(sceneTimeSeconds * 3) % 2 === 0;

  // Simple syntax highlighting
  const highlighted = displayCode
    .replace(/(function|return|if|const|let|var)/g, '<span style="color: #c678dd;">$1</span>')
    .replace(/(fibonacci|console|log)/g, '<span style="color: #61afef;">$1</span>')
    .replace(/(\\d+)/g, '<span style="color: #d19a66;">$1</span>')
    .replace(/(\\/\\/.*)/g, '<span style="color: #5c6370;">$1</span>');

  return \`
    <div style="
      width: \${width}px;
      height: \${height}px;
      background: #282c34;
      font-family: 'SF Mono', Monaco, 'Courier New', monospace;
      padding: 40px;
      box-sizing: border-box;
    ">
      <div style="
        background: #21252b;
        border-radius: 8px;
        padding: 24px;
        height: 100%;
        box-sizing: border-box;
      ">
        <div style="display: flex; gap: 8px; margin-bottom: 20px;">
          <div style="width: 12px; height: 12px; border-radius: 50%; background: #ff5f56;"></div>
          <div style="width: 12px; height: 12px; border-radius: 50%; background: #ffbd2e;"></div>
          <div style="width: 12px; height: 12px; border-radius: 50%; background: #27ca40;"></div>
        </div>
        <pre style="
          color: #abb2bf;
          font-size: 20px;
          line-height: 1.6;
          margin: 0;
          white-space: pre-wrap;
        ">\${highlighted}<span style="opacity: \${showCursor ? 1 : 0}; color: #528bff;">|</span></pre>
      </div>
    </div>
  \`;
  },
});`;

export const GIT_DIFF = `// Git Diff
// Side-by-side diff animation

import { defineTemplate } from "superimg";

const REMOVED = [
  "  const result = [];",
  "  for (let i = 0; i < arr.length; i++) {",
  "    result.push(arr[i] * 2);",
  "  }",
  "  return result;",
];

const ADDED = [
  "  return arr.map(x => x * 2);",
];

export default defineTemplate({
  render(ctx) {
  const { width, height, sceneProgress } = ctx;

  const removedOpacity = Math.max(0, 1 - sceneProgress * 3);
  const addedOpacity = Math.min(1, (sceneProgress - 0.3) * 2);

  return \`
    <div style="
      width: \${width}px;
      height: \${height}px;
      background: #0d1117;
      font-family: 'SF Mono', Monaco, monospace;
      padding: 40px;
      box-sizing: border-box;
    ">
      <div style="color: #8b949e; font-size: 16px; margin-bottom: 20px;">
        utils/transform.js
      </div>
      <div style="background: #161b22; border-radius: 8px; padding: 20px; overflow: hidden;">
        <div style="color: #c9d1d9; font-size: 16px; margin-bottom: 12px;">
          function double(arr) {
        </div>
        \${REMOVED.map(line => \`
          <div style="
            background: rgba(248, 81, 73, 0.15);
            color: #f85149;
            padding: 4px 12px;
            margin: 2px 0;
            opacity: \${removedOpacity};
            font-size: 16px;
          ">- \${line}</div>
        \`).join('')}
        \${ADDED.map(line => \`
          <div style="
            background: rgba(63, 185, 80, 0.15);
            color: #3fb950;
            padding: 4px 12px;
            margin: 2px 0;
            opacity: \${addedOpacity};
            font-size: 16px;
          ">+ \${line}</div>
        \`).join('')}
        <div style="color: #c9d1d9; font-size: 16px; margin-top: 12px;">
          }
        </div>
      </div>
    </div>
  \`;
  },
});`;

export const TERMINAL = `// Terminal Session
// CLI demo with command output

import { defineTemplate } from "superimg";

const COMMANDS = [
  { cmd: "npm create superimg@latest", delay: 0 },
  { output: "Creating new SuperImg project...", delay: 0.2 },
  { output: "✓ Project created", delay: 0.4 },
  { cmd: "cd my-video && npm run dev", delay: 0.5 },
  { output: "Server running at http://localhost:3000", delay: 0.7 },
];

export default defineTemplate({
  render(ctx) {
  const { width, height, sceneProgress, sceneTimeSeconds } = ctx;

  const showCursor = Math.floor(sceneTimeSeconds * 3) % 2 === 0;

  return \`
    <div style="
      width: \${width}px;
      height: \${height}px;
      background: #1a1b26;
      font-family: 'SF Mono', Monaco, monospace;
      padding: 40px;
      box-sizing: border-box;
    ">
      <div style="
        background: #0f0f14;
        border-radius: 12px;
        height: 100%;
        padding: 20px;
        box-sizing: border-box;
      ">
        <div style="display: flex; gap: 8px; margin-bottom: 20px;">
          <div style="width: 12px; height: 12px; border-radius: 50%; background: #ff5f56;"></div>
          <div style="width: 12px; height: 12px; border-radius: 50%; background: #ffbd2e;"></div>
          <div style="width: 12px; height: 12px; border-radius: 50%; background: #27ca40;"></div>
          <span style="color: #565f89; margin-left: 12px; font-size: 14px;">~/projects</span>
        </div>
        \${COMMANDS.map((item, i) => {
          const visible = sceneProgress > item.delay;
          if (!visible) return '';
          if (item.cmd) {
            const typed = item.cmd.slice(0, Math.floor((sceneProgress - item.delay) * item.cmd.length * 5));
            return \`
              <div style="color: #7aa2f7; font-size: 18px; margin: 8px 0;">
                <span style="color: #9ece6a;">❯</span> \${typed}
              </div>
            \`;
          }
          return \`
            <div style="color: #a9b1d6; font-size: 16px; margin: 4px 0; opacity: 0.8;">
              \${item.output}
            </div>
          \`;
        }).join('')}
        <div style="color: #7aa2f7; font-size: 18px; margin-top: 8px;">
          <span style="color: #9ece6a;">❯</span>
          <span style="opacity: \${showCursor ? 1 : 0}; color: #7aa2f7;">▋</span>
        </div>
      </div>
    </div>
  \`;
  },
});`;

export const GIT_BRANCH = `// Git Branch Animation
// Visualizing git workflow with branches

import { defineTemplate } from "superimg";

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

export default defineTemplate({
  render(ctx) {
    const { width, height, sceneProgress } = ctx;

    const padding = 50;
    const mainY = height * 0.35;
    const featureY = height * 0.6;
    const commitSpacing = (width - padding * 2) / 5;

    // Animation phases
    const mainProgress = Math.min(1, sceneProgress * 2);
    const branchProgress = Math.max(0, Math.min(1, (sceneProgress - 0.3) * 2.5));
    const mergeProgress = Math.max(0, Math.min(1, (sceneProgress - 0.7) * 3));

    return \`
    <div style="
      width: \${width}px;
      height: \${height}px;
      background: #0d1117;
      font-family: 'SF Mono', Monaco, monospace;
      position: relative;
      overflow: hidden;
    ">
      <!-- Branch labels -->
      <div style="position: absolute; left: 20px; top: \${mainY - 8}px; color: #3fb950; font-size: 14px; font-weight: 600;">main</div>
      <div style="position: absolute; left: 20px; top: \${featureY - 8}px; color: #a371f7; font-size: 14px; font-weight: 600; opacity: \${branchProgress};">feature</div>

      <!-- Main branch line -->
      <svg width="\${width}" height="\${height}" style="position: absolute; top: 0; left: 0;">
        <!-- Main branch -->
        <line
          x1="\${padding}" y1="\${mainY}"
          x2="\${padding + commitSpacing * 4 * mainProgress}" y2="\${mainY}"
          stroke="#3fb950" stroke-width="3" stroke-linecap="round"
        />

        <!-- Feature branch fork -->
        <path
          d="M \${padding + commitSpacing} \${mainY} Q \${padding + commitSpacing + 30} \${(mainY + featureY) / 2} \${padding + commitSpacing + 50} \${featureY}"
          stroke="#a371f7" stroke-width="3" fill="none" stroke-linecap="round"
          stroke-dasharray="\${100 * branchProgress} 100"
        />

        <!-- Feature branch line -->
        <line
          x1="\${padding + commitSpacing + 50}" y1="\${featureY}"
          x2="\${padding + commitSpacing + 50 + commitSpacing * 2 * branchProgress}" y2="\${featureY}"
          stroke="#a371f7" stroke-width="3" stroke-linecap="round"
        />

        <!-- Merge line -->
        <path
          d="M \${padding + commitSpacing * 3 + 50} \${featureY} Q \${padding + commitSpacing * 3 + 80} \${(mainY + featureY) / 2} \${padding + commitSpacing * 3} \${mainY}"
          stroke="#a371f7" stroke-width="3" fill="none" stroke-linecap="round"
          stroke-dasharray="\${100 * mergeProgress} 100"
        />
      </svg>

      <!-- Main commits -->
      \${COMMITS.main.map((c, i) => {
        const x = padding + i * commitSpacing + (i > 1 ? 0 : 0);
        const showAt = i / COMMITS.main.length;
        const opacity = mainProgress > showAt ? 1 : 0;
        return \`
          <div style="
            position: absolute;
            left: \${x}px;
            top: \${mainY}px;
            transform: translate(-50%, -50%);
            opacity: \${opacity};
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
            ">\${c.msg}</div>
          </div>
        \`;
      }).join('')}

      <!-- Feature commits -->
      \${COMMITS.feature.map((c, i) => {
        const x = padding + commitSpacing + 50 + i * commitSpacing;
        const opacity = branchProgress > (i + 1) / COMMITS.feature.length ? 1 : 0;
        return \`
          <div style="
            position: absolute;
            left: \${x}px;
            top: \${featureY}px;
            transform: translate(-50%, -50%);
            opacity: \${opacity};
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
            ">\${c.msg}</div>
          </div>
        \`;
      }).join('')}
    </div>
  \`;
  },
});`;

export const GITHUB_README = `// GitHub README Animation
// Animated stats badge for your README.md

import { defineTemplate } from "superimg";

const STATS = {
  repo: "superimg/superimg",
  stars: 2847,
  forks: 156,
  contributors: 42,
  version: "v2.1.0",
};

export default defineTemplate({
  render(ctx) {
  const { width, height, sceneProgress } = ctx;

  // Animate counters
  const eased = 1 - Math.pow(1 - Math.min(1, sceneProgress * 1.5), 3);
  const stars = Math.floor(STATS.stars * eased);
  const forks = Math.floor(STATS.forks * eased);
  const contributors = Math.floor(STATS.contributors * eased);

  // Badge animations
  const badge1 = Math.min(1, sceneProgress * 4);
  const badge2 = Math.min(1, Math.max(0, (sceneProgress - 0.1) * 4));
  const badge3 = Math.min(1, Math.max(0, (sceneProgress - 0.2) * 4));
  const badge4 = Math.min(1, Math.max(0, (sceneProgress - 0.3) * 4));

  return \`
    <div style="
      width: \${width}px;
      height: \${height}px;
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
        opacity: \${Math.min(1, sceneProgress * 3)};
      ">
        <svg width="32" height="32" viewBox="0 0 16 16" fill="#fff">
          <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"/>
        </svg>
        <span style="color: white; font-size: 24px; font-weight: 600;">\${STATS.repo}</span>
      </div>

      <!-- Badges row -->
      <div style="display: flex; gap: 16px; flex-wrap: wrap; justify-content: center;">
        <!-- Stars badge -->
        <div style="
          display: flex;
          border-radius: 6px;
          overflow: hidden;
          opacity: \${badge1};
          transform: translateY(\${(1 - badge1) * 10}px);
        ">
          <div style="background: #21262d; color: #c9d1d9; padding: 8px 12px; font-size: 14px;">⭐ Stars</div>
          <div style="background: #238636; color: white; padding: 8px 12px; font-size: 14px; font-weight: 600;">\${stars.toLocaleString()}</div>
        </div>

        <!-- Forks badge -->
        <div style="
          display: flex;
          border-radius: 6px;
          overflow: hidden;
          opacity: \${badge2};
          transform: translateY(\${(1 - badge2) * 10}px);
        ">
          <div style="background: #21262d; color: #c9d1d9; padding: 8px 12px; font-size: 14px;">🍴 Forks</div>
          <div style="background: #1f6feb; color: white; padding: 8px 12px; font-size: 14px; font-weight: 600;">\${forks}</div>
        </div>

        <!-- Contributors badge -->
        <div style="
          display: flex;
          border-radius: 6px;
          overflow: hidden;
          opacity: \${badge3};
          transform: translateY(\${(1 - badge3) * 10}px);
        ">
          <div style="background: #21262d; color: #c9d1d9; padding: 8px 12px; font-size: 14px;">👥 Contributors</div>
          <div style="background: #8957e5; color: white; padding: 8px 12px; font-size: 14px; font-weight: 600;">\${contributors}</div>
        </div>

        <!-- Version badge -->
        <div style="
          display: flex;
          border-radius: 6px;
          overflow: hidden;
          opacity: \${badge4};
          transform: translateY(\${(1 - badge4) * 10}px);
        ">
          <div style="background: #21262d; color: #c9d1d9; padding: 8px 12px; font-size: 14px;">📦 Version</div>
          <div style="background: #f0883e; color: white; padding: 8px 12px; font-size: 14px; font-weight: 600;">\${STATS.version}</div>
        </div>
      </div>

      <!-- Activity graph hint -->
      <div style="
        margin-top: 40px;
        color: #484f58;
        font-size: 12px;
        opacity: \${Math.max(0, (sceneProgress - 0.5) * 2)};
      ">Perfect for your GitHub README.md</div>
    </div>
  \`;
  },
});`;

export const CHANGELOG = `// Changelog / Release Notes
// Animated release notes from version data

import { defineTemplate } from "superimg";

const RELEASES = [
  {
    version: "v2.1.0",
    date: "2025-01-15",
    type: "feature",
    changes: [
      "✨ Added real-time preview",
      "🚀 50% faster rendering",
      "🎨 New animation presets",
    ],
  },
  {
    version: "v2.0.1",
    date: "2025-01-10",
    type: "fix",
    changes: [
      "🐛 Fixed memory leak",
      "📝 Updated docs",
    ],
  },
  {
    version: "v2.0.0",
    date: "2025-01-01",
    type: "major",
    changes: [
      "💥 Breaking: New API",
      "⚡ Complete rewrite",
      "🔧 Better TypeScript",
    ],
  },
];

const typeColors = {
  feature: "#238636",
  fix: "#f0883e",
  major: "#8957e5",
};

export default defineTemplate({
  render(ctx) {
  const { width, height, sceneProgress } = ctx;

  return \`
    <div style="
      width: \${width}px;
      height: \${height}px;
      background: linear-gradient(180deg, #0d1117 0%, #161b22 100%);
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      padding: 40px;
      box-sizing: border-box;
      overflow: hidden;
    ">
      <!-- Header -->
      <div style="
        display: flex;
        align-items: center;
        gap: 12px;
        margin-bottom: 32px;
        opacity: \${Math.min(1, sceneProgress * 3)};
      ">
        <span style="font-size: 28px;">📋</span>
        <span style="color: white; font-size: 28px; font-weight: 600;">Changelog</span>
      </div>

      <!-- Releases -->
      <div style="display: flex; flex-direction: column; gap: 24px;">
        \${RELEASES.map((release, i) => {
          const delay = i * 0.2;
          const opacity = Math.min(1, Math.max(0, (sceneProgress - delay) * 2.5));
          const translateX = (1 - opacity) * 30;

          return \`
            <div style="
              background: rgba(255,255,255,0.03);
              border-radius: 12px;
              padding: 20px;
              border-left: 3px solid \${typeColors[release.type]};
              opacity: \${opacity};
              transform: translateX(\${translateX}px);
            ">
              <!-- Version header -->
              <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 12px;">
                <span style="
                  color: white;
                  font-size: 20px;
                  font-weight: 600;
                  font-family: 'SF Mono', Monaco, monospace;
                ">\${release.version}</span>
                <span style="
                  background: \${typeColors[release.type]};
                  color: white;
                  padding: 2px 8px;
                  border-radius: 12px;
                  font-size: 12px;
                  text-transform: uppercase;
                ">\${release.type}</span>
                <span style="color: #484f58; font-size: 14px; margin-left: auto;">\${release.date}</span>
              </div>

              <!-- Changes list -->
              <div style="display: flex; flex-direction: column; gap: 6px;">
                \${release.changes.map((change, j) => {
                  const changeOpacity = Math.min(1, Math.max(0, (sceneProgress - delay - 0.1 - j * 0.05) * 4));
                  return \`
                    <div style="
                      color: #c9d1d9;
                      font-size: 14px;
                      opacity: \${changeOpacity};
                    ">\${change}</div>
                  \`;
                }).join('')}
              </div>
            </div>
          \`;
        }).join('')}
      </div>
    </div>
  \`;
  },
});`;
