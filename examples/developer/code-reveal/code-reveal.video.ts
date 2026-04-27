import { defineScene, type RenderContext } from "superimg";

type SupportedLanguage =
  | "javascript"
  | "typescript"
  | "python"
  | "rust"
  | "go"
  | "json"
  | "bash"
  | "text";

type SupportedTheme = "dark-plus" | "github-light";

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export interface CodeRevealData extends Record<string, unknown> {
  code: string;
  language: string;
  filename: string;
  theme: "dark" | "light";
  animation: "fade" | "slide-up" | "slide-left";
  showLineNumbers: boolean;
  fontSize: "small" | "medium" | "large";
}

const FONT_SIZE_MAP: Record<string, string> = {
  small: "20px",
  medium: "24px",
  large: "32px",
};

function getShikiTheme(theme: "dark" | "light"): SupportedTheme {
  return theme === "dark" ? "dark-plus" : "github-light";
}

export default defineScene<CodeRevealData>({
  data: {
    code: `import { createApp } from 'vue'
import App from './App.vue'

createApp(App).mount('#app')`,
    language: "javascript",
    filename: "main.js",
    theme: "dark",
    animation: "fade",
    showLineNumbers: true,
    fontSize: "medium",
  },
  config: {
    width: 1920,
    height: 1080,
    fps: 30,
    duration: 3.2,
  },
  render(ctx: RenderContext<CodeRevealData>) {
    const { std, width, height, data } = ctx;
    const { code, language, filename, theme, animation, showLineNumbers, fontSize } = data;

    const bgColor = theme === "dark" ? "#1e1e1e" : "#ffffff";
    const textColor = theme === "dark" ? "#d4d4d4" : "#24292e";
    const lineNumColor = theme === "dark" ? "#858585" : "#999999";
    const headerBg = theme === "dark" ? "#2d2d2d" : "#f3f3f3";
    const codeFontSize = FONT_SIZE_MAP[fontSize] ?? "24px";
    const shikiTheme = getShikiTheme(theme);

    function highlightLine(line: string, lang: SupportedLanguage): string {
      if (lang === "text" || !line.trim()) {
        return escapeHtml(line) || "&nbsp;";
      }
      try {
        const html = std.code.highlight(line, { lang: lang as never, theme: shikiTheme as never });
        const match = html.match(/<code[^>]*>([\s\S]*?)<\/code>/);
        if (match?.[1]) {
          const content = match[1].replace(/\n$/, "");
          return content || "&nbsp;";
        }
        return escapeHtml(line);
      } catch {
        return escapeHtml(line);
      }
    }

    const t = std.score({
      window: 0.08,
      lines: 0.77,
      hold: 0.15
    });

    const windowProgress = t.within("window", { easing: "easeOutCubic" });
    const linesP = t.within("lines");

    const lines = code.split("\n");
    const totalLines = lines.length;

    const linesHtml = lines
      .map((line: string, i: number) => {
        const lineStart = i / totalLines;
        const lineEnd = Math.min(1, lineStart + 0.2);
        const localP = std.clamp01((linesP - lineStart) / (lineEnd - lineStart));
        const lineProgress = std.interpolate(localP, [0, 1], [0, 1], "easeOutCubic");

        const opacity = lineProgress;
        let transform = "none";
        if (animation === "slide-up") {
          transform = `translateY(${(1 - lineProgress) * 20}px)`;
        } else if (animation === "slide-left") {
          transform = `translateX(${(1 - lineProgress) * 30}px)`;
        }

        const lineNumHtml = showLineNumbers
          ? `<span class="line-num">${i + 1}</span>`
          : "";
        const highlightedLine = highlightLine(line, language as SupportedLanguage);

        return `<div class="line" style="opacity: ${opacity}; transform: ${transform};">${lineNumHtml}<span class="line-content">${highlightedLine}</span></div>`;
      })
      .join("");

    return `
    <style>
      .code-container { font-family: 'SF Mono', 'Fira Code', 'Consolas', monospace; }
      .line { display: flex; padding: 2px 0; }
      .line-num { width: 50px; text-align: right; padding-right: 16px; color: ${lineNumColor}; user-select: none; flex-shrink: 0; }
      .line-content { flex: 1; white-space: pre; }
    </style>
    <div style="width: ${width}px; height: ${height}px; background: linear-gradient(180deg, #0f0f0f 0%, #1a1a2e 100%); display: flex; align-items: center; justify-content: center; padding: 60px; box-sizing: border-box;">
      <div style="width: 100%; max-width: 1000px; background: ${bgColor}; border-radius: 12px; overflow: hidden; box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5); opacity: ${windowProgress}; transform: translateY(${(1 - windowProgress) * 20}px);">
        <div style="background: ${headerBg}; padding: 12px 20px; display: flex; align-items: center; gap: 12px;">
          <div style="display: flex; gap: 8px;">
            <div style="width: 12px; height: 12px; border-radius: 50%; background: #ff5f56;"></div>
            <div style="width: 12px; height: 12px; border-radius: 50%; background: #ffbd2e;"></div>
            <div style="width: 12px; height: 12px; border-radius: 50%; background: #27ca40;"></div>
          </div>
          ${filename ? `<span style="color: ${lineNumColor}; font-size: 14px; font-family: -apple-system, sans-serif;">${escapeHtml(filename)}</span>` : ""}
          ${language !== "text" ? `<span style="margin-left: auto; color: ${lineNumColor}; font-size: 12px; text-transform: uppercase; letter-spacing: 1px;">${language}</span>` : ""}
        </div>
        <div class="code-container" style="padding: 24px; font-size: ${codeFontSize}; line-height: 1.6; color: ${textColor}; overflow: hidden;">
          ${linesHtml}
        </div>
      </div>
    </div>
  `;
  },
});
