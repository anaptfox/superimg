// Server-side Template Example (TypeScript)
// Demonstrates using stdlib functions in TypeScript templates compiled server-side

import type { RenderContext } from "superimg";

export const config = {
  fps: 30,
  durationSeconds: 5,
  width: 1920,
  height: 1080,
} as const;

export function render(ctx: RenderContext): string {
  const { std, sceneFrame: frame, sceneTimeSeconds: time, sceneProgress: progress, totalFrames, width, height } = ctx;

  // Use stdlib easing for smooth animation
  const easedProgress = std.easing.easeOutCubic(progress);

  // Animate rotation using eased progress
  const rotation = easedProgress * 360;

  // Color that shifts over time
  const hue = std.math.lerp(0, 360, easedProgress);

  // Create gradient colors
  const color1 = std.color.hsl(hue, 100, 50);
  const color2 = std.color.hsl((hue + 60) % 360, 100, 50);

  return `
    <style>
      * { margin: 0; padding: 0; box-sizing: border-box; }
      body {
        width: 100vw;
        height: 100vh;
        display: flex;
        align-items: center;
        justify-content: center;
        background: linear-gradient(135deg, ${color1} 0%, ${color2} 100%);
        font-family: 'IBM Plex Sans', sans-serif;
        overflow: hidden;
      }
      .container {
        text-align: center;
        color: white;
      }
      .logo {
        font-size: 120px;
        font-weight: 700;
        margin-bottom: 24px;
        text-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
        transform: rotate(${rotation}deg);
        display: inline-block;
      }
      .title {
        font-size: 48px;
        font-weight: 600;
        margin-bottom: 16px;
        opacity: ${0.7 + easedProgress * 0.3};
      }
      .subtitle {
        font-size: 24px;
        opacity: 0.8;
        margin-bottom: 32px;
      }
      .info {
        font-size: 18px;
        opacity: 0.7;
        font-variant-numeric: tabular-nums;
      }
    </style>
    <div class="container">
      <div class="logo">⚡</div>
      <h1 class="title">TypeScript Template</h1>
      <p class="subtitle">Full type safety in templates</p>
      <div class="info">
        Frame ${frame} / ${totalFrames} · ${time.toFixed(2)}s
      </div>
    </div>
  `;
}
