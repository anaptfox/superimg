// Code Typewriter
// Syntax highlighted code typing animation

import { define } from "superimg";

const CODE = `function fibonacci(n) {
  if (n <= 1) return n;
  return fibonacci(n - 1) + fibonacci(n - 2);
}

console.log(fibonacci(10)); // 55`;

export default define({
  render(ctx) {
  const { std, width, height, timeline } = ctx;

  const dur = std.text.typeDuration(CODE, { speed: 40 });
  const progress = std.math.clamp(timeline.seconds / dur, 0, 1);
  const { visible, typing } = std.text.type(CODE, progress);
  const showCursor = std.text.cursor(timeline.seconds);

  const highlighted = std.code.highlight(visible, { lang: 'javascript' });

  return `
    <div style="
      width: ${width}px;
      height: ${height}px;
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
        <div style="font-size: 20px; line-height: 1.6;">
          ${highlighted}<span style="opacity: ${typing && showCursor ? 1 : 0}; color: #528bff;">|</span>
        </div>
      </div>
    </div>
  `;
  },
});