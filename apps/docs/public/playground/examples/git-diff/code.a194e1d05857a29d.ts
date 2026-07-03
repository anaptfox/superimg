// Git Diff
// Side-by-side diff animation

import { define } from "superimg";

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

export default define({
  render(ctx) {
  const { width, height, timeline } = ctx;

  const removedOpacity = Math.max(0, 1 - timeline.progress * 3);
  const addedOpacity = Math.min(1, (timeline.progress - 0.3) * 2);

  return `
    <div style="
      width: ${width}px;
      height: ${height}px;
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
        ${REMOVED.map(line => `
          <div style="
            background: rgba(248, 81, 73, 0.15);
            color: #f85149;
            padding: 4px 12px;
            margin: 2px 0;
            opacity: ${removedOpacity};
            font-size: 16px;
          ">- ${line}</div>
        `).join('')}
        ${ADDED.map(line => `
          <div style="
            background: rgba(63, 185, 80, 0.15);
            color: #3fb950;
            padding: 4px 12px;
            margin: 2px 0;
            opacity: ${addedOpacity};
            font-size: 16px;
          ">+ ${line}</div>
        `).join('')}
        <div style="color: #c9d1d9; font-size: 16px; margin-top: 12px;">
          }
        </div>
      </div>
    </div>
  `;
  },
});