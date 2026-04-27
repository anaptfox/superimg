// Code Highlight Example — Animated Code Reveal
// Demonstrates: std.code.highlight() for syntax highlighting with Shiki
// Shows both static (hoisted) and dynamic (in-render) highlighting patterns

import { defineScene } from "superimg";
import { highlight } from "@superimg/stdlib/code";

// Static code: highlighted ONCE at module load (efficient for hardcoded code)
const staticCodeHtml = highlight(
  `function greet(name: string): string {
  return \`Hello, \${name}!\`;
}

const message = greet("World");
console.log(message);`,
  { lang: "typescript", theme: "dracula" }
);

export default defineScene({
  data: {
    // Dynamic code: passed in as data, highlighted per-render
    dynamicCode: `const add = (a: number, b: number) => a + b;
const result = add(2, 3);
console.log(result); // 5`,
  },

  config: {
    fps: 30,
    duration: 5,
    width: 1920,
    height: 1080,
    fonts: ["Fira+Code:wght@400;500", "Inter:wght@400;600"],
    inlineCss: [
      `
      * { margin: 0; padding: 0; box-sizing: border-box; }
      body { background: #282a36; font-family: 'Inter', sans-serif; }
      .code-container {
        width: 90%;
        max-width: 900px;
        border-radius: 12px;
        overflow: hidden;
        box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
      }
      .code-container pre {
        margin: 0;
        padding: 24px;
        font-family: 'Fira Code', monospace;
        font-size: 20px;
        line-height: 1.6;
      }
      .label {
        font-size: 14px;
        font-weight: 600;
        color: rgba(255,255,255,0.5);
        text-transform: uppercase;
        letter-spacing: 0.1em;
        margin-bottom: 12px;
      }
      .panel { margin: 20px 0; }
    `,
    ],
  },

  render(ctx) {
    const { std, width, height, data } = ctx;

    // Timeline: 1s Enter | 3s Hold | 1s Exit (on a 5s duration)
    const t = std.score({ enter: 0.2, hold: 0.6, exit: 0.2 });

    // Static code animation
    const staticAnim = t.motion({ at: 0, duration: 0.8, y: 30 });

    // Dynamic code animation (staggered +0.3 in the 1s enter phase = 0.3s)
    const dynamicAnim = t.motion({ at: 0.3, duration: 0.8, y: 30 });

    // Dynamic highlighting: via ctx.std.code (same function, different access)
    const dynamicCodeHtml = std.code.highlight(data.dynamicCode, {
      lang: "typescript",
      theme: "dracula",
    });

    const containerStyle = std.css({ width, height }, std.css.center());

    return `
      <div style="${containerStyle}; flex-direction: column;">
        <div class="panel" style="${staticAnim.style}">
          <div class="label">Static Code (hoisted import)</div>
          <div class="code-container">
            ${staticCodeHtml}
          </div>
        </div>

        <div class="panel" style="${dynamicAnim.style}">
          <div class="label">Dynamic Code (ctx.std.code)</div>
          <div class="code-container">
            ${dynamicCodeHtml}
          </div>
        </div>
      </div>
    `;
  },
});
