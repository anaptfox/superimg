import { defineScene } from "superimg";

const HTML_CODE = `<div class="w-full flex center">
  <h1 class="text-white font-bold text-6xl">
    No timeline. Just code.
  </h1>
</div>`;

export default defineScene({
  config: {
    duration: 16,
    fps: 60,
    tailwind: true,
    fonts: ["Inter:wght@400;600;800", "Fira+Code:wght@400;500"],
    inlineCss: [
      `
      * { margin: 0; padding: 0; box-sizing: border-box; }
      body { background: #000; font-family: 'Inter', sans-serif; overflow: hidden; }
      .code-theme pre {
        margin: 0; padding: 24px; border-radius: 12px;
        font-family: 'Fira Code', monospace; font-size: 24px; line-height: 1.5;
        background: rgba(40, 42, 54, 0.8) !important;
        box-shadow: 0 20px 40px rgba(0,0,0,0.5);
        border: 1px solid rgba(255,255,255,0.1);
      }
      .shimmer {
        background: linear-gradient(90deg, rgba(255,255,255,0) 0%, rgba(255,255,255,0.4) 50%, rgba(255,255,255,0) 100%);
        background-size: 200% auto;
        -webkit-background-clip: text;
        -webkit-text-fill-color: transparent;
      }
      `
    ],
  },
  render(ctx) {
    const { std, sceneTimeSeconds: time, sceneDurationSeconds: duration, width, height } = ctx;

    // Timeline: act1 (4.5s) → act2 (5.5s) → act3 (6s) = 16s total
    const tl = std.timeline(time, duration);
    const act1 = tl.at("act1", 0, 4.5);
    const act2 = tl.at("act2", 4.5, 5.5);
    const act3 = tl.at("act3", 10, 6);

    function renderAct1(p) {
      // "Video as code > timelines"
      const text1In = std.tween(0, 1, std.math.clamp(p * 5, 0, 1), "easeOutCubic");
      const text1Y = std.tween(40, 0, std.math.clamp(p * 5, 0, 1), "easeOutCubic");
      // "Repeatable. Data-driven. Programmable."
      const text2In = std.tween(0, 1, std.math.clamp((p - 0.3)*5, 0, 1), "easeOutCubic");

      // fade out the whole act at the end
      const exit = std.tween(1, 0, std.math.clamp((p - 0.85)*8, 0, 1), "easeInCubic");

      return `
        <div class="absolute inset-0 flex flex-col items-center justify-center p-20 bg-gradient-to-br from-neutral-900 to-black text-center" style="opacity: ${exit}">
          <h1 class="text-7xl font-bold text-white tracking-tight leading-tight" style="opacity: ${text1In}; transform: translateY(${text1Y}px)">
            Video as code > timelines
          </h1>
          <h2 class="text-4xl text-neutral-400 mt-8 font-semibold tracking-wide" style="opacity: ${text2In}">
            Repeatable • Data-driven • Programmable
          </h2>
        </div>
      `;
    }

    function renderAct2(p) {
      // "But every tool makes you learn a new API."
      const t1 = std.tween(0, 1, std.math.clamp(p * 8, 0, 1), "easeOutCubic");
      // "...SuperImg doesn't."
      const t2 = std.tween(0, 1, std.math.clamp((p - 0.2)*8, 0, 1), "easeOutBack");
      const scale2 = std.tween(0.9, 1, std.math.clamp((p - 0.2)*8, 0, 1), "easeOutBack");
      // "It's just HTML."
      const t3 = std.tween(0, 1, std.math.clamp((p - 0.4)*8, 0, 1), "easeOutCubic");
      const y3 = std.tween(20, 0, std.math.clamp((p - 0.4)*8, 0, 1), "easeOutCubic");

      const exit = std.tween(1, 0, std.math.clamp((p - 0.9)*10, 0, 1), "easeInCubic");

      const codeHtml = std.code.highlight(HTML_CODE, { lang: "html", theme: "dracula" });

      return `
        <div class="absolute inset-0 flex flex-col items-center justify-center p-20 bg-gradient-to-br from-indigo-950 via-purple-900 to-black" style="opacity: ${exit}">
          <h2 class="text-4xl text-indigo-300 font-medium mb-10" style="opacity: ${t1}">
            Every tool invents a new API.
          </h2>
          <h1 class="text-8xl font-extrabold text-white tracking-tighter mb-16" style="opacity: ${t2}; transform: scale(${scale2})">
            SuperImg doesn't.
          </h1>

          <div class="w-full max-w-4xl flex flex-col items-center" style="opacity: ${t3}; transform: translateY(${y3}px)">
            <div class="px-6 py-2 bg-purple-500/20 rounded-full border border-purple-500/30 text-purple-200 text-xl font-bold uppercase tracking-widest mb-6">
              It's just HTML & CSS
            </div>
            <div class="code-theme w-full text-left">
              ${codeHtml}
            </div>
          </div>
        </div>
      `;
    }

    function renderAct3(p) {
      // "And because it's HTML..."
      const t1 = std.tween(0, 1, std.math.clamp(p * 8, 0, 1), "easeOutCubic");
      // "AI can write it too."
      const t2 = std.tween(0, 1, std.math.clamp((p - 0.15)*8, 0, 1), "easeOutCubic");
      const glowText = std.tween(1, 1.2, std.math.clamp((p - 0.2)*6, 0, 1), "easeOutSine");

      // The generated UI component appears
      const btnOpacity = std.tween(0, 1, std.math.clamp((p - 0.4)*8, 0, 1), "easeOutCubic");
      const btnScale = std.tween(0.8, 1, std.math.clamp((p - 0.4)*8, 0, 1), "easeOutBack");

      const btnHtml = `<button class="relative group overflow-hidden rounded-xl bg-gradient-to-r from-emerald-500 to-teal-400 px-12 py-6 text-3xl font-bold text-white shadow-[0_0_40px_rgba(52,211,153,0.5)] transition-all">
        <span class="relative z-10 w-full text-center">Generated by AI</span>
        <div class="absolute inset-0 bg-white/20"></div>
      </button>`;

      const promptText = `> "Create a glowing emerald button..."`;

      // Typing animation effect for the prompt
      const charsLength = promptText.length;
      const typeProgress = Math.floor(std.tween(0, charsLength, std.math.clamp((p - 0.2)*5, 0, 1), "linear"));
      const typedPrompt = promptText.substring(0, typeProgress) + (p < 0.4 || Math.floor(time * 2) % 2 === 0 ? "█" : "");

      const exit = std.tween(1, 0, std.math.clamp((p - 0.9)*10, 0, 1), "easeInCubic");

      return `
        <div class="absolute inset-0 flex flex-col items-center justify-center p-20 bg-gradient-to-br from-slate-900 to-black" style="opacity: ${exit}">
          <h2 class="text-5xl text-neutral-300 font-semibold mb-6" style="opacity: ${t1}">
            Because it's HTML...
          </h2>
          <h1 class="text-8xl font-black text-transparent bg-clip-text bg-gradient-to-r from-teal-400 to-emerald-300 mb-20" style="opacity: ${t2}; transform: scale(${glowText})">
            Any AI can write it.
          </h1>

          <div class="w-full max-w-4xl bg-black/50 border border-neutral-800 rounded-2xl p-8 shadow-2xl" style="opacity: ${t2}">
            <div class="font-mono text-2xl text-emerald-400 mb-12 h-10">
              ${typedPrompt}
            </div>

            <div class="flex items-center justify-center p-12 bg-neutral-900/50 rounded-xl border border-neutral-800 relative min-h-[200px]" style="opacity: ${btnOpacity}; transform: scale(${btnScale})">
              <div class="absolute inset-0 border border-emerald-500/20 rounded-xl animate-pulse"></div>
              ${btnHtml}
            </div>
          </div>
        </div>
      `;
    }

    // Render the currently active act
    let content = "";
    if (act1.progress < 1) {
      content = renderAct1(act1.progress);
    } else if (act2.progress < 1) {
      content = renderAct2(act2.progress);
    } else {
      content = renderAct3(act3.progress);
    }

    return `
      <div style="${std.css({ width, height })}; position: relative; overflow: hidden;">
        ${content}
      </div>
    `;
  },
});
