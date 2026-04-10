// Changelog Video — Animated release notes
// Reads data from companion changelog.data.ts which parses CHANGELOG.md
import { defineScene } from "superimg";

interface ChangelogEntry {
  version: string;
  date: string;
  items: string[];
}

export default defineScene<{ title: string; entries: ChangelogEntry[] }>({
  data: {
    title: "What's New",
    entries: [
      {
        version: "0.0.1",
        date: "2026-01-01",
        items: ["Initial release"],
      },
    ],
  },

  config: {
    duration: 8,
    fps: 30,
    fonts: ["Inter:wght@400;600;700;800", "JetBrains+Mono:wght@400;700"],
    inlineCss: [
      `
      * { margin: 0; padding: 0; box-sizing: border-box; }
      body {
        background: #0a0a1a;
        font-family: 'Inter', sans-serif;
        overflow: hidden;
      }
    `,
    ],
  },

  render(ctx) {
    const { std, sceneTimeSeconds: time, width, height, data } = ctx;
    const entries = data.entries.slice(0, 5); // Show max 5 releases

    // Phase timing
    // 0–1.0s: Title enters
    // 1.0–6.5s: Entries stagger in
    // 6.5–8.0s: Hold + fade out
    const titleP = std.math.clamp(time / 0.8, 0, 1);
    const exitP = std.math.clamp((time - 7.0) / 1.0, 0, 1);
    const globalFade = 1 - std.tween(0, 1, exitP, "easeInCubic");

    // Title
    const titleOpacity =
      std.tween(0, 1, titleP, "easeOutCubic") * globalFade;
    const titleY = std.tween(30, 0, titleP, "easeOutCubic");

    // Render entries with stagger
    const entryHtml = entries
      .map((entry, i) => {
        const delay = 1.0 + i * 0.8;
        const entryP = std.math.clamp((time - delay) / 0.6, 0, 1);
        const opacity =
          std.tween(0, 1, entryP, "easeOutCubic") * globalFade;
        const x = std.tween(40, 0, entryP, "easeOutCubic");
        const scale = std.tween(0.95, 1, entryP, "easeOutCubic");

        // Version badge color cycles
        const hue = 235 + i * 25;

        const itemsHtml = entry.items
          .map((item, j) => {
            const itemDelay = delay + 0.15 + j * 0.1;
            const itemP = std.math.clamp((time - itemDelay) / 0.4, 0, 1);
            const itemOpacity =
              std.tween(0, 1, itemP, "easeOutCubic") * globalFade;
            const itemX = std.tween(20, 0, itemP, "easeOutCubic");

            return `
            <div style="display: flex; align-items: flex-start; gap: 8px;
              opacity: ${itemOpacity}; transform: translateX(${itemX}px);">
              <div style="width: 5px; height: 5px; border-radius: 50%; margin-top: 7px; flex-shrink: 0;
                background: hsl(${hue}, 70%, 65%);"></div>
              <div style="font-size: 15px; color: rgba(255,255,255,0.7); line-height: 1.5;">
                ${item}
              </div>
            </div>`;
          })
          .join("");

        return `
        <div style="opacity: ${opacity}; transform: translateX(${x}px) scale(${scale});
          background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.06);
          border-radius: 12px; padding: 20px 24px; margin-bottom: 12px;">
          <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 10px;">
            <div style="font-family: 'JetBrains Mono', monospace; font-size: 18px; font-weight: 700;
              background: linear-gradient(135deg, hsl(${hue}, 70%, 55%), hsl(${hue + 30}, 60%, 50%));
              -webkit-background-clip: text; -webkit-text-fill-color: transparent;
              background-clip: text;">
              v${entry.version}
            </div>
            <div style="font-size: 13px; color: rgba(255,255,255,0.3);
              font-family: 'JetBrains Mono', monospace;">
              ${entry.date}
            </div>
          </div>
          <div style="display: flex; flex-direction: column; gap: 4px;">
            ${itemsHtml}
          </div>
        </div>`;
      })
      .join("");

    return `
      <div style="${std.css({ width, height, position: "relative" })};
        display: flex; align-items: center; justify-content: center;">

        <!-- Background grid -->
        <div style="position: absolute; inset: 0;
          background-image:
            linear-gradient(rgba(102, 126, 234, 0.03) 1px, transparent 1px),
            linear-gradient(90deg, rgba(102, 126, 234, 0.03) 1px, transparent 1px);
          background-size: 60px 60px;"></div>

        <!-- Glow -->
        <div style="position: absolute; width: 600px; height: 600px; top: -100px; right: -100px;
          background: radial-gradient(circle, rgba(102, 126, 234, 0.08) 0%, transparent 70%);
          border-radius: 50%;"></div>

        <!-- Content -->
        <div style="position: relative; z-index: 1; width: 700px; max-height: ${height - 120}px;">

          <!-- Title -->
          <div style="opacity: ${titleOpacity}; transform: translateY(${titleY}px);
            margin-bottom: 32px;">
            <div style="font-size: 42px; font-weight: 800; letter-spacing: -1px;
              background: linear-gradient(135deg, #667eea, #a78bfa);
              -webkit-background-clip: text; -webkit-text-fill-color: transparent;
              background-clip: text;">
              ${data.title}
            </div>
            <div style="font-size: 15px; color: rgba(255,255,255,0.3); margin-top: 6px;">
              SuperImg Release Notes
            </div>
          </div>

          <!-- Entries -->
          ${entryHtml}
        </div>
      </div>
    `;
  },
});
