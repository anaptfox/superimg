// Animated Text
// Text that types in character by character

import { define } from "superimg";
export default define({
  render(ctx) {
  const { width, height, timeline } = ctx;

  const text = "Building the future...";
  const visibleChars = Math.floor(timeline.progress * text.length * 1.5);
  const displayText = text.slice(0, Math.min(visibleChars, text.length));
  const showCursor = Math.floor(timeline.seconds * 2) % 2 === 0;

  return `
    <div style="
      width: ${width}px;
      height: ${height}px;
      background: #0a0a0a;
      display: flex;
      align-items: center;
      justify-content: center;
    ">
      <div style="
        font-family: 'SF Mono', Monaco, monospace;
        font-size: 48px;
        color: #00ff88;
      ">
        <span>${displayText}</span>
        <span style="opacity: ${showCursor ? 1 : 0}">|</span>
      </div>
    </div>
  `;
  },
});