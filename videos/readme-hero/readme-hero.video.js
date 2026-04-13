// README Hero Video — Shows what SuperImg produces
// A slick 6-second demo: logo reveal → code snippet appears → output renders
import { defineScene } from "superimg";

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
    // 0–1.2s: Logo + tagline fade in
    // 1.2–3.0s: Code block types in from left
    // 3.0–4.5s: Arrow + output preview slides in from right
    // 4.5–5.2s: Hold
    // 5.2–6.0s: Fade out

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

    // — Code block —
    const codeOpacity = std.tween(0, 1, codeP, "easeOutCubic") * globalFade;
    const codeX = std.tween(-30 * std.scale, 0, codeP, "easeOutCubic");

    // Code lines with progressive reveal
    const codeLines = [
      { color: "#c792ea", text: "import" },
      { color: "#89ddff", text: " { defineScene }" },
      { color: "#c792ea", text: " from " },
      { color: "#c3e88d", text: "'superimg'" },
    ];
    const line2 = [
      { color: "#82aaff", text: "export default " },
      { color: "#ffcb6b", text: "defineScene" },
      { color: "#89ddff", text: "({" },
    ];
    const line3 = [
      { color: "#89ddff", text: "  render" },
      { color: "#c792ea", text: "(ctx)" },
      { color: "#89ddff", text: " {" },
    ];
    const line4 = [
      { color: "#f78c6c", text: "    return " },
      { color: "#c3e88d", text: "`<h1>Hello</h1>`" },
    ];
    const line5 = [{ color: "#89ddff", text: "  }" }];
    const line6 = [{ color: "#89ddff", text: "})" }];

    const blankLine = [{ color: "transparent", text: " " }];
    const allLines = [codeLines, blankLine, line2, line3, line4, line5, line6];
    const totalChars = allLines.reduce((sum, line) =>
      sum + line.reduce((a, seg) => a + seg.text.length, 0), 0
    );
    const charsToShow = Math.floor(std.tween(0, totalChars, codeP, "easeOutQuad"));

    let charCount = 0;
    const renderedLines = allLines.map((line) => {
      const spans = line.map((seg) => {
        const startChar = charCount;
        charCount += seg.text.length;
        const visible = Math.max(0, Math.min(seg.text.length, charsToShow - startChar));
        if (visible <= 0) return "";
        const visibleText = seg.text.substring(0, visible).replace(/</g, "&lt;").replace(/>/g, "&gt;");
        return `<span style="color: ${seg.color}">${visibleText}</span>`;
      }).join("");
      return spans;
    });

    // — Cursor blink —
    const cursorVisible = Math.floor(time * 2) % 2 === 0 || codeP < 1;
    const cursorChar = cursorVisible && codeP < 1 ? `<span style="color: #ffcb6b; opacity: 0.8">▎</span>` : "";

    // — Arrow —
    const arrowOpacity = std.tween(0, 0.6, arrowP, "easeOutCubic") * globalFade;
    const arrowScale = std.tween(0.5, 1, arrowP, "easeOutBack");

    // — Output preview (the "result" panel) —
    const outOpacity = std.tween(0, 1, outputP, "easeOutCubic") * globalFade;
    const outX = std.tween(30 * std.scale, 0, outputP, "easeOutCubic");
    const outScale = std.tween(0.9, 1, outputP, "easeOutCubic");

    // Animated gradient hue rotation in the output preview
    const hue = std.tween(0, 40, std.math.clamp((time - 3.0) / 3.0, 0, 1), "easeInOutSine");

    // Mini video progress bar in output
    const videoProgress = std.math.clamp((time - 3.5) / 2.0, 0, 0.85);

    return `
      <div style="${std.css({ width, height, position: "relative" }, std.css.center())}; flex-direction: column;">

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
              margin: 0; white-space: pre; height: 11.9em;">${renderedLines.map((l, i) => {
                const isLastVisible = l.length > 0 && (i === renderedLines.length - 1 || renderedLines.slice(i + 1).every(r => r.length === 0));
                return isLastVisible ? l + cursorChar : l;
              }).join("\n")}</pre>
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

              <!-- Play icon overlay (fades out) -->
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
