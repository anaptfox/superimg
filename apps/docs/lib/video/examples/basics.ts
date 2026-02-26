export const HELLO_WORLD = `// Hello World
// A simple animated intro

import { defineTemplate } from "superimg";
export default defineTemplate({
  render(ctx) {
  const { width, height, sceneProgress } = ctx;

  // Fade in the text
  const opacity = Math.min(1, sceneProgress * 3);
  const scale = 0.8 + sceneProgress * 0.2;

  return \`
    <div style="
      width: \${width}px;
      height: \${height}px;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      display: flex;
      align-items: center;
      justify-content: center;
    ">
      <h1 style="
        font-family: system-ui, sans-serif;
        font-size: 80px;
        font-weight: bold;
        color: white;
        opacity: \${opacity};
        transform: scale(\${scale});
        text-shadow: 0 4px 20px rgba(0,0,0,0.3);
      ">Hello, World!</h1>
    </div>
  \`;
  },
});`;

export const ANIMATED_TEXT = `// Animated Text
// Text that types in character by character

import { defineTemplate } from "superimg";
export default defineTemplate({
  render(ctx) {
  const { width, height, sceneProgress, sceneTimeSeconds } = ctx;

  const text = "Building the future...";
  const visibleChars = Math.floor(sceneProgress * text.length * 1.5);
  const displayText = text.slice(0, Math.min(visibleChars, text.length));
  const showCursor = Math.floor(sceneTimeSeconds * 2) % 2 === 0;

  return \`
    <div style="
      width: \${width}px;
      height: \${height}px;
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
        <span>\${displayText}</span>
        <span style="opacity: \${showCursor ? 1 : 0}">|</span>
      </div>
    </div>
  \`;
  },
});`;

export const GRADIENT = `// Gradient Background
// Smoothly shifting gradient animation

import { defineTemplate } from "superimg";
export default defineTemplate({
  render(ctx) {
  const { width, height, sceneProgress } = ctx;

  const hue1 = (sceneProgress * 360) % 360;
  const hue2 = (hue1 + 60) % 360;
  const angle = sceneProgress * 360;

  return \`
    <div style="
      width: \${width}px;
      height: \${height}px;
      background: linear-gradient(
        \${angle}deg,
        hsl(\${hue1}, 80%, 60%),
        hsl(\${hue2}, 70%, 50%)
      );
      display: flex;
      align-items: center;
      justify-content: center;
    ">
      <div style="
        font-family: system-ui, sans-serif;
        font-size: 32px;
        color: white;
        text-shadow: 0 2px 10px rgba(0,0,0,0.3);
        opacity: 0.9;
      ">
        Progress: \${Math.round(sceneProgress * 100)}%
      </div>
    </div>
  \`;
  },
});`;

export const COMPLETE_TEMPLATE = `// Complete Template
// Demonstrates config (width, fps, duration) and defaults (data) together

import { defineTemplate } from "superimg";

export default defineTemplate({
  config: {
    width: 1280,
    height: 720,
    fps: 30,
    durationSeconds: 4,
  },
  defaults: {
    title: "Welcome",
    subtitle: "Customize via data",
    accentColor: "#667eea",
  },
  render(ctx) {
    const { std, sceneTimeSeconds: time, width, height, data } = ctx;
    const { title, subtitle, accentColor } = data;

    const enterProgress = std.math.clamp(time / 1.0, 0, 1);
    const eased = std.easing.easeOutCubic(enterProgress);
    const opacity = std.math.lerp(0, 1, eased);
    const y = std.math.lerp(30, 0, eased);

    return \`
      <div style="
        width: \${width}px;
        height: \${height}px;
        background: linear-gradient(135deg, #0f0f23, #1a1a2e);
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        font-family: system-ui, sans-serif;
      ">
        <h1 style="
          font-size: 64px;
          color: \${accentColor};
          opacity: \${opacity};
          transform: translateY(\${y}px);
          margin: 0;
        ">\${title}</h1>
        <p style="
          font-size: 24px;
          color: white;
          opacity: \${opacity * 0.8};
          transform: translateY(\${y}px);
          margin-top: 16px;
        ">\${subtitle}</p>
      </div>
    \`;
  },
});`;
