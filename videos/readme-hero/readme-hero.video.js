// README Hero Video — Shows what SuperImg produces
// A slick 6-second demo: logo reveal → code snippet appears → output renders
import { defineScene } from "superimg";

const CODE = `import { defineScene } from 'superimg'

export default defineScene({
  render(ctx) {
    return \`<h1>Hello</h1>\`
  }
})`;

export default defineScene({
  data: {
    tagline: "TypeScript in, MP4 out.",
  },

  config: {
    duration: 6,
    fps: 30,
    width: 960,
    height: 540,
    fonts: ["JetBrains+Mono:wght@400;700", "Inter:wght@400;600;800"],
    inlineCss: [`
      * { margin: 0; padding: 0; box-sizing: border-box; }
      body {
        background: #0a0a1a;
        font-family: 'Inter', sans-serif;
        overflow: hidden;
      }
    `],
  },

  render(ctx) {
    const { std, sceneTimeSeconds: time, width, height, data } = ctx;

    // — Phase timing —
    const enterP = std.math.clamp(time / 1.0, 0, 1);
    const taglineP = std.math.clamp((time - 0.4) / 0.8, 0, 1);
    const codeP = std.math.clamp((time - 1.2) / 1.2, 0, 1);
    const arrowP = std.math.clamp((time - 2.8) / 0.6, 0, 1);
    const outputP = std.math.clamp((time - 3.0) / 0.8, 0, 1);
    const exitP = std.math.clamp((time - 5.2) / 0.8, 0, 1);
    const globalFade = 1 - std.tween(0, 1, exitP, "easeInCubic");

    // — Logo —
    const logoOpacity = std.tween(0, 1, enterP, "easeOutCubic") * globalFade;
    const logoY = std.tween(15 * std.scale, 0, enterP, "easeOutCubic");
    const logoScale = std.tween(0.95, 1, enterP, "easeOutCubic");

    // — Tagline —
    const tagOpacity = std.tween(0, 0.7, taglineP, "easeOutCubic") * globalFade;
    const tagY = std.tween(12 * std.scale, 0, taglineP, "easeOutCubic");

    // — Content shift: starts vertically centered, moves up as code appears —
    const shiftP = std.math.clamp((time - 0.8) / 0.8, 0, 1);
    const contentShift = std.tween((height / 2 - 55 * std.scale) - 70 * std.scale, 0, shiftP, "easeInOutCubic");

    // — Code typing with natural rhythm —
    const codeOpacity = std.tween(0, 1, codeP, "easeOutCubic") * globalFade;
    const codeX = std.tween(-30 * std.scale, 0, codeP, "easeOutCubic");

    const { visible, cursorVisible } = std.text.type(CODE, codeP, {
      variance: 0.6,
      time,
    });

    const cursorHtml = cursorVisible
      ? `<span style="color: #ffcb6b; opacity: 0.8">▎</span>`
      : "";

    // Pad visible code to full line count so panel height stays fixed
    const fullLineCount = CODE.split("\n").length;
    const visibleLines = visible.split("\n");
    while (visibleLines.length < fullLineCount) visibleLines.push("");
    const paddedVisible = visibleLines.join("\n");

    // Syntax highlight the visible code, then strip Shiki's <pre><code> wrapper
    const highlightedFull = std.code.highlight(paddedVisible, { lang: "javascript" });
    const highlightedCode = highlightedFull
      .replace(/^<pre[^>]*><code[^>]*>/, "")
      .replace(/<\/code><\/pre>$/, "");

    // — Arrow —
    const arrowOpacity = std.tween(0, 0.6, arrowP, "easeOutCubic") * globalFade;
    const arrowScale = std.tween(0.5, 1, arrowP, "easeOutBack");

    // — Output preview —
    const outOpacity = std.tween(0, 1, outputP, "easeOutCubic") * globalFade;
    const outX = std.tween(30 * std.scale, 0, outputP, "easeOutCubic");
    const outScale = std.tween(0.9, 1, outputP, "easeOutCubic");

    const hue = std.tween(0, 40, std.math.clamp((time - 3.0) / 3.0, 0, 1), "easeInOutSine");
    const videoProgress = std.math.clamp((time - 3.5) / 2.0, 0, 0.85);

    return `
      <div style="${std.css({ width, height, position: "relative" })}; display: flex; flex-direction: column; align-items: center; padding-top: ${std.px(70)}; transform: translateY(${contentShift}px);">

        <!-- Subtle grid background -->
        <div style="position: absolute; inset: 0;
          background-image:
            linear-gradient(rgba(102, 126, 234, 0.03) 1px, transparent 1px),
            linear-gradient(90deg, rgba(102, 126, 234, 0.03) 1px, transparent 1px);
          background-size: ${std.px(40)} ${std.px(40)};
        "></div>

        <!-- Glow orbs -->
        <div style="position: absolute; width: 400px; height: 400px; top: -150px; left: -80px;
          background: radial-gradient(circle, rgba(102, 126, 234, 0.08) 0%, transparent 70%);
          border-radius: 50%;
        "></div>
        <div style="position: absolute; width: 350px; height: 350px; bottom: -150px; right: -80px;
          background: radial-gradient(circle, rgba(118, 75, 162, 0.06) 0%, transparent 70%);
          border-radius: 50%;
        "></div>

        <!-- Logo + Tagline -->
        <div style="position: relative; z-index: 1; text-align: center; margin-bottom: ${std.px(40)};
          opacity: ${logoOpacity}; transform: translateY(${logoY}px) scale(${logoScale});">
          <div style="font-size: ${std.px(48)}; font-weight: 800; letter-spacing: ${std.px(-1.5)};
            background: linear-gradient(135deg, #667eea, #a78bfa, #764ba2);
            -webkit-background-clip: text; -webkit-text-fill-color: transparent;
            background-clip: text;
          ">SuperImg</div>
          <div style="font-size: ${std.px(18)}; font-weight: 400; color: rgba(255,255,255,0.5);
            margin-top: ${std.px(8)}; letter-spacing: ${std.px(1)};
            opacity: ${tagOpacity}; transform: translateY(${tagY}px);">
            ${data.tagline}
          </div>
        </div>

        <!-- Code → Output Row -->
        <div style="position: relative; z-index: 1; display: flex; align-items: center; gap: ${std.px(35)};">

          <!-- Code Panel -->
          <div style="opacity: ${codeOpacity}; transform: translateX(${codeX}px);
            background: rgba(15, 15, 35, 0.9); border: 1px solid rgba(102, 126, 234, 0.15);
            border-radius: ${std.px(8)}; padding: ${std.px(18)} ${std.px(21)}; min-width: ${std.px(390)};
            box-shadow: 0 4px 24px rgba(0, 0, 0, 0.3), inset 0 1px 0 rgba(255,255,255,0.03);">

            <!-- Window dots -->
            <div style="display: flex; gap: ${std.px(5)}; margin-bottom: ${std.px(12)};">
              <div style="width: ${std.px(7)}; height: ${std.px(7)}; border-radius: 50%; background: #ff5f57;"></div>
              <div style="width: ${std.px(7)}; height: ${std.px(7)}; border-radius: 50%; background: #febc2e;"></div>
              <div style="width: ${std.px(7)}; height: ${std.px(7)}; border-radius: 50%; background: #28c840;"></div>
              <div style="font-size: ${std.px(8)}; color: rgba(255,255,255,0.25); margin-left: ${std.px(9)};
                font-family: 'Inter', sans-serif;">template.ts</div>
            </div>

            <!-- Code content -->
            <pre style="font-family: 'JetBrains Mono', monospace; font-size: ${std.px(12)}; line-height: 1.7;
              margin: 0; white-space: pre; color: #d4d4d4;">${highlightedCode}${cursorHtml}</pre>
          </div>

          <!-- Arrow -->
          <div style="opacity: ${arrowOpacity}; transform: scale(${arrowScale});
            font-size: ${std.px(28)}; color: rgba(102, 126, 234, 0.8); display: flex; flex-direction: column;
            align-items: center; gap: ${std.px(5)};">
            <div>→</div>
            <div style="font-size: ${std.px(8)}; font-weight: 600; letter-spacing: 2px; color: rgba(102, 126, 234, 0.4);
              text-transform: uppercase;">MP4</div>
          </div>

          <!-- Output Preview -->
          <div style="opacity: ${outOpacity}; transform: translateX(${outX}px) scale(${outScale});
            border-radius: ${std.px(8)}; overflow: hidden; width: ${std.px(290)}; height: ${std.px(170)};
            border: 1px solid rgba(102, 126, 234, 0.15);
            box-shadow: 0 4px 24px rgba(0, 0, 0, 0.3);">

            <!-- Mini video preview -->
            <div style="width: 100%; height: 100%; position: relative;
              background: linear-gradient(135deg, hsl(${235 + hue}, 70%, 45%), hsl(${270 + hue}, 55%, 40%));
              display: flex; align-items: center; justify-content: center;">

              <div style="font-size: ${std.px(30)}; font-weight: 700; color: white; text-align: center;
                text-shadow: 0 2px 12px rgba(0,0,0,0.3);">Hello</div>

              <!-- Video progress bar -->
              <div style="position: absolute; bottom: 0; left: 0; width: 100%; height: ${std.px(3)};
                background: rgba(0,0,0,0.3);">
                <div style="width: ${videoProgress * 100}%; height: 100%;
                  background: linear-gradient(90deg, #667eea, #a78bfa);
                  transition: none;"></div>
              </div>

              <!-- Play icon overlay -->
              <div style="position: absolute; top: ${std.px(5)}; right: ${std.px(6)}; font-size: ${std.px(8)};
                color: rgba(255,255,255,0.4); font-family: 'JetBrains Mono', monospace;">
                video.mp4</div>
            </div>
          </div>

        </div>
      </div>
    `;
  },
});
