export const HELLO_WORLD = `// Hello World
// A simple animated intro

import { define, Html } from "@foxworth/superimg";
export default define({
  render(ctx) {
  const { width, height, timeline } = ctx;

  // Fade in the text
  const opacity = Math.min(1, timeline.progress * 3);
  const scale = 0.8 + timeline.progress * 0.2;

  return Html({ width: "fill", height: "fill", html: \`
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
  \` });
  },
});`;

export const ANIMATED_TEXT = `// Animated Text
// Text that types in character by character.
// Tweaks: Data panel (sample) — text/background/color without recompile.
// Structure: edit source → live recompile.

import { define, Html } from "@foxworth/superimg";
export default define({
  config: { fps: 30, duration: 3 },
  sample: {
    text: "Building the future...",
    background: "#0a0a0a",
    color: "#00ff88",
  },
  render(ctx) {
  const { width, height, timeline, data } = ctx;

  const text = String(data.text ?? "");
  const background = String(data.background ?? "#0a0a0a");
  const color = String(data.color ?? "#00ff88");
  const visibleChars = Math.floor(timeline.progress * text.length * 1.5);
  const displayText = text.slice(0, Math.min(visibleChars, text.length));
  const showCursor = Math.floor(timeline.seconds * 2) % 2 === 0;

  return Html({ width: "fill", height: "fill", html: \`
    <div style="
      width: \${width}px;
      height: \${height}px;
      background: \${background};
      display: flex;
      align-items: center;
      justify-content: center;
    ">
      <div style="
        font-family: 'SF Mono', Monaco, monospace;
        font-size: 48px;
        color: \${color};
      ">
        <span>\${displayText}</span>
        <span style="opacity: \${showCursor ? 1 : 0}">|</span>
      </div>
    </div>
  \` });
  },
});`;

export const GRADIENT = `// Gradient Background
// Smoothly shifting gradient animation

import { define, Html } from "@foxworth/superimg";
export default define({
  render(ctx) {
  const { width, height, timeline } = ctx;

  const hue1 = (timeline.progress * 360) % 360;
  const hue2 = (hue1 + 60) % 360;
  const angle = timeline.progress * 360;

  return Html({ width: "fill", height: "fill", html: \`
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
        Progress: \${Math.round(timeline.progress * 100)}%
      </div>
    </div>
  \` });
  },
});`;

export const COMPLETE_TEMPLATE = `// Complete Template
// Demonstrates config (width, fps, duration) and data together

import { define, Html } from "@foxworth/superimg";

export default define({
  config: {
    width: 1280,
    height: 720,
    fps: 30,
    duration: 4,
  },
  sample: {
    title: "Welcome",
    subtitle: "Customize via data",
    accentColor: "#667eea",
  },
  render(ctx) {
    const { std, timeline, width, height, data } = ctx;
    const { title, subtitle, accentColor } = data;

    const enterProgress = std.math.clamp(time / 1.0, 0, 1);
    const opacity = std.interpolate(enterProgress, [0, 1], [0, 1], "easeOutCubic");
    const y = std.interpolate(enterProgress, [0, 1], [30, 0], "easeOutCubic");

    return Html({ width: "fill", height: "fill", html: \`
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
    \` });
  },
});`;
